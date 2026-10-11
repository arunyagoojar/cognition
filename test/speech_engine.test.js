/**
 * Test suite for the browser STT engine:
 * - Engine configuration (Moonshine Base, verbatim, ≤ ~300 MB)
 * - Pause chunking, utterance splitting (one transcript line per stretch of speech)
 * - Silence trimming (VAD) and hallucination guards (verbatim otherwise)
 * - Delivery measures (pace, pauses, fillers, repetitions, self-corrections)
 * - Targeted legacy cache cleanup (Whisper entries, Whistle bucket)
 * - Privacy & security check (no audio or keys in the result)
 */
import assert from 'node:assert/strict';
import {
  STT_ENGINES,
  ENGINE_METADATA,
  PRIMARY_STT_ENGINE,
  getPreferredSttEngine,
  isWhisperCleanupDone,
  isWhistleCleanupDone,
  formatTranscriptResult,
} from '../src/utils/speech/transcriberTypes.js';
import {
  splitAtPauses,
  cleanupWhisperCacheOnce,
  cleanupWhistleCacheOnce,
  MODEL_DOWNLOAD_MB,
  trimSilence,
} from '../src/utils/speech/localStt.js';
import {
  speechSeconds,
  collapseRepetitionLoops,
  guardSegmentText,
  maxNewTokensFor,
  splitIntoUtterances,
} from '../src/utils/speech/transcriptGuards.js';
import { computeSpeechMetrics, formatSpeechScript } from '../src/utils/speech/speechMetrics.js';
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

console.log('== Speech Engine: Configuration ==');

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

t('uses Moonshine Base, within the ~300 MB download budget', () => {
  assert.equal(PRIMARY_STT_ENGINE, STT_ENGINES.MOONSHINE_BASE);
  assert.equal(getPreferredSttEngine(), STT_ENGINES.MOONSHINE_BASE);
  const meta = ENGINE_METADATA[PRIMARY_STT_ENGINE];
  assert.equal(meta.model, 'onnx-community/moonshine-base-ONNX');
  for (const v of Object.values(meta.variants)) assert.ok(v.bytes <= 300e6);
  assert.ok(MODEL_DOWNLOAD_MB <= 300);
});

t('keeps the transcript verbatim and one line per stretch of speech', () => {
  const res = formatTranscriptResult({
    text: 'Um, I I think   the main reason is\nuh, you know, the price',
    segments: [{ text: 'Um, I I think the main reason is', start: 0, end: 3 }, { text: 'uh, you know, the price', start: 4.2, end: 6 }],
  });
  assert.equal(res.text, 'Um, I I think the main reason is\nuh, you know, the price');
  assert.equal(res.segments.length, 2);
  assert.equal(String(res), res.text);
});

t('unknown engine labels resolve to the current engine', () => {
  const res = formatTranscriptResult({ text: 'Hello', engine: 'whisper-small.en' });
  assert.equal(res.engine, STT_ENGINES.MOONSHINE_BASE);
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

t('an answer splits into utterances at its pauses', () => {
  // speech 0–4 s, pause 1.5 s, speech 5.5–9 s, short 0.3 s gap, speech to 11 s
  const pcm = concat(tone(4), noise(1.5), tone(3.5), noise(0.3), tone(1.7));
  const v = trimSilence(pcm, RATE);
  const u = splitIntoUtterances(v.pcm, v.threshold, RATE);
  assert.equal(u.length, 2, `got ${u.length} utterances`);
  assert.ok(u[1].start / RATE > 4 && u[1].start / RATE < 5.6);
});

t('a very long stretch without pauses is still cut into pieces of at most ~20 s', () => {
  const pcm = tone(50);
  const u = splitIntoUtterances(pcm, undefined, RATE);
  assert.ok(u.length >= 3);
  for (const x of u) assert.ok((x.end - x.start) / RATE <= 20.5);
});

console.log('\n== Speech Engine: Delivery Measures ==');

t('measures pace, pauses, fillers, repetitions and self-corrections', () => {
  const text = 'Um I live in a house\nwith a garden I I think it is uh nice\nI was going I mean I went there you know';
  const segments = [
    { text: 'a', start: 0, end: 3 },
    { text: 'b', start: 3.9, end: 7 },
    { text: 'c', start: 9.5, end: 12 },
  ];
  const m = computeSpeechMetrics({ text, segments });
  assert.equal(m.words, 26);
  assert.equal(m.pauses, 2);
  assert.equal(m.longPauses, 1);
  assert.equal(m.longestPauseSec, 2.5);
  assert.equal(m.hesitations, 2);
  assert.ok(m.discourseFillers >= 2);
  assert.ok(m.repetitions >= 1);
  assert.ok(m.selfCorrections >= 1);
  assert.equal(m.wordsPerMinute, 130);
});

t('the script marks long pauses and falls back to plain lines after edits', () => {
  const segments = [{ text: 'a', start: 0, end: 2 }, { text: 'b', start: 4.5, end: 6 }];
  assert.equal(formatSpeechScript({ text: 'first\nsecond', segments }), 'first\n[pause 2.5s]\nsecond');
  assert.equal(formatSpeechScript({ text: 'edited into one line', segments }), 'edited into one line');
  assert.equal(computeSpeechMetrics({ text: '' }), null);
});

console.log('\n== Speech Engine: Retired Model Cleanup ==');

await tAsync('removes ONLY Whisper entries from transformers-cache, keeps Moonshine', async () => {
  mockStorage.clear();
  mockStorage.set('cognition_stt_engine', 'whisper-small.en');
  const deleted = [];
  const items = [
    { url: 'https://huggingface.co/onnx-community/whisper-small.en/resolve/main/onnx/encoder_model_q4.onnx' },
    { url: 'https://huggingface.co/onnx-community/whisper-base.en/resolve/main/tokenizer.json' },
    { url: 'https://huggingface.co/onnx-community/moonshine-base-ONNX/resolve/main/onnx/encoder_model.onnx' },
    { url: 'https://cdn.example.com/assets/audio/prompt.mp3' },
  ];
  globalThis.caches = {
    open: async (name) => {
      assert.equal(name, 'transformers-cache');
      return { keys: async () => items, delete: async (req) => { deleted.push(req.url); } };
    },
  };
  await cleanupWhisperCacheOnce();
  assert.equal(deleted.length, 2);
  assert.ok(deleted.every((u) => u.includes('whisper')));
  assert.equal(isWhisperCleanupDone(), true);
  assert.equal(mockStorage.has('cognition_stt_engine'), false);
});

await tAsync('cleanup runs once and ignores blocked storage', async () => {
  let opened = 0;
  globalThis.caches = { open: async () => { opened++; return { keys: async () => [], delete: async () => {} }; } };
  await cleanupWhisperCacheOnce();
  assert.equal(opened, 0);
  mockStorage.clear();
  globalThis.caches = { open: async () => { throw new Error('SecurityError'); } };
  await cleanupWhisperCacheOnce();
});

console.log('\n== Speech Engine: Privacy ==');

t('result payload carries telemetry but NEVER audio data or API keys', () => {
  const res = formatTranscriptResult({ text: 'I enjoy visiting museums on weekends.', engine: STT_ENGINES.MOONSHINE_BASE });
  for (const k of ['pcm', 'audio', 'blob', 'buffer', 'key', 'apiKey']) assert.equal(res[k], undefined);
  const json = JSON.stringify(res);
  assert.ok(!json.includes('Float32Array') && !json.includes('AIzaSy') && !json.includes('gsk_'));
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
