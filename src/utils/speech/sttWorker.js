/**
 * On-device speech-to-text worker.
 * Uses Whistle (Cactus Compute, 16.9 MB, Apache 2.0).
 *
 * Runs off the main thread so recording and the exam UI never stutter.
 * Whistle runs via WebAssembly (Needle engine) with 80 ms word timestamps.
 *
 * Messages in:
 *   { type: 'load' }
 *   { type: 'transcribe', id, segments: Array<{ pcm: Float32Array, offsetSec?: number }> | Float32Array[] }
 *
 * Messages out:
 *   { type: 'progress', loaded, total, engine }
 *   { type: 'ready', engine, device, version }
 *   { type: 'result', id, text, words, engine, version }
 *   { type: 'error', id?, message }
 */
import createNeedle from './vendor/needle.js';
import { STT_ENGINES, ENGINE_METADATA } from './transcriberTypes.js';

/* ── Whistle configuration (Needle WASM) ── */
let needleModule = null;
let whistleLoaded = false;
let whistlePromise = null;

async function fetchBinaryWithCache(url, engine = STT_ENGINES.WHISTLE, expectedBytes = 17734512) {
  const cacheName = 'whistle-cache';
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(url);
      if (cached) {
        const ab = await cached.arrayBuffer();
        self.postMessage({ type: 'progress', loaded: ab.byteLength, total: ab.byteLength, engine });
        return new Uint8Array(ab);
      }
    } catch {
      /* Cache API access failed, fall back to fetch */
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${url}`);

  let resToCache = null;
  if (typeof caches !== 'undefined') {
    try {
      resToCache = res.clone();
    } catch {
      /* ignore cloning error */
    }
  }

  const contentLength = Number(res.headers?.get('Content-Length') || 0);
  const total = contentLength || expectedBytes;
  let loaded = 0;
  const chunks = [];

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        self.postMessage({ type: 'progress', loaded, total: Math.max(total, loaded), engine });
      }
    }
  } else {
    const ab = await res.arrayBuffer();
    chunks.push(new Uint8Array(ab));
    loaded = ab.byteLength;
    self.postMessage({ type: 'progress', loaded, total: loaded, engine });
  }

  const full = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    full.set(c, offset);
    offset += c.length;
  }

  if (resToCache && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(url, resToCache);
    } catch {
      /* ignore cache write failure */
    }
  }

  return full;
}

function getAssetUrl(path) {
  try {
    if (typeof self !== 'undefined' && self.location?.origin) {
      return new URL(path, self.location.origin).href;
    }
  } catch {
    /* fallback to relative */
  }
  return path;
}

async function loadWhistle() {
  if (whistleLoaded && needleModule) return needleModule;
  if (whistlePromise) return whistlePromise;

  whistlePromise = (async () => {
    // 1. Fetch needle.wasm binary
    let wasmBytes = null;
    try {
      wasmBytes = await fetchBinaryWithCache(getAssetUrl('/stt/needle.wasm'), STT_ENGINES.WHISTLE, 923000);
    } catch {
      wasmBytes = await fetchBinaryWithCache(
        'https://huggingface.co/Cactus-Compute/needle3/resolve/main/wasm/needle.wasm',
        STT_ENGINES.WHISTLE,
        923000
      );
    }

    // 2. Fetch whistle.cact model (16.9 MB)
    let cactBytes = null;
    try {
      cactBytes = await fetchBinaryWithCache(getAssetUrl('/stt/whistle.cact'), STT_ENGINES.WHISTLE, 17734512);
    } catch {
      cactBytes = await fetchBinaryWithCache(
        'https://huggingface.co/Cactus-Compute/whistle/resolve/main/whistle.cact',
        STT_ENGINES.WHISTLE,
        17734512
      );
    }

    // 3. Initialize needle WASM module
    needleModule = await createNeedle({
      wasmBinary: wasmBytes.buffer,
    });

    // 4. Load whistle.cact into needle engine
    const cactPtr = needleModule._malloc(cactBytes.length);
    needleModule.HEAPU8.set(cactBytes, cactPtr);
    const ret = needleModule._needle_load(cactPtr, BigInt(cactBytes.length));
    needleModule._free(cactPtr);

    if (ret !== 0) {
      throw new Error(`needle_load failed with code ${ret}`);
    }

    whistleLoaded = true;
    return needleModule;
  })().catch((err) => {
    whistlePromise = null;
    whistleLoaded = false;
    needleModule = null;
    throw err;
  });

  return whistlePromise;
}

/* ── Transcription routines ── */
async function transcribeWithWhistle(segments) {
  const mod = await loadWhistle();
  const allWords = [];
  const textParts = [];

  for (const seg of segments) {
    const rawPcm = seg?.pcm || (seg instanceof Float32Array ? seg : null);
    const offsetSec = Number(seg?.offsetSec || 0);

    if (!rawPcm) continue;
    const pcm = rawPcm instanceof Float32Array ? rawPcm : new Float32Array(rawPcm);
    if (pcm.length < 1600) continue; // < 0.1 s audio carries no speech

    const samples = pcm.length;
    const pcmPtr = mod._malloc(samples * 4);
    mod.HEAPU8.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), pcmPtr);

    const outCap = 65536;
    const outPtr = mod._malloc(outCap);
    // lang=0 (auto/en), keywords=0, word_timestamps=1
    // needle_transcribe returns the token count (>= 0 on success, < 0 on failure)
    const ret = mod._needle_transcribe(pcmPtr, samples, 0, 0, 1, outPtr, outCap);
    mod._free(pcmPtr);

    if (ret < 0) {
      let errDesc = `needle_transcribe failed with code ${ret}`;
      if (typeof mod._needle_last_error === 'function') {
        const errPtr = mod._needle_last_error();
        if (errPtr) errDesc += `: ${mod.UTF8ToString(errPtr)}`;
      }
      mod._free(outPtr);
      throw new Error(errDesc);
    }

    const jsonStr = mod.UTF8ToString(outPtr);
    mod._free(outPtr);

    let parsed = {};
    try {
      parsed = JSON.parse(jsonStr || '{}');
    } catch {
      parsed = { text: '' };
    }

    const segText = String(parsed.text || '').trim();
    if (segText) textParts.push(segText);

    if (Array.isArray(parsed.words)) {
      for (const w of parsed.words) {
        if (!w || !w.word) continue;
        allWords.push({
          word: String(w.word).trim(),
          start: Math.round((offsetSec + (w.start || 0)) * 1000) / 1000,
          end: Math.round((offsetSec + (w.end || 0)) * 1000) / 1000,
          probability: Math.round((w.probability || 0) * 1000) / 1000,
        });
      }
    }
  }

  return {
    text: textParts.join(' ').replace(/\s+/g, ' ').trim(),
    words: allWords,
    engine: STT_ENGINES.WHISTLE,
    version: ENGINE_METADATA.whistle.version,
  };
}

/* ── Worker Message Dispatcher ── */
self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'load') {
    try {
      await loadWhistle();
      self.postMessage({
        type: 'ready',
        engine: STT_ENGINES.WHISTLE,
        device: 'wasm',
        version: ENGINE_METADATA.whistle.version,
      });
    } catch (whistleErr) {
      self.postMessage({
        type: 'error',
        message: `Speech engine failed: Whistle (${whistleErr?.message || whistleErr})`,
      });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const id = msg.id;
    const segments = msg.segments || [];

    try {
      const result = await transcribeWithWhistle(segments);
      self.postMessage({
        type: 'result',
        id,
        text: result.text,
        words: result.words,
        engine: result.engine,
        version: result.version,
      });
    } catch (e) {
      self.postMessage({ type: 'error', id, message: String(e?.message || e) });
    }
  }
};
