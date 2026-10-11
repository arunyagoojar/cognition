/**
 * On-device speech-to-text transcriber interface.
 * Moonshine Base (Useful Sensors, MIT), ~250 MB, WebGPU or WASM.
 *
 * - Free, no API keys, private: runs on the candidate's device. Weights are
 *   fetched once from the Hugging Face hub and cached by the browser.
 * - Verbatim: fillers, repeated words and restarts are kept (IELTS Fluency and
 *   Grammar are judged on them).
 * - Silence is trimmed (energy VAD) and the answer is split at its pauses into
 *   utterances; each becomes one line of the transcript, with its timing, so
 *   pauses and speaking rate can be measured.
 * - Retired engines are cleaned up once the current one works: Whisper weights
 *   in 'transformers-cache' and the old Whistle 'whistle-cache' bucket. Never
 *   touches any other storage.
 */
import {
  STT_ENGINES,
  ENGINE_METADATA,
  PRIMARY_STT_ENGINE,
  RETIRED_MODEL_REPOS,
  RETIRED_STORAGE_KEYS,
  getPreferredSttEngine,
  isWhisperCleanupDone,
  markWhisperCleanupDone,
  isWhistleCleanupDone,
  markWhistleCleanupDone,
  formatTranscriptResult,
} from './transcriberTypes.js';
import { trimSilence, speechSeconds, splitIntoUtterances } from './transcriptGuards.js';

export {
  STT_ENGINES,
  ENGINE_METADATA,
  getPreferredSttEngine,
  formatTranscriptResult,
};
export { trimSilence } from './transcriptGuards.js';

const SAMPLE_RATE = 16000;
const MAX_SEGMENT_S = 28;
const MIN_SEGMENT_S = 18;

export const MODEL_DOWNLOAD_MB = ENGINE_METADATA[PRIMARY_STT_ENGINE].downloadMb;

let worker = null;
let loadPromise = null;
let seq = 0;
const pending = new Map(); // id → { resolve, reject }
let queue = Promise.resolve(); // transcriptions run sequentially
const listeners = new Set();
let state = {
  status: 'idle',
  progress: 0,
  cached: false,
  device: null,
  engine: PRIMARY_STT_ENGINE,
  version: ENGINE_METADATA[PRIMARY_STT_ENGINE].version,
  downloadMb: ENGINE_METADATA[PRIMARY_STT_ENGINE].downloadMb,
  error: null,
};

function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function getLocalSttState() {
  return state;
}

export function subscribeLocalStt(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/**
 * True when the browser supports Web Workers, Web Audio, and WebAssembly.
 */
export function needsLocalStt() {
  if (typeof window === 'undefined') return false;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return typeof Worker !== 'undefined' && Boolean(Offline) && typeof WebAssembly !== 'undefined';
}

/**
 * True when the chosen engine's encoder is already in transformers.js's cache.
 */
async function modelIsCached(engine) {
  try {
    if (typeof caches === 'undefined') return false;
    if (!(await caches.has('transformers-cache'))) return false;
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const repo = `${ENGINE_METADATA[engine].model}/resolve/`;
    return keys.some((r) => {
      const url = r.url || '';
      return url.includes(repo) && url.includes('/onnx/encoder_model');
    });
  } catch {
    return false;
  }
}


/**
 * Removes the retired Whisper weights (~80–300 MB) from 'transformers-cache'
 * once Moonshine works, plus the old engine-choice keys. Only those entries;
 * silently ignores errors.
 */
export async function cleanupWhisperCacheOnce() {
  if (isWhisperCleanupDone()) return;
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open('transformers-cache');
      const requests = await cache.keys();
      for (const req of requests) {
        const url = req.url || '';
        if (RETIRED_MODEL_REPOS.some((repo) => url.includes(repo))) await cache.delete(req);
      }
    }
    try {
      RETIRED_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* storage blocked */
    }
    markWhisperCleanupDone();
  } catch {
    /* Silent ignore */
  }
}

/**
 * Removes the retired Whistle model (~17 MB 'whistle-cache' bucket) once.
 * Only that bucket; silently ignores errors.
 */
export async function cleanupWhistleCacheOnce() {
  if (isWhistleCleanupDone()) return;
  try {
    if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
      await caches.delete('whistle-cache');
    }
    markWhistleCleanupDone();
  } catch {
    /* Silent ignore */
  }
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./sttWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'engine') {
      setState({
        engine: m.engine,
        device: m.device,
        version: m.version || ENGINE_METADATA[m.engine]?.version,
        downloadMb: m.downloadMb || ENGINE_METADATA[m.engine]?.downloadMb,
      });
      // The worker may pick a different engine than the one checked up front.
      modelIsCached(m.engine).then((cached) => {
        if (state.status === 'loading' || state.status === 'downloading') {
          setState({ cached, status: cached ? 'loading' : 'downloading' });
        }
      });
    } else if (m.type === 'progress') {
      setState({
        status: state.cached ? 'loading' : 'downloading',
        progress: m.total ? m.loaded / m.total : 0,
      });
    } else if (m.type === 'ready') {
      setState({
        status: 'ready',
        progress: 1,
        engine: m.engine,
        version: m.version || ENGINE_METADATA[m.engine]?.version,
        device: m.device,
        error: null,
      });
      // One-time cleanup of retired engines once the current one works
      cleanupWhisperCacheOnce();
      cleanupWhistleCacheOnce();
    } else if (m.type === 'result' && pending.has(m.id)) {
      const formatted = formatTranscriptResult({
        text: m.text,
        segments: m.segments,
        engine: m.engine,
        version: m.version,
      });
      pending.get(m.id).resolve(formatted);
      pending.delete(m.id);
    } else if (m.type === 'error') {
      if (m.id && pending.has(m.id)) {
        pending.get(m.id).reject(new Error(m.message));
        pending.delete(m.id);
      } else {
        setState({ status: 'error', error: m.message });
      }
    }
  };
  worker.onerror = (e) => setState({ status: 'error', error: e?.message || 'Speech model failed to start' });
  return worker;
}

/**
 * Starts or reuses STT engine preparation.
 */
export function prepareLocalStt() {
  if (!needsLocalStt()) return Promise.resolve();
  if (state.status === 'ready') return Promise.resolve();
  if (loadPromise && state.status !== 'error') return loadPromise;

  loadPromise = (async () => {
    const engine = getPreferredSttEngine();
    const cached = await modelIsCached(engine);
    setState({
      status: cached ? 'loading' : 'downloading',
      cached,
      progress: 0,
      engine,
      version: ENGINE_METADATA[engine].version,
      downloadMb: ENGINE_METADATA[engine].downloadMb,
      error: null,
    });

    try {
      await navigator.storage?.persist?.();
    } catch {
      /* best effort */
    }

    const w = ensureWorker();
    await new Promise((resolve, reject) => {
      const unsub = subscribeLocalStt((s) => {
        if (s.status === 'ready') {
          unsub();
          resolve();
        }
        if (s.status === 'error') {
          unsub();
          reject(new Error(s.error));
        }
      });

      w.postMessage({ type: 'load' });
    });
  })();

  return loadPromise;
}

/** Decodes any recorded blob to 16 kHz mono Float32Array PCM. */
async function decodeTo16kMono(blob) {
  if (!blob || blob.size === 0) {
    throw new Error('Recorded audio blob is empty (0 bytes)');
  }
  const buf = await blob.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    throw new Error('Recorded audio buffer is empty (0 bytes)');
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    throw new Error('Web Audio API (AudioContext) is not supported in this browser');
  }
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => {
      let isDone = false;
      const onSuccess = (b) => {
        if (!isDone) {
          isDone = true;
          resolve(b);
        }
      };
      const onError = (e) => {
        if (!isDone) {
          isDone = true;
          reject(e || new Error('AudioContext.decodeAudioData failed'));
        }
      };
      try {
        const promise = ctx.decodeAudioData(buf.slice(0), onSuccess, onError);
        if (promise && typeof promise.then === 'function') {
          promise.then(onSuccess).catch(onError);
        }
      } catch (err) {
        onError(err);
      }
    });
  } finally {
    try {
      ctx.close();
    } catch {
      /* already closed */
    }
  }

  if (!decoded || !decoded.duration) {
    return new Float32Array(0);
  }

  const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offline = new Offline(1, length, SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Splits audio into segments of at most MAX_SEGMENT_S, cutting at the quietest
 * 300 ms window between MIN_SEGMENT_S and MAX_SEGMENT_S so words stay whole.
 * Returns Float32Array[] to maintain compatibility with existing tests and pipelines.
 */
export function splitAtPauses(pcm, rate = SAMPLE_RATE) {
  const segments = [];
  const win = Math.floor(rate * 0.3);
  let start = 0;
  while (pcm.length - start > MAX_SEGMENT_S * rate) {
    const from = start + MIN_SEGMENT_S * rate;
    const to = start + MAX_SEGMENT_S * rate;
    let best = to;
    let bestEnergy = Infinity;
    for (let i = from; i + win <= to; i += Math.floor(win / 2)) {
      let e = 0;
      for (let j = i; j < i + win; j += 4) e += pcm[j] * pcm[j];
      if (e < bestEnergy) {
        bestEnergy = e;
        best = i + Math.floor(win / 2);
      }
    }
    segments.push(pcm.subarray(start, best));
    start = best;
  }
  if (pcm.length - start > 0) segments.push(pcm.subarray(start));
  return segments;
}

/**
 * Transcribes one recorded answer on the device.
 * Resolves to { text, words, engine, version, toString() }.
 */
export function transcribeRecording(blob) {
  const run = async () => {
    await prepareLocalStt();
    const pcm = await decodeTo16kMono(blob);
    const empty = () =>
      formatTranscriptResult({ text: '', words: [], engine: state.engine, version: state.version });
    if (!pcm || pcm.length < 1600) return empty();

    // Voice-activity trim: drop leading/trailing silence; a recording with no
    // speech at all is never sent to the model (Whisper invents text on silence).
    const voiced = trimSilence(pcm, SAMPLE_RATE);
    if (voiced.pcm.length < 1600) return empty();

    // One utterance per stretch of speech between pauses → one transcript line
    const segments = [];
    for (const u of splitIntoUtterances(voiced.pcm, voiced.threshold, SAMPLE_RATE)) {
      const piece = voiced.pcm.subarray(u.start, u.end);
      const durationSec = piece.length / SAMPLE_RATE;
      const speechSec = speechSeconds(piece, voiced.threshold, SAMPLE_RATE);
      if (speechSec >= 0.15) {
        segments.push({ pcm: piece.slice(), offsetSec: voiced.startSec + u.start / SAMPLE_RATE, durationSec, speechSec });
      }
    }
    if (!segments.length) return empty();

    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(
        { type: 'transcribe', id, segments },
        segments.map((s) => s.pcm.buffer)
      );
    });
  };

  const job = queue.then(run, run);
  queue = job.catch(() => {});
  return job;
}

/**
 * Frees the model from memory. Caches remain intact for fast reloading.
 */
export function unloadLocalStt() {
  if (worker) {
    try {
      worker.terminate();
    } catch {
      /* already terminated */
    }
    worker = null;
  }
  for (const p of pending.values()) p.reject(new Error('Speech model unloaded'));
  pending.clear();
  loadPromise = null;
  queue = Promise.resolve();
  setState({ status: 'idle', progress: 0, device: null, error: null, cached: true });
}
