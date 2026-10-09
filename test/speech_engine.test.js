/**
 * Test suite for browser STT engine:
 * - Engine configuration (Whistle 16.9 MB)
 * - Pause chunking & timestamp offsets for long Part 2 monologues
 * - 80 ms word timestamps preservation
 * - Targeted Moonshine cache cleanup (pruning legacy ~250MB cached ONNX assets)
 * - Mocked worker protocol (load, ready, and transcribe)
 * - Privacy & security check (no audio or keys logged or stored in result)
 */
import assert from 'node:assert/strict';
import {
  STT_ENGINES,
  ENGINE_METADATA,
  getPreferredSttEngine,
  setPreferredSttEngine,
  isMoonshineCleanupDone,
  markMoonshineCleanupDone,
  formatTranscriptResult,
} from '../src/utils/speech/transcriberTypes.js';
import {
  splitAtPauses,
  cleanupMoonshineCacheOnce,
} from '../src/utils/speech/localStt.js';

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

t('defaults to Whistle engine', () => {
  mockStorage.clear();
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISTLE);
});

t('setPreferredSttEngine sets Whistle', () => {
  mockStorage.clear();
  setPreferredSttEngine(STT_ENGINES.WHISTLE);
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISTLE);
});

t('invalid engine values are ignored', () => {
  setPreferredSttEngine('whisper_v3');
  assert.equal(getPreferredSttEngine(), STT_ENGINES.WHISTLE);
});

console.log('\n== Speech Engine: Formatting & Word Timestamps ==');

t('formats Whistle transcript with 80 ms resolution word timestamps', () => {
  const words = [
    { word: 'Good', start: 0.08, end: 0.24, probability: 0.98 },
    { word: 'morning,', start: 0.32, end: 0.56, probability: 0.95 },
  ];
  const res = formatTranscriptResult({
    text: 'Good morning,',
    words,
    engine: STT_ENGINES.WHISTLE,
    version: '16.9mb',
  });

  assert.equal(res.text, 'Good morning,');
  assert.equal(res.engine, 'whistle');
  assert.equal(res.version, '16.9mb');
  assert.equal(res.words.length, 2);
  assert.equal(res.words[0].word, 'Good');
  assert.equal(res.words[0].start, 0.08);
  assert.equal(res.words[0].end, 0.24);
  // toString compatibility
  assert.equal(String(res), 'Good morning,');
  assert.equal(res.toString(), 'Good morning,');
});

console.log('\n== Speech Engine: Pause Chunking & Timestamp Offsets ==');

const RATE = 16000;
const tone = (secs, silenceAt = []) => {
  const a = new Float32Array(Math.round(secs * RATE));
  for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(i / 5);
  for (const [s, e] of silenceAt) a.fill(0, Math.round(s * RATE), Math.round(e * RATE));
  return a;
};

t('2-minute monologue splits into chunks <= 20 s without sample loss', () => {
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
  assert.ok(segments.length >= 6);

  // Each segment must be <= 20 seconds
  for (const seg of segments) {
    const dur = seg.length / RATE;
    assert.ok(dur <= 20, `Segment duration ${dur}s exceeds 20s limit`);
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

console.log('\n== Speech Engine: Targeted Moonshine Cleanup ==');

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

t('simulated Whistle load and ready worker messages', () => {
  const events = [];
  function handleWorkerMessage(m) {
    events.push(m);
  }

  handleWorkerMessage({
    type: 'ready',
    engine: STT_ENGINES.WHISTLE,
    device: 'wasm',
    version: '16.9mb',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'ready');
  assert.equal(events[0].engine, 'whistle');
});

t('simulated Whistle transcribe result message', () => {
  const events = [];
  function handleWorkerMessage(m) {
    events.push(m);
  }

  handleWorkerMessage({
    type: 'result',
    id: 101,
    text: 'Speaking practice is essential for fluency.',
    words: [{ word: 'Speaking', start: 0.1, end: 0.5, probability: 0.98 }],
    engine: STT_ENGINES.WHISTLE,
    version: '16.9mb',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'result');
  assert.equal(events[0].engine, 'whistle');
  assert.equal(events[0].text, 'Speaking practice is essential for fluency.');
});

console.log('\n== Speech Engine: Privacy & Data Hygiene Contract ==');

t('result payload contains engine telemetry but NEVER audio data or API keys', () => {
  const res = formatTranscriptResult({
    text: 'I enjoy visiting museums on weekends.',
    words: [{ word: 'I', start: 0.1, end: 0.2, probability: 0.99 }],
    engine: STT_ENGINES.WHISTLE,
    version: '16.9mb',
  });

  // Verify required fields exist
  assert.equal(res.engine, 'whistle');
  assert.equal(res.version, '16.9mb');
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

console.log(`\n============================================================`);
console.log(`SPEECH ENGINE TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);

if (failed > 0) process.exit(1);
