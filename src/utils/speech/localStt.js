/**
 * On-device speech-to-text transcriber interface.
 * Default: Whistle (Cactus Compute, 16.9 MB, Apache 2.0) with word timestamps (80 ms resolution).
 * Fallback: Moonshine Base (~250 MB).
 *
 * - Free, no API keys, private: runs on the candidate's device.
 * - Handles answers of 1–2 minutes by splitting at natural pauses into ≤20 s segments,
 *   preserving exact audio and calculating continuous word timestamps.
 * - Selective cleanup: upon successful download and load of Whistle, cleans only
 *   Moonshine cache entries from 'transformers-cache' once without touching any other storage.
 */
import {
  STT_ENGINES,
  ENGINE_METADATA,
  getPreferredSttEngine,
  setPreferredSttEngine,
  isMoonshineCleanupDone,
  markMoonshineCleanupDone,
  formatTranscriptResult,
} from './transcriberTypes.js';

export {
  STT_ENGINES,
  ENGINE_METADATA,
  getPreferredSttEngine,
  setPreferredSttEngine,
  isMoonshineCleanupDone,
  formatTranscriptResult,
};

const WHISTLE_HINT = '/stt/whistle.cact';
const SAMPLE_RATE = 16000;
const MAX_SEGMENT_S = 20;
const MIN_SEGMENT_S = 12;

export const MODEL_DOWNLOAD_MB = ENGINE_METADATA.whistle.downloadMb;

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
  engine: STT_ENGINES.WHISTLE,
  version: ENGINE_METADATA.whistle.version,
  downloadMb: ENGINE_METADATA.whistle.downloadMb,
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
 * Checks whether the Whistle model is already cached locally.
 */
async function modelIsCached() {
  try {
    if (typeof caches === 'undefined') return false;
    if (await caches.has('whistle-cache')) {
      const cache = await caches.open('whistle-cache');
      const keys = await cache.keys();
      return keys.some((r) => (r.url || '').includes('whistle.cact'));
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Targeted Moonshine cleanup:
 * Runs once after Whistle is successfully downloaded and loaded.
 * Deletes ONLY Moonshine entries from 'transformers-cache'.
 * Never touches user results, API keys, or other site storage.
 * Silently catches and ignores all errors.
 */
export async function cleanupMoonshineCacheOnce() {
  if (isMoonshineCleanupDone()) return;
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open('transformers-cache');
      const requests = await cache.keys();
      for (const req of requests) {
        const url = req.url || '';
        if (url.includes('moonshine-base-ONNX') || url.includes('moonshine')) {
          await cache.delete(req);
        }
      }
    }
    markMoonshineCleanupDone();
  } catch {
    /* Silent ignore per specification */
  }
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./sttWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'progress') {
      setState({
        status: state.cached ? 'loading' : 'downloading',
        progress: m.total ? m.loaded / m.total : 0,
        engine: STT_ENGINES.WHISTLE,
        version: ENGINE_METADATA.whistle.version,
        downloadMb: ENGINE_METADATA.whistle.downloadMb,
      });
    } else if (m.type === 'ready') {
      setState({
        status: 'ready',
        progress: 1,
        engine: STT_ENGINES.WHISTLE,
        version: m.version || ENGINE_METADATA.whistle.version,
        device: m.device,
        downloadMb: ENGINE_METADATA.whistle.downloadMb,
        error: null,
      });
      // One-time cleanup after Whistle is ready
      cleanupMoonshineCacheOnce();
    } else if (m.type === 'result' && pending.has(m.id)) {
      const formatted = formatTranscriptResult({
        text: m.text,
        words: m.words,
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
    const cached = await modelIsCached();
    setState({
      status: cached ? 'loading' : 'downloading',
      cached,
      progress: 0,
      engine: STT_ENGINES.WHISTLE,
      version: ENGINE_METADATA.whistle.version,
      downloadMb: ENGINE_METADATA.whistle.downloadMb,
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
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(buf.slice(0));
  } finally {
    try {
      ctx.close();
    } catch {
      /* already closed */
    }
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
    const rawSegments = splitAtPauses(pcm);

    let currentOffset = 0;
    const segments = rawSegments.map((s) => {
      const segObj = {
        pcm: s.slice(),
        offsetSec: currentOffset,
        durationSec: s.length / SAMPLE_RATE,
      };
      currentOffset += s.length / SAMPLE_RATE;
      return segObj;
    });

    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(
        { type: 'transcribe', id, segments, enginePreference: getPreferredSttEngine() },
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
