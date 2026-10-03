/**
 * On-device speech-to-text (Moonshine Base) — the default in every browser,
 * so transcription quality is the same in Chrome, Safari, Edge and Firefox.
 *
 * - Free, no key, no daily limit: inference runs on the user's device.
 * - The model (~250 MB) downloads once and stays in the browser's Cache
 *   Storage across refreshes and visits; we also ask for persistent storage.
 * - Long answers are split at natural pauses into ≤ 20 s segments (the model
 *   is built for short utterances), transcribed in order, and joined.
 */

const MODEL_FILE_HINT = 'moonshine-base-ONNX/resolve/main/onnx/decoder_model_merged.onnx';
const SAMPLE_RATE = 16000;
const MAX_SEGMENT_S = 20;
const MIN_SEGMENT_S = 12;
export const MODEL_DOWNLOAD_MB = 250;

let worker = null;
let loadPromise = null;
let seq = 0;
const pending = new Map();          // id → { resolve, reject }
let queue = Promise.resolve();      // transcriptions run one at a time
const listeners = new Set();
let state = { status: 'idle', progress: 0, cached: false, device: null, error: null };

function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function getLocalSttState() { return state; }

export function subscribeLocalStt(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/**
 * True when this browser can run the on-device model — the default
 * transcription path in every browser. Native recognition is only a fallback
 * for browsers without Web Workers or Web Audio.
 */
export function needsLocalStt() {
  if (typeof window === 'undefined') return false;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return typeof Worker !== 'undefined' && Boolean(Offline) && typeof WebAssembly !== 'undefined';
}

async function modelIsCached() {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some(r => r.url.includes(MODEL_FILE_HINT));
  } catch {
    return false;
  }
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./sttWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'progress') {
      setState({ status: state.cached ? 'loading' : 'downloading', progress: m.total ? m.loaded / m.total : 0 });
    } else if (m.type === 'ready') {
      setState({ status: 'ready', progress: 1, device: m.device, error: null });
    } else if (m.type === 'result' && pending.has(m.id)) {
      pending.get(m.id).resolve(m.text);
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
 * Starts (or reuses) model preparation. Safe to call many times; resolves when
 * the model is ready. Call early (e.g. when Speaking or a mock exam opens).
 */
export function prepareLocalStt() {
  if (!needsLocalStt()) return Promise.resolve();
  if (state.status === 'ready') return Promise.resolve();
  if (loadPromise && state.status !== 'error') return loadPromise;
  loadPromise = (async () => {
    const cached = await modelIsCached();
    setState({ status: cached ? 'loading' : 'downloading', cached, progress: 0, error: null });
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
    const w = ensureWorker();
    await new Promise((resolve, reject) => {
      const unsub = subscribeLocalStt((s) => {
        if (s.status === 'ready') { unsub(); resolve(); }
        if (s.status === 'error') { unsub(); reject(new Error(s.error)); }
      });
      // QA switch: localStorage 'cognition_stt_force_cpu' = '1' tests the CPU path
      let forceCpu = false;
      try { forceCpu = window.localStorage.getItem('cognition_stt_force_cpu') === '1'; } catch { /* no storage */ }
      w.postMessage({ type: 'load', forceCpu });
    });
  })();
  return loadPromise;
}

/** Decodes any recorded blob (webm/opus, mp4/aac, wav) to 16 kHz mono PCM. */
async function decodeTo16kMono(blob) {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(buf.slice(0));
  } finally {
    try { ctx.close(); } catch { /* already closed */ }
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
      if (e < bestEnergy) { bestEnergy = e; best = i + Math.floor(win / 2); }
    }
    segments.push(pcm.subarray(start, best));
    start = best;
  }
  if (pcm.length - start > 0) segments.push(pcm.subarray(start));
  return segments;
}

/** Transcribes one recorded answer on the device. Resolves to plain text. */
export function transcribeRecording(blob) {
  const run = async () => {
    await prepareLocalStt();
    const pcm = await decodeTo16kMono(blob);
    // copy each segment so it can be transferred to the worker
    const segments = splitAtPauses(pcm).map(s => s.slice());
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ type: 'transcribe', id, segments }, segments.map(s => s.buffer));
    });
  };
  const job = queue.then(run, run);
  queue = job.catch(() => {});
  return job;
}
