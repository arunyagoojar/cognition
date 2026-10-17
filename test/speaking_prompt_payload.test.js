import assert from 'node:assert/strict';
import { buildSpeakingUserPrompt } from '../src/utils/ieltsRubric.js';

let checks = 0;
function test(name, run) {
  run();
  checks++;
  console.log(`✓ ${name}`);
}

test('a complete 19-question interview keeps every full question and answer with compact metadata', () => {
  const keys = Array.from({ length: 19 }, (_, i) => i < 9 ? `0_${i}` : i === 9 ? '1_0' : `2_${i - 10}`);
  const speech = 'Um I I think that public transport is important because it connects people to work and education. You know, when I was growing up my family used the bus every day, and this helped us save money. Actually no, we sometimes walked when the weather was pleasant.';
  const transcripts = Object.fromEntries(keys.map((key, i) => [key, `Answer ${i + 1}. ${Array.from({ length: key === '1_0' ? 6 : 2 }, () => speech).join(' ')}`]));
  const questions = Object.fromEntries(keys.map((key, i) => [key, `Question ${i + 1}: How does the way you travel affect your daily life and what would you change about it?`]));
  const testMeta = { title: 'Transport interview', cueCard: 'Describe a journey you remember. Explain where you went and why it was memorable.', questions };
  const payload = { transcripts, testMeta, durations: Object.fromEntries(keys.map(key => [key, key === '1_0' ? 120 : 35])) };
  const before = structuredClone(payload);
  const prompt = buildSpeakingUserPrompt(payload);

  for (const key of keys) {
    assert(prompt.includes(transcripts[key]), `The full answer for ${key} must remain intact.`);
    assert(prompt.includes(questions[key]), `The actual question for ${key} must remain intact.`);
  }
  assert(prompt.includes(testMeta.cueCard));
  assert.equal((prompt.match(/^### Part /gm) || []).length, 19);
  assert.equal((prompt.match(/^Delivery: /gm) || []).length, 19);
  const evidenceBytes = Buffer.byteLength([...Object.values(transcripts), ...Object.values(questions), testMeta.title, testMeta.cueCard].join('\n'));
  const overheadBytes = Buffer.byteLength(prompt) - evidenceBytes;
  // Repeating the old prose labels for every answer added over 4 KB. This bound
  // reserves room for headings and all metrics without trading away speech.
  assert(overheadBytes < 2100, `Interview metadata should stay compact, got ${overheadBytes} bytes.`);
  assert.deepEqual(payload, before);
});

test('delivery compaction keeps duration, pace, pause, filler, repeat and correction evidence', () => {
  const prompt = buildSpeakingUserPrompt({
    transcripts: { '0_0': 'Um, I I prefer local buses.\nYou know, I mean, they save time.' },
    durations: { '0_0': 10 },
    speechMeta: { '0_0': { segments: [{ start: 0, end: 3 }, { start: 5.5, end: 10 }] } },
  });
  assert(prompt.includes('Delivery columns: words | seconds | words/min (n/a if unavailable) | pauses | pauses >=2s | longest pause(s) | um/uh | filler phrases | repetitions | self-corrections.'));
  assert(prompt.includes('Delivery: 13 | 10 | 78 | 1 | 1 | 2.5 | 1 | 2 | 1 | 1'));
  assert(prompt.includes('Um, I I prefer local buses.\n[pause 2.5s]\nYou know, I mean, they save time.'));
});

test('marked recognition corrections preserve corrected wording and original delivery evidence', () => {
  const prompt = buildSpeakingUserPrompt({
    transcripts: { '2_0': 'I think local buses save time.' },
    durations: { '2_0': 10 },
    speechMeta: { '2_0': { originalText: 'Um I I think local buses save time.', durationSec: 10 } },
  });
  assert(prompt.includes('I think local buses save time.'));
  assert(prompt.includes('Recognition corrections marked; delivery uses the original transcript.'));
  assert(prompt.includes('Delivery: 8 | 10 | 48 | 0 | 0 | 0 | 1 | 0 | 1 | 0'));
});

test('unavailable pace is explicit and raw recognition transport data never enters the prompt', () => {
  const payload = {
    transcripts: { '0_0': 'I enjoy travelling by bus.' },
    speechMeta: {
      '0_0': {
        originalText: 'I enjoy travelling by bus.',
        words: Array.from({ length: 5000 }, () => ({ word: 'RAW_WORD_METADATA_SENTINEL', start: 1, end: 2, confidence: 0.9 })),
        segments: [{ text: 'DUPLICATED_SEGMENT_TEXT_SENTINEL', start: 0, end: 2 }],
      },
    },
  };
  const prompt = buildSpeakingUserPrompt(payload);
  assert(prompt.includes('Delivery: 5 | 2 | n/a'));
  assert(!prompt.includes('RAW_WORD_METADATA_SENTINEL'));
  assert(!prompt.includes('DUPLICATED_SEGMENT_TEXT_SENTINEL'));
  assert.equal(prompt, buildSpeakingUserPrompt({ ...payload, speechMeta: { '0_0': { ...payload.speechMeta['0_0'], words: [] } } }));
});

console.log(`\n${checks} speaking prompt payload checks passed.`);
