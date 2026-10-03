/**
 * On-device speech-to-text worker (Moonshine Base via transformers.js).
 *
 * Runs off the main thread so recording and the exam UI never stutter. The
 * model is downloaded once and kept in the browser's Cache Storage
 * (transformers.js `useBrowserCache`), so later visits load from disk.
 *
 * Messages in:  { type: 'load' } | { type: 'transcribe', id, segments: Float32Array[] }
 * Messages out: { type: 'progress', loaded, total } | { type: 'ready', device }
 *               | { type: 'result', id, text } | { type: 'error', id?, message }
 */
import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/moonshine-base-ONNX';

env.allowLocalModels = false;
env.useBrowserCache = true;

let asrPromise = null;
const fileProgress = new Map(); // file → { loaded, total }

function reportProgress(p) {
  if (p.status === 'progress' && p.file) {
    fileProgress.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
  } else if (p.status === 'done' && p.file && fileProgress.has(p.file)) {
    const f = fileProgress.get(p.file);
    fileProgress.set(p.file, { loaded: f.total, total: f.total });
  } else {
    return;
  }
  let loaded = 0;
  let total = 0;
  for (const f of fileProgress.values()) { loaded += f.loaded; total += f.total; }
  self.postMessage({ type: 'progress', loaded, total });
}

async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    return Boolean(await self.navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function createPipeline(forceCpu = false) {
  const opts = { dtype: 'fp32', progress_callback: reportProgress };
  if (!forceCpu && await hasWebGPU()) {
    try {
      const asr = await pipeline('automatic-speech-recognition', MODEL_ID, { ...opts, device: 'webgpu' });
      return { asr, device: 'webgpu' };
    } catch {
      // some GPUs/drivers reject a kernel — the CPU path always works
    }
  }
  const asr = await pipeline('automatic-speech-recognition', MODEL_ID, { ...opts, device: 'wasm' });
  return { asr, device: 'wasm' };
}

function load(forceCpu = false) {
  if (!asrPromise) {
    asrPromise = createPipeline(forceCpu).then((r) => {
      self.postMessage({ type: 'ready', device: r.device });
      return r.asr;
    }).catch((e) => {
      asrPromise = null; // allow a retry
      throw e;
    });
  }
  return asrPromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type === 'load') {
    try { await load(Boolean(msg.forceCpu)); } catch (e) { self.postMessage({ type: 'error', message: String(e?.message || e) }); }
    return;
  }
  if (msg.type === 'transcribe') {
    try {
      const asr = await load();
      const parts = [];
      for (const seg of msg.segments || []) {
        if (!seg || seg.length < 1600) continue; // < 0.1 s of audio carries no speech
        const out = await asr(seg);
        const text = String(out?.text || '').trim();
        if (text) parts.push(text);
      }
      self.postMessage({ type: 'result', id: msg.id, text: parts.join(' ').replace(/\s+/g, ' ').trim() });
    } catch (e) {
      self.postMessage({ type: 'error', id: msg.id, message: String(e?.message || e) });
    }
  }
};
