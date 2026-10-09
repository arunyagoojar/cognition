/**
 * Transcriber Interface Types & Configuration
 * Supports Whistle (Cactus Compute, 16.9 MB, Apache 2.0).
 */

export const STT_ENGINES = {
  WHISTLE: 'whistle',
};

export const ENGINE_METADATA = {
  whistle: {
    id: 'whistle',
    name: 'Whistle',
    version: '16.9mb',
    vendor: 'Cactus Compute',
    license: 'Apache-2.0',
    downloadMb: 17,
    maxSinglePassSeconds: 30,
    supportsWordTimestamps: true,
  },
};

const ENGINE_STORAGE_KEY = 'cognition_stt_engine';
const CLEANUP_STORAGE_KEY = 'cognition_moonshine_cleaned';

export function getPreferredSttEngine() {
  return STT_ENGINES.WHISTLE;
}

export function setPreferredSttEngine(engine) {
  if (typeof window === 'undefined') return;
  try {
    if (engine === STT_ENGINES.WHISTLE) {
      window.localStorage.setItem(ENGINE_STORAGE_KEY, engine);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function isMoonshineCleanupDone() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CLEANUP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markMoonshineCleanupDone() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLEANUP_STORAGE_KEY, '1');
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Standardized transcript result structure.
 * Converts to plain text via toString() for drop-in backward compatibility.
 */
export function formatTranscriptResult({
  text = '',
  words = [],
  engine = STT_ENGINES.WHISTLE,
  version = '16.9mb',
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

  return {
    text: cleanText,
    words: cleanWords,
    engine: STT_ENGINES.WHISTLE,
    version: version || '16.9mb',
    toString() {
      return cleanText;
    },
  };
}
