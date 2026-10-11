/**
 * Transcriber Interface Types & Configuration
 *
 * On-device English speech recognition with Moonshine Base (Useful Sensors,
 * MIT) via transformers.js / ONNX Runtime Web. Moonshine keeps what the
 * candidate actually said — fillers ("um", "uh"), repeated words and restarts —
 * which IELTS Fluency and Grammar are judged on. (Whisper, used briefly, tidies
 * these away.) Runs on WebGPU when available, otherwise WASM; the weights come
 * from the Hugging Face hub once and stay in Cache Storage ('transformers-cache').
 */

export const STT_ENGINES = {
  MOONSHINE_BASE: 'moonshine-base',
};

const MB = 1e6;

export const ENGINE_METADATA = {
  [STT_ENGINES.MOONSHINE_BASE]: {
    id: STT_ENGINES.MOONSHINE_BASE,
    name: 'Moonshine Base',
    model: 'onnx-community/moonshine-base-ONNX',
    vendor: 'Useful Sensors',
    license: 'MIT',
    // Full precision on both backends (the quantized builds lose accuracy on
    // accented speech). ~250 MB, downloaded once.
    variants: {
      webgpu: { version: 'base-fp32', dtype: 'fp32', bytes: 250 * MB },
      wasm: { version: 'base-fp32', dtype: 'fp32', bytes: 250 * MB },
    },
    version: 'base-fp32',
    downloadMb: 250,
    supportsWordTimestamps: false,
  },
};

export const PRIMARY_STT_ENGINE = STT_ENGINES.MOONSHINE_BASE;

/** Retired engines whose cached weights are removed once the current one works. */
export const RETIRED_MODEL_REPOS = ['whisper-small.en', 'whisper-base.en'];
/** localStorage keys the retired engines used. */
export const RETIRED_STORAGE_KEYS = ['cognition_stt_engine', 'cognition_stt_small_failed_at', 'cognition_moonshine_cleaned'];

const WHISPER_CLEANUP_KEY = 'cognition_whisper_cleaned';
const WHISTLE_CLEANUP_KEY = 'cognition_whistle_cleaned';

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

/** One engine now; kept so existing callers keep working. */
export function getPreferredSttEngine() {
  return PRIMARY_STT_ENGINE;
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

export function isWhisperCleanupDone() {
  return flagDone(WHISPER_CLEANUP_KEY);
}

export function markWhisperCleanupDone() {
  setFlag(WHISPER_CLEANUP_KEY);
}

export function isWhistleCleanupDone() {
  return flagDone(WHISTLE_CLEANUP_KEY);
}

export function markWhistleCleanupDone() {
  setFlag(WHISTLE_CLEANUP_KEY);
}

/**
 * Standardized transcript result.
 * `text` keeps one line per stretch of speech (a new line at each pause);
 * `segments` carry the timing of each line for fluency measures.
 * Converts to plain text via toString() for drop-in backward compatibility.
 */
export function formatTranscriptResult({
  text = '',
  words = [],
  segments = [],
  engine = PRIMARY_STT_ENGINE,
  version,
} = {}) {
  const cleanText = String(text || '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  const cleanSegments = Array.isArray(segments)
    ? segments
        .map((s) => ({ text: String(s.text || '').trim(), start: Number(s.start || 0), end: Number(s.end || 0) }))
        .filter((s) => s.text)
    : [];
  const eng = ENGINE_METADATA[engine] ? engine : PRIMARY_STT_ENGINE;

  return {
    text: cleanText,
    words: Array.isArray(words) ? words : [],
    segments: cleanSegments,
    engine: eng,
    version: version || ENGINE_METADATA[eng].version,
    toString() {
      return cleanText;
    },
  };
}
