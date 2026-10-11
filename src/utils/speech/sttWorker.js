/**
 * On-device speech-to-text worker (Moonshine Base via transformers.js).
 *
 * Runs off the main thread so recording and the exam UI never stutter.
 * WebGPU when the browser has it, otherwise WASM (and WASM again if the GPU
 * path fails to load or run). Weights are downloaded once from the Hugging
 * Face hub and kept in Cache Storage ('transformers-cache').
 *
 * Each answer arrives already split into utterances (stretches of speech
 * between pauses); every utterance becomes one line of the transcript, so the
 * result reads like a script and each pause can be timed. Transcripts are
 * verbatim — fillers, repeats and restarts are kept; only the model's own
 * silence artefacts and runaway loops are removed (transcriptGuards.js).
 *
 * Messages in:
 *   { type: 'load' }
 *   { type: 'transcribe', id, segments: Array<{ pcm: Float32Array, offsetSec, durationSec, speechSec }> }
 * Messages out:
 *   { type: 'engine', engine, device, version, downloadMb }
 *   { type: 'progress', loaded, total, engine }
 *   { type: 'ready', engine, device, version }
 *   { type: 'result', id, text, segments: [{ text, start, end }], engine, version }
 *   { type: 'error', id?, message }
 */
import { pipeline, env } from '@huggingface/transformers';
import { STT_ENGINES, ENGINE_METADATA } from './transcriberTypes.js';
import { guardSegmentText, maxNewTokensFor } from './transcriptGuards.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
try {
  // Without cross-origin isolation the WASM backend is single-threaded anyway;
  // saying so up front avoids ORT's SharedArrayBuffer probe and warning.
  if (env.backends?.onnx?.wasm && !self.crossOriginIsolated) env.backends.onnx.wasm.numThreads = 1;
} catch {
  /* best effort */
}

const ENGINE = STT_ENGINES.MOONSHINE_BASE;
const META = ENGINE_METADATA[ENGINE];

let current = null; // { device, version, asr }
let loading = null; // Promise<current>
let chain = Promise.resolve(); // model calls run one at a time

function serial(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    return Boolean(await self.navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function create(device) {
  const variant = META.variants[device] || META.variants.wasm;
  self.postMessage({ type: 'engine', engine: ENGINE, device, version: variant.version, downloadMb: Math.round(variant.bytes / 1e6) });
  const fileProgress = new Map();
  let lastSent = 0;
  const progress_callback = (p) => {
    if (p?.status === 'progress' && p.file) fileProgress.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
    else if (p?.status === 'done' && p.file && fileProgress.has(p.file)) {
      const f = fileProgress.get(p.file);
      fileProgress.set(p.file, { loaded: f.total, total: f.total });
    } else return;
    let loaded = 0;
    let total = 0;
    for (const f of fileProgress.values()) { loaded += f.loaded; total += f.total; }
    total = Math.max(total, variant.bytes);
    const now = Date.now();
    if (now - lastSent < 100 && loaded < total) return;
    lastSent = now;
    self.postMessage({ type: 'progress', loaded: Math.min(loaded, total), total, engine: ENGINE });
  };
  const asr = await pipeline('automatic-speech-recognition', META.model, { dtype: variant.dtype, device, progress_callback });
  // One tiny pass compiles the GPU shaders now (not on the first answer) and
  // proves the model actually runs on this device.
  await asr(new Float32Array(16000), { max_new_tokens: 4 });
  return { device, version: variant.version, asr };
}

async function dispose(entry) {
  try {
    await entry?.asr?.dispose?.();
  } catch {
    /* ignore */
  }
}

function load() {
  if (current) return Promise.resolve(current);
  if (!loading) {
    loading = serial(async () => {
      if (await hasWebGPU()) {
        try {
          current = await create('webgpu');
        } catch {
          current = null; // some GPUs/drivers reject a kernel — the CPU path always works
        }
      }
      if (!current) current = await create('wasm');
      self.postMessage({ type: 'ready', engine: ENGINE, device: current.device, version: current.version });
      return current;
    }).finally(() => {
      loading = null;
    });
  }
  return loading;
}

async function switchToWasm() {
  const old = current;
  current = null;
  await dispose(old);
  current = await create('wasm');
  self.postMessage({ type: 'ready', engine: ENGINE, device: current.device, version: current.version });
  return current;
}

async function transcribeSegments(entry, segments) {
  const lines = [];
  for (const seg of segments) {
    const pcm = seg?.pcm instanceof Float32Array ? seg.pcm : null;
    if (!pcm || pcm.length < 1600) continue; // < 0.1 s of audio carries no speech
    const durationSec = Number(seg.durationSec) || pcm.length / 16000;
    const out = await entry.asr(pcm, { max_new_tokens: maxNewTokensFor(durationSec) });
    const text = guardSegmentText(out?.text, seg.speechSec ?? Infinity);
    if (text) {
      const start = Number(seg.offsetSec) || 0;
      lines.push({ text, start, end: start + durationSec });
    }
  }
  return lines;
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'load') {
    try {
      await load();
    } catch (e) {
      self.postMessage({ type: 'error', message: `Speech model failed to load: ${e?.message || e}` });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { id } = msg;
    const segments = msg.segments || [];
    try {
      const entry = await load();
      const lines = await serial(async () => {
        try {
          return await transcribeSegments(current || entry, segments);
        } catch (e) {
          // The GPU lost its device / ran out of memory mid-answer: redo this
          // answer once on the CPU path.
          if ((current || entry).device !== 'webgpu') throw e;
          return transcribeSegments(await switchToWasm(), segments);
        }
      });
      self.postMessage({
        type: 'result',
        id,
        text: lines.map((l) => l.text).join('\n'),
        segments: lines,
        engine: ENGINE,
        version: current.version,
      });
    } catch (e) {
      self.postMessage({ type: 'error', id, message: String(e?.message || e) });
    }
  }
};
