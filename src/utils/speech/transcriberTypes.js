/**
 * Transcriber Interface Types & Configuration
 *
 * On-device English speech recognition with OpenAI Whisper (MIT) via
 * transformers.js / ONNX Runtime Web:
 *   - primary:  whisper-small.en (244M params) — WebGPU, 4-bit weights
 *   - fallback: whisper-base.en  (74M params)  — WASM, when WebGPU is missing,
 *     on phones / low-memory devices, or when small.en fails on this device.
 * Weights come from the Hugging Face hub once and stay in the browser's
 * Cache Storage ('transformers-cache').
 */

export const STT_ENGINES = {
  WHISPER_SMALL_EN: 'whisper-small.en',
  WHISPER_BASE_EN: 'whisper-base.en',
};

const MB = 1e6;

export const ENGINE_METADATA = {
  [STT_ENGINES.WHISPER_SMALL_EN]: {
    id: STT_ENGINES.WHISPER_SMALL_EN,
    name: 'Whisper Small',
    model: 'onnx-community/whisper-small.en',
    vendor: 'OpenAI',
    license: 'MIT',
    // q4 (MatMulNBits) runs natively on ONNX Runtime WebGPU. Sizes are the
    // hub file sizes. small.en is not used on WASM: single-threaded it runs
    // at ~0.75x real time (over a minute for a 2-minute answer).
    variants: {
      webgpu: {
        version: 'small.en-q4',
        dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
        bytes: (66.2 + 233.1 + 2.5) * MB,
      },
    },
    version: 'small.en-q4',
    downloadMb: 300,
    maxSinglePassSeconds: 30,
    supportsWordTimestamps: false,
  },
  [STT_ENGINES.WHISPER_BASE_EN]: {
    id: STT_ENGINES.WHISPER_BASE_EN,
    name: 'Whisper Base',
    model: 'onnx-community/whisper-base.en',
    vendor: 'OpenAI',
    license: 'MIT',
    variants: {
      // 8-bit encoder: ~1.5x faster than fp32 in single-threaded WASM
      // (6.1 s vs 9.2 s per 30 s window measured in Chrome on Apple M-series).
      wasm: {
        version: 'base.en-q8',
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
        bytes: (23.2 + 53.7 + 2.5) * MB,
      },
    },
    version: 'base.en-q8',
    downloadMb: 80,
    maxSinglePassSeconds: 30,
    supportsWordTimestamps: false,
  },
};

export const PRIMARY_STT_ENGINE = STT_ENGINES.WHISPER_SMALL_EN;
export const FALLBACK_STT_ENGINE = STT_ENGINES.WHISPER_BASE_EN;

const ENGINE_STORAGE_KEY = 'cognition_stt_engine';
const SMALL_FAILED_KEY = 'cognition_stt_small_failed_at';
const CLEANUP_STORAGE_KEY = 'cognition_moonshine_cleaned';
const WHISTLE_CLEANUP_KEY = 'cognition_whistle_cleaned';
/** After small.en fails to load on a device, use base.en for this long before retrying. */
export const SMALL_RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function isKnownEngine(engine) {
  return engine === STT_ENGINES.WHISPER_SMALL_EN || engine === STT_ENGINES.WHISPER_BASE_EN;
}

/**
 * The engine to try first on this device: small.en, unless it failed to load
 * here recently (then base.en), or the user explicitly chose base.en.
 */
export function getPreferredSttEngine(now = Date.now()) {
  const s = storage();
  if (!s) return PRIMARY_STT_ENGINE;
  try {
    const failedAt = Number(s.getItem(SMALL_FAILED_KEY) || 0);
    if (failedAt && now - failedAt < SMALL_RETRY_AFTER_MS) return FALLBACK_STT_ENGINE;
    const chosen = s.getItem(ENGINE_STORAGE_KEY);
    if (isKnownEngine(chosen)) return chosen;
  } catch {
    /* ignore storage errors */
  }
  return PRIMARY_STT_ENGINE;
}

export function setPreferredSttEngine(engine) {
  const s = storage();
  if (!s || !isKnownEngine(engine)) return;
  try {
    s.setItem(ENGINE_STORAGE_KEY, engine);
  } catch {
    /* ignore storage errors */
  }
}

/** Remembers that small.en could not load on this device (falls back to base.en for a while). */
export function markSmallEngineFailed(now = Date.now()) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SMALL_FAILED_KEY, String(now));
  } catch {
    /* ignore storage errors */
  }
}

export function clearSmallEngineFailure() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SMALL_FAILED_KEY);
  } catch {
    /* ignore storage errors */
  }
}

function flagDone(key) {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, '1');
  } catch {
    /* ignore storage errors */
  }
}

export function isMoonshineCleanupDone() {
  return flagDone(CLEANUP_STORAGE_KEY);
}

export function markMoonshineCleanupDone() {
  setFlag(CLEANUP_STORAGE_KEY);
}

export function isWhistleCleanupDone() {
  return flagDone(WHISTLE_CLEANUP_KEY);
}

export function markWhistleCleanupDone() {
  setFlag(WHISTLE_CLEANUP_KEY);
}

/**
 * Standardized transcript result structure.
 * Converts to plain text via toString() for drop-in backward compatibility.
 */
export function formatTranscriptResult({
  text = '',
  words = [],
  engine = PRIMARY_STT_ENGINE,
  version,
} = {}) {
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
  const cleanWords = Array.isArray(words)
    ? words.map((w) => ({
        word: String(w.word || '').trim(),
        start: Number(w.start || 0),
        end: Number(w.end || 0),
        probability: Number(w.probability || 0),
      }))
    : [];
  const eng = isKnownEngine(engine) ? engine : PRIMARY_STT_ENGINE;

  return {
    text: cleanText,
    words: cleanWords,
    engine: eng,
    version: version || ENGINE_METADATA[eng].version,
    toString() {
      return cleanText;
    },
  };
}
