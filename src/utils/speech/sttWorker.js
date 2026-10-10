/**
 * On-device speech-to-text worker (OpenAI Whisper via transformers.js).
 *
 * Runs off the main thread so recording and the exam UI never stutter.
 *   - whisper-small.en, 4-bit, on WebGPU
 *   - whisper-base.en in WASM as the automatic fallback: no WebGPU, weak /
 *     low-memory devices, or small.en failing to load or run here.
 *     (small.en on single-threaded WASM measured ~0.75x real time on a laptop
 *     CPU — over a minute per 2-minute answer — so it is never used there.)
 * Weights are downloaded once from the Hugging Face hub and kept in Cache
 * Storage ('transformers-cache'); later visits load from disk.
 *
 * Transcripts are verbatim: no prompt, greedy decoding, nothing rewritten
 * except Whisper's own silence artefacts and runaway repetition loops
 * (see transcriptGuards.js).
 *
 * Messages in:
 *   { type: 'load', engine, hints: { lowMemory } }
 *   { type: 'transcribe', id, segments: Array<{ pcm: Float32Array, offsetSec, durationSec, speechSec }> }
 * Messages out:
 *   { type: 'engine', engine, device, version, downloadMb }   (choice made / changed)
 *   { type: 'progress', loaded, total, engine }
 *   { type: 'fallback', from, to, reason }                    (small.en unusable here)
 *   { type: 'ready', engine, device, version }
 *   { type: 'result', id, text, words, engine, version }
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

let current = null; // { engine, device, version, asr }
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

/** Picks engine + device for this device. */
async function choose(preferred, hints = {}) {
  if (preferred !== STT_ENGINES.WHISPER_BASE_EN && !hints.lowMemory) {
    if (await hasWebGPU()) return { engine: STT_ENGINES.WHISPER_SMALL_EN, device: 'webgpu' };
  }
  return { engine: STT_ENGINES.WHISPER_BASE_EN, device: 'wasm' };
}

function variantOf(engine, device) {
  const meta = ENGINE_METADATA[engine];
  return meta.variants[device] || meta.variants.wasm;
}

async function create(engine, device) {
  const meta = ENGINE_METADATA[engine];
  const variant = variantOf(engine, device);
  self.postMessage({
    type: 'engine',
    engine,
    device,
    version: variant.version,
    downloadMb: Math.round(variant.bytes / 1e6),
  });
  const expected = variant.bytes;
  let lastSent = 0;
  const progress_callback = (p) => {
    if (p?.status !== 'progress_total') return;
    const total = Math.max(Number(p.total) || 0, expected);
    const loaded = Math.min(Number(p.loaded) || 0, total);
    const now = Date.now();
    if (now - lastSent < 100 && loaded < total) return;
    lastSent = now;
    self.postMessage({ type: 'progress', loaded, total, engine });
  };
  const asr = await pipeline('automatic-speech-recognition', meta.model, {
    dtype: variant.dtype,
    device,
    progress_callback,
  });
  // One tiny pass compiles the WebGPU shaders now (not on the first answer)
  // and proves the model actually runs on this GPU / browser.
  await asr(new Float32Array(16000), { max_new_tokens: 4 });
  return { engine, device, version: variant.version, asr };
}

async function dispose(entry) {
  try {
    await entry?.asr?.dispose?.();
  } catch {
    /* ignore */
  }
}

async function fallBackToBase(reason) {
  const from = current?.engine || STT_ENGINES.WHISPER_SMALL_EN;
  const old = current;
  current = null;
  await dispose(old);
  self.postMessage({ type: 'fallback', from, to: STT_ENGINES.WHISPER_BASE_EN, reason: String(reason || '') });
  current = await create(STT_ENGINES.WHISPER_BASE_EN, 'wasm');
  return current;
}

function load(preferred, hints) {
  if (current) return Promise.resolve(current);
  if (!loading) {
    loading = serial(async () => {
      const pick = await choose(preferred, hints);
      try {
        current = await create(pick.engine, pick.device);
      } catch (e) {
        if (pick.engine === STT_ENGINES.WHISPER_BASE_EN) throw e;
        await fallBackToBase(e?.message || e);
      }
      self.postMessage({ type: 'ready', engine: current.engine, device: current.device, version: current.version });
      return current;
    }).finally(() => {
      loading = null;
    });
  }
  return loading;
}

async function transcribeSegments(entry, segments) {
  const parts = [];
  for (const seg of segments) {
    const pcm = seg?.pcm instanceof Float32Array ? seg.pcm : seg instanceof Float32Array ? seg : null;
    if (!pcm || pcm.length < 1600) continue; // < 0.1 s of audio carries no speech
    const durationSec = Number(seg?.durationSec) || pcm.length / 16000;
    const speechSec = seg?.speechSec ?? Infinity;
    const out = await entry.asr(pcm, { max_new_tokens: maxNewTokensFor(durationSec) });
    const text = guardSegmentText(out?.text, speechSec);
    if (text) parts.push(text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'load') {
    try {
      await load(msg.engine, msg.hints);
    } catch (e) {
      self.postMessage({ type: 'error', message: `Speech model failed to load: ${e?.message || e}` });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { id } = msg;
    const segments = msg.segments || [];
    try {
      const entry = await load(msg.engine, msg.hints);
      const text = await serial(async () => {
        try {
          return await transcribeSegments(current || entry, segments);
        } catch (e) {
          // small.en ran out of GPU memory / lost its device mid-answer:
          // switch to base.en and redo this answer once.
          if ((current || entry).engine !== STT_ENGINES.WHISPER_SMALL_EN) throw e;
          const base = await fallBackToBase(e?.message || e);
          self.postMessage({ type: 'ready', engine: base.engine, device: base.device, version: base.version });
          return transcribeSegments(base, segments);
        }
      });
      self.postMessage({ type: 'result', id, text, words: [], engine: current.engine, version: current.version });
    } catch (e) {
      self.postMessage({ type: 'error', id, message: String(e?.message || e) });
    }
  }
};
