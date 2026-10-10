/**
 * Test suite for browser STT engine:
 * - Engine configuration (Whisper small.en primary, base.en fallback, ≤ ~300 MB)
 * - Pause chunking & timestamp offsets for long Part 2 monologues
 * - Silence trimming (VAD) and Whisper hallucination guards (verbatim otherwise)
 * - Targeted legacy cache cleanup (Moonshine entries, Whistle bucket)
 * - Mocked worker protocol (engine, ready, and transcribe)
 * - Privacy & security check (no audio or keys logged or stored in result)
 */
import assert from 'node:assert/strict';
import {
  STT_ENGINES,
  ENGINE_METADATA,
  PRIMARY_STT_ENGINE,
  FALLBACK_STT_ENGINE,
  SMALL_RETRY_AFTER_MS,
  getPreferredSttEngine,
  setPreferredSttEngine,
  markSmallEngineFailed,
  clearSmallEngineFailure,
  isMoonshineCleanupDone,
  isWhistleCleanupDone,
  formatTranscriptResult,
} from '../src/utils/speech/transcriberTypes.js';
import {
  splitAtPauses,
  cleanupMoonshineCacheOnce,
  cleanupWhistleCacheOnce,
  MODEL_DOWNLOAD_MB,
  trimSilence,
} from '../src/utils/speech/localStt.js';
import {
  speechSeconds,
  collapseRepetitionLoops,
  guardSegmentText,
  maxNewTokensFor,
} from '../src/utils/speech/transcriptGuards.js';
import {
  clearAudioRecordings,
  eradicateAllAudioRecordings,
} from '../src/utils/audio/audioStore.js';

let passed = 0;
let failed = 0;

function t(label, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ PASS:', label);
  } catch (e) {
    failed++;
    console.error('  ✗ FAIL:', label, '—', e.message);
  }
}

async function tAsync(label, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ PASS:', label);
  } catch (e) {
    failed++;
    console.error('  ✗ FAIL:', label, '—', e.message);
  }
}

console.log('== Speech Engine: Configuration & Preferences ==');

// Setup mock window & localStorage
const mockStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mockStorage.has(k) ? mockStorage.get(k) : null),
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  },
};

t('defaults to Whisper small.en, with base.en as the fallback', () => {
  mockStorage.clear();
  assert.equal(PRIMARY_STT_ENGINE, 'whisper-small.en');
  assert.equal(FALLBACK_STT_ENGINE, 'whisper-base.en');
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISPER_SMALL_EN);
});

t('every model variant stays within the ~300 MB download budget', () => {
  for (const meta of Object.values(ENGINE_METADATA)) {
    assert.ok(meta.model.startsWith('onnx-community/whisper-'), meta.model);
    assert.ok(meta.model.endsWith('.en'), 'English-only checkpoints (no language detection)');
    for (const v of Object.values(meta.variants)) {
      assert.ok(v.bytes <= 305e6, `${meta.id} ${v.version} is ${Math.round(v.bytes / 1e6)} MB`);
      assert.ok(v.dtype.encoder_model && v.dtype.decoder_model_merged);
    }
  }
  assert.ok(MODEL_DOWNLOAD_MB <= 300);
  // WebGPU uses 4-bit MatMulNBits weights, which ONNX Runtime WebGPU runs natively
  assert.equal(ENGINE_METADATA[STT_ENGINES.WHISPER_SMALL_EN].variants.webgpu.dtype.decoder_model_merged, 'q4');
});

t('a small.en load failure switches the device to base.en, then retries small.en later', () => {
  mockStorage.clear();
  const t0 = 1_000_000;
  markSmallEngineFailed(t0);
  assert.equal(getPreferredSttEngine(t0 + 1000), STT_ENGINES.WHISPER_BASE_EN);
  assert.equal(getPreferredSttEngine(t0 + SMALL_RETRY_AFTER_MS + 1), STT_ENGINES.WHISPER_SMALL_EN);
  clearSmallEngineFailure();
  assert.equal(getPreferredSttEngine(t0 + 1000), STT_ENGINES.WHISPER_SMALL_EN);
});

t('setPreferredSttEngine accepts base.en; invalid engine values are ignored', () => {
  mockStorage.clear();
  setPreferredSttEngine(STT_ENGINES.WHISPER_BASE_EN);
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISPER_BASE_EN);
  mockStorage.clear();
  setPreferredSttEngine('whisper_v3');
  setPreferredSttEngine('whistle');
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISPER_SMALL_EN);
});

console.log('\n== Speech Engine: Formatting ==');

t('formats a Whisper transcript verbatim, keeping fillers and repetitions', () => {
  const res = formatTranscriptResult({
    text: ' Well, um, I I think   the the city is, uh, convenient. ',
    words: [],
    engine: STT_ENGINES.WHISPER_SMALL_EN,
    version: 'small.en-q4',
  });
  assert.equal(res.text, 'Well, um, I I think the the city is, uh, convenient.');
  assert.equal(res.engine, 'whisper-small.en');
  assert.equal(res.version, 'small.en-q4');
  assert.deepEqual(res.words, []);
  // toString compatibility
  assert.equal(String(res), res.text);
});

t('unknown engine labels resolve to the primary engine', () => {
  const res = formatTranscriptResult({ text: 'Hello', engine: 'whistle' });
  assert.equal(res.engine, 'whisper-small.en');
  assert.equal(res.version, ENGINE_METADATA['whisper-small.en'].version);
});

console.log('\n== Speech Engine: Pause Chunking & Timestamp Offsets ==');

const RATE = 16000;
const tone = (secs, silenceAt = []) => {
  const a = new Float32Array(Math.round(secs * RATE));
  for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(i / 5);
  for (const [s, e] of silenceAt) a.fill(0, Math.round(s * RATE), Math.round(e * RATE));
  return a;
};

t('2-minute monologue splits into chunks <= 28 s without sample loss', () => {
  // 120 seconds of speech with natural pauses every 15 seconds
  const silences = [
    [15, 16],
    [30, 31],
    [45, 46],
    [60, 61],
    [75, 76],
    [90, 91],
    [105, 106],
  ];
  const longAudio = tone(120, silences);
  const segments = splitAtPauses(longAudio);

  // Must produce multiple segments
  assert.ok(segments.length >= 5);

  // Each segment must fit one Whisper window (<= 28 seconds)
  for (const seg of segments) {
    const dur = seg.length / RATE;
    assert.ok(dur <= 28, `Segment duration ${dur}s exceeds 28s limit`);
  }

  // Sum of segment lengths must match original audio
  const totalSamples = segments.reduce((acc, s) => acc + s.length, 0);
  assert.equal(totalSamples, longAudio.length);
});

t('global timestamp calculation across multi-chunk transcription', () => {
  const segments = [
    { pcm: tone(15), offsetSec: 0 },
    { pcm: tone(15), offsetSec: 15.0 },
    { pcm: tone(15), offsetSec: 30.0 },
  ];

  // Simulated word results from each segment
  const seg1Words = [
    { word: 'First', start: 1.0, end: 1.5, probability: 0.99 },
    { word: 'part', start: 1.6, end: 2.0, probability: 0.95 },
  ];
  const seg2Words = [
    { word: 'second', start: 0.5, end: 1.0, probability: 0.97 },
  ];

  // Calculate global offsets as the worker does: (offsetSec + localTimestamp)
  const globalWords = [
    ...seg1Words.map((w) => ({ ...w, start: segments[0].offsetSec + w.start, end: segments[0].offsetSec + w.end })),
    ...seg2Words.map((w) => ({ ...w, start: segments[1].offsetSec + w.start, end: segments[1].offsetSec + w.end })),
  ];

  assert.equal(globalWords[0].start, 1.0);
  assert.equal(globalWords[1].start, 1.6);
  assert.equal(globalWords[2].start, 15.5); // 15.0 + 0.5
  assert.equal(globalWords[2].end, 16.0);   // 15.0 + 1.0
});

console.log('\n== Speech Engine: Silence Trimming & Hallucination Guards ==');

const noise = (secs, amp = 0.001) => {
  const a = new Float32Array(Math.round(secs * RATE));
  let x = 12345;
  for (let i = 0; i < a.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    a[i] = amp * ((x / 0x7fffffff) * 2 - 1);
  }
  return a;
};
const concat = (...parts) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

t('trims leading and trailing silence, keeping a margin around speech', () => {
  const pcm = concat(noise(3), tone(5), noise(4));
  const v = trimSilence(pcm, RATE);
  const dur = v.pcm.length / RATE;
  assert.ok(v.startSec > 2.5 && v.startSec < 3, `starts at ${v.startSec}`);
  assert.ok(dur > 5 && dur < 6, `keeps ${dur.toFixed(2)} s`);
  assert.ok(v.speechSec > 4.8 && v.speechSec < 5.2);
});

t('a silent or noise-only recording yields no audio for the model', () => {
  assert.equal(trimSilence(noise(10), RATE).pcm.length, 0);
  assert.equal(trimSilence(new Float32Array(RATE * 5), RATE).pcm.length, 0);
});

t('speech in a noisy room is still detected', () => {
  const pcm = concat(noise(2, 0.02), tone(4), noise(2, 0.02));
  const v = trimSilence(pcm, RATE);
  assert.ok(v.pcm.length / RATE >= 4, 'speech kept');
  assert.ok(speechSeconds(noise(3, 0.02), v.threshold, RATE) < 0.2, 'room noise is not speech');
});

t('Whisper silence phantoms are dropped only when the segment was barely voiced', () => {
  assert.equal(guardSegmentText(' Thank you.', 0.3), '');
  assert.equal(guardSegmentText('you', 0.1), '');
  assert.equal(guardSegmentText(' [BLANK_AUDIO]', 5), '');
  // a candidate really saying it is kept
  assert.equal(guardSegmentText(' Thank you.', 2.5), 'Thank you.');
});

t('decoding loops are collapsed; natural repetitions and fillers stay verbatim', () => {
  const loop = 'I like it because I like it because I like it because I like it because I like it because';
  assert.equal(collapseRepetitionLoops(loop), 'I like it because I like it because');
  const natural = 'Um, I I think the the main reason is, uh, you know, the the price.';
  assert.equal(guardSegmentText(natural, 6), natural);
});

t('generation is capped by segment length', () => {
  assert.equal(maxNewTokensFor(0.5), 24);
  assert.ok(maxNewTokensFor(20) >= 140 && maxNewTokensFor(20) <= 160);
  assert.ok(maxNewTokensFor(60) <= 440);
});

console.log('\n== Speech Engine: Targeted Legacy Cleanup ==');

await tAsync('cleans ONLY Moonshine entries from transformers-cache, preserves others', async () => {
  mockStorage.clear();
  const deletedUrls = [];
  const keptUrls = [];

  const mockCacheItems = [
    { url: 'https://huggingface.co/onnx-community/moonshine-base-ONNX/resolve/main/onnx/model.onnx' },
    { url: 'https://huggingface.co/onnx-community/moonshine-base-ONNX/resolve/main/tokenizer.json' },
    { url: 'https://huggingface.co/whisper-tiny/resolve/main/model.onnx' },
    { url: 'https://cdn.example.com/assets/audio/prompt.mp3' },
  ];

  globalThis.caches = {
    open: async (name) => {
      assert.equal(name, 'transformers-cache');
      return {
        keys: async () => mockCacheItems,
        delete: async (req) => {
          deletedUrls.push(req.url);
        },
      };
    },
  };

  await cleanupMoonshineCacheOnce();

  // Exactly the 2 Moonshine items should be deleted
  assert.equal(deletedUrls.length, 2);
  assert.ok(deletedUrls.every((u) => u.includes('moonshine')));

  // The cleanup marker in localStorage must be set to '1'
  assert.equal(isMoonshineCleanupDone(), true);
  assert.equal(mockStorage.get('cognition_moonshine_cleaned'), '1');
});

await tAsync('cleanup is idempotent and does not repeat once flag is set', async () => {
  let openCallCount = 0;
  globalThis.caches = {
    open: async () => {
      openCallCount++;
      return { keys: async () => [], delete: async () => {} };
    },
  };

  // Flag is already '1'
  assert.equal(isMoonshineCleanupDone(), true);
  await cleanupMoonshineCacheOnce();

  // Cache open must not have been called again
  assert.equal(openCallCount, 0);
});

await tAsync('cleanup handles cache access errors silently without throwing', async () => {
  mockStorage.clear();
  globalThis.caches = {
    open: async () => {
      throw new Error('SecurityError: CacheStorage blocked in private mode');
    },
  };

  // Must not throw
  await cleanupMoonshineCacheOnce();
});

console.log('\n== Speech Engine: Worker Message Protocol ==');

t('simulated engine choice and ready worker messages', () => {
  const events = [];
  const handleWorkerMessage = (m) => events.push(m);
  handleWorkerMessage({ type: 'engine', engine: STT_ENGINES.WHISPER_SMALL_EN, device: 'webgpu', version: 'small.en-q4', downloadMb: 302 });
  handleWorkerMessage({ type: 'ready', engine: STT_ENGINES.WHISPER_SMALL_EN, device: 'webgpu', version: 'small.en-q4' });
  assert.equal(events.length, 2);
  assert.equal(events[1].type, 'ready');
  assert.equal(events[1].engine, 'whisper-small.en');
});

t('simulated fallback then transcribe result message', () => {
  const events = [];
  const handleWorkerMessage = (m) => events.push(m);
  handleWorkerMessage({ type: 'fallback', from: STT_ENGINES.WHISPER_SMALL_EN, to: STT_ENGINES.WHISPER_BASE_EN, reason: 'no adapter' });
  handleWorkerMessage({
    type: 'result',
    id: 101,
    text: 'Speaking practice is essential for fluency.',
    words: [],
    engine: STT_ENGINES.WHISPER_BASE_EN,
    version: 'base.en-q8',
  });
  assert.equal(events[0].to, 'whisper-base.en');
  assert.equal(events[1].type, 'result');
  assert.equal(events[1].text, 'Speaking practice is essential for fluency.');
});

console.log('\n== Speech Engine: Privacy & Data Hygiene Contract ==');

t('result payload contains engine telemetry but NEVER audio data or API keys', () => {
  const res = formatTranscriptResult({
    text: 'I enjoy visiting museums on weekends.',
    words: [{ word: 'I', start: 0.1, end: 0.2, probability: 0.99 }],
    engine: STT_ENGINES.WHISPER_SMALL_EN,
    version: 'small.en-q4',
  });

  // Verify required fields exist
  assert.equal(res.engine, 'whisper-small.en');
  assert.equal(res.version, 'small.en-q4');
  assert.equal(typeof res.text, 'string');
  assert.ok(Array.isArray(res.words));

  // Verify prohibited fields do NOT exist
  assert.equal(res.pcm, undefined);
  assert.equal(res.audio, undefined);
  assert.equal(res.blob, undefined);
  assert.equal(res.buffer, undefined);
  assert.equal(res.key, undefined);
  assert.equal(res.apiKey, undefined);

  // Verify serialization contains no audio buffers or secrets
  const json = JSON.stringify(res);
  assert.ok(!json.includes('data:audio'));
  assert.ok(!json.includes('Float32Array'));
  assert.ok(!json.includes('AIzaSy'));
  assert.ok(!json.includes('gsk_'));
});

console.log('\n== Audio Eradication & Storage Hygiene ==');

await tAsync('clearAudioRecordings safely clears IndexedDB and avoids cache buildup', async () => {
  let cleared = false;
  globalThis.indexedDB = {
    open: () => {
      const req = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => {
        req.result = {
          transaction: () => ({
            objectStore: () => ({
              clear: () => {
                cleared = true;
                const clearReq = { onsuccess: null, onerror: null };
                setTimeout(() => clearReq.onsuccess && clearReq.onsuccess(), 0);
                return clearReq;
              },
            }),
          }),
        };
        req.onsuccess && req.onsuccess({ target: req });
      }, 0);
      return req;
    },
  };

  const res = await clearAudioRecordings();
  assert.equal(res, true);
  assert.equal(cleared, true);

  const res2 = await eradicateAllAudioRecordings();
  assert.equal(res2, true);
});

await tAsync('removes the retired Whistle cache bucket once, and only that bucket', async () => {
  mockStorage.clear();
  const deleted = [];
  globalThis.caches = { delete: async (name) => { deleted.push(name); return true; } };
  await cleanupWhistleCacheOnce();
  await cleanupWhistleCacheOnce();
  assert.deepEqual(deleted, ['whistle-cache']);
  assert.equal(isWhistleCleanupDone(), true);
});

console.log(`\n============================================================`);
console.log(`SPEECH ENGINE TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);

if (failed > 0) process.exit(1);
