import assert from 'node:assert/strict';
import {
  RUBRIC_VERSION, SPEAKING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_COMPACT,
  buildSpeakingUserPrompt, normalizeSpeakingEvaluation,
} from '../src/utils/ieltsRubric.js';
import { prepareRequestBudget } from '../src/utils/ai/requestBudget.js';

const keys = ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'];
const transcripts = {
  '0_0': 'I live near the river and enjoy walking there with friends.',
  '1_0': 'The trip was exciting because we discovered a quiet village.',
  '2_0': 'The government should invest in reliable public transport for everyone.',
};
const qualitative = part => ({
  needsPractice: true,
  evidence: transcripts[`${part - 1}_0`].split(' ').slice(0, 5).join(' '),
  reason: 'The example needs more explanation.',
  nextAction: 'Explain one cause and its effect.',
});
const partCriteria = (part, bands) => Object.fromEntries(keys.map((key, i) => [key, {
  band: bands[i],
  evidence: transcripts[`${part - 1}_0`].split(' ').slice(i, i + 5).join(' '),
  feedback: `Develop this ${key === 'lexicalResource' ? 'word choice' : 'idea'} more precisely.`,
}]));
const raw = partDiagnostics => ({
  criteria: Object.fromEntries(keys.map(key => [key, { band: 6, personalizedAssessment: 'The interview communicates relevant ideas.', corrections: [], nextBandAdvice: 'Support one example.' }])),
  partDiagnostics,
});
let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log(`✓ ${name}`);
}

await test('both prompts require three independent criteria per attempted part and identify practice estimates', () => {
  assert.equal(RUBRIC_VERSION, 'ielts-rubric-2.7');
  for (const prompt of [SPEAKING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_COMPACT]) {
    assert(prompt.includes('PART PRACTICE estimates, not official IELTS part scores'));
    assert(prompt.includes('Never copy whole-interview grades into parts'));
    assert(prompt.includes('never compute practiceBand; code averages the three criteria'));
    assert(prompt.includes('feedback names its specific limitation or strength in at most 12 words'));
    const schema = JSON.parse(/"partDiagnostics":\s*(\{[^\n]+\}),\s*"partFeedback"/.exec(prompt)[1]);
    for (const part of ['part1', 'part2', 'part3']) {
      assert.deepEqual(Object.keys(schema[part].criteria), keys);
      for (const criterion of Object.values(schema[part].criteria)) {
        assert(Number.isInteger(criterion.band));
        assert.equal(typeof criterion.evidence, 'string');
        assert.equal(typeof criterion.feedback, 'string');
      }
      assert.equal(schema[part].practiceBand, undefined);
    }
  }
});

await test('part practice averages are computed from that part only and never change the overall grade', () => {
  const result = normalizeSpeakingEvaluation(raw({
    part1: { ...qualitative(1), criteria: partCriteria(1, [8, 7, 8]), practiceBand: 0 },
    part2: { ...qualitative(2), criteria: partCriteria(2, [5, 6, 5]), practiceBand: 9 },
    part3: { ...qualitative(3), criteria: partCriteria(3, [7, 7, 7]), practiceBand: 1 },
  }), { transcripts });
  assert.equal(result.overallBand, 6);
  assert.equal(result.partDiagnostics.part1.practiceBand, 7.5);
  assert.equal(result.partDiagnostics.part2.practiceBand, 5.5);
  assert.equal(result.partDiagnostics.part3.practiceBand, 7);
  assert.equal(result.criteria.pronunciation.band, null);
  assert.deepEqual(Object.values(result.partDiagnostics.part2.criteria).map(criterion => criterion.band), [5, 6, 5]);
});

await test('valid numeric criteria survive missing legacy qualitative fields', () => {
  const result = normalizeSpeakingEvaluation(raw({
    part2: { criteria: partCriteria(2, [5, 6, 5]), practiceBand: 9 },
  }), { transcripts });
  const part = result.partDiagnostics.part2;
  assert.equal(part.practiceBand, 5.5);
  assert.equal(part.needsPractice, true);
  assert.equal(part.evidence, part.criteria.fluencyAndCoherence.evidence);
  assert.equal(part.reason, part.criteria.fluencyAndCoherence.feedback);
  assert.equal(part.nextAction, '');
  assert.equal(normalizeSpeakingEvaluation(raw({ part1: { criteria: partCriteria(1, [8, 7, 8]) } }), { transcripts }).partDiagnostics.part1.needsPractice, false);
});

await test('missing, fractional, out-of-range or string criterion grades cannot produce a part practice estimate', () => {
  for (const invalid of [undefined, null, 5.5, -1, 10, '6']) {
    const criteria = partCriteria(2, [5, 6, 5]);
    criteria.lexicalResource.band = invalid;
    const result = normalizeSpeakingEvaluation(raw({ part2: { ...qualitative(2), criteria, practiceBand: 9 } }), { transcripts });
    assert.equal(result.partDiagnostics.part2.criteria, undefined);
    assert.equal(result.partDiagnostics.part2.practiceBand, undefined);
    assert.equal(result.partDiagnostics.part2.evidence, qualitative(2).evidence);
    assert.equal(result.overallBand, 6);
  }
  const incomplete = partCriteria(2, [5, 6, 5]);
  delete incomplete.grammaticalRangeAndAccuracy;
  assert.equal(normalizeSpeakingEvaluation(raw({ part2: { ...qualitative(2), criteria: incomplete } }), { transcripts }).partDiagnostics.part2.criteria, undefined);
});

await test('each criterion needs a quote from the correct actual part and usable feedback', () => {
  for (const mutation of [
    criterion => { criterion.evidence = transcripts['0_0']; },
    criterion => { criterion.evidence = 'This quote was invented.'; },
    criterion => { criterion.feedback = ''; },
    criterion => { criterion.evidence = ''; },
  ]) {
    const criteria = partCriteria(2, [5, 6, 5]);
    mutation(criteria.lexicalResource);
    const result = normalizeSpeakingEvaluation(raw({ part2: { ...qualitative(2), criteria } }), { transcripts });
    assert.equal(result.partDiagnostics.part2.criteria, undefined);
    assert.equal(result.partDiagnostics.part2.practiceBand, undefined);
  }
  const absentPart = normalizeSpeakingEvaluation(raw({ part2: { criteria: partCriteria(2, [5, 6, 5]) } }), { transcripts: { '0_0': transcripts['0_0'] } });
  assert.equal(absentPart.partDiagnostics.part2, undefined);
});

await test('qualitative legacy results never inherit numeric whole-interview grades or pronunciation grades', () => {
  const result = normalizeSpeakingEvaluation(raw({ part2: qualitative(2) }), { transcripts });
  assert.equal(result.partDiagnostics.part2.criteria, undefined);
  assert.equal(result.partDiagnostics.part2.practiceBand, undefined);
  const criteria = { ...partCriteria(2, [0, 0, 0]), pronunciation: { band: 9, evidence: 'invented audio evidence', feedback: 'Invented.' } };
  const withExtra = normalizeSpeakingEvaluation(raw({ part2: { criteria } }), { transcripts });
  assert.equal(withExtra.partDiagnostics.part2.practiceBand, 0);
  assert.equal(withExtra.partDiagnostics.part2.criteria.pronunciation, undefined);
  // Legacy unit callers may normalize shaped data before transcripts are available.
  assert.equal(normalizeSpeakingEvaluation(raw({ part2: { criteria: partCriteria(2, [5, 6, 5]) } })).partDiagnostics.part2.practiceBand, 5.5);
});

await test('a full 2,057-word interview retains every answer and at least 2,000 Groq output tokens', async () => {
  const phrase = 'Um I think reliable transport improves access to employment and education although some neighbourhoods still need more frequent services and safer connections.'.split(' ');
  const questionKeys = Array.from({ length: 19 }, (_, i) => i < 9 ? `0_${i}` : i === 9 ? '1_0' : `2_${i - 10}`);
  const counts = [...Array(9).fill(60), 250, ...Array(8).fill(140), 147];
  const answers = Object.fromEntries(questionKeys.map((key, i) => [key, Array.from({ length: counts[i] }, (_, j) => phrase[j % phrase.length]).join(' ')]));
  assert.equal(Object.values(answers).join(' ').split(/\s+/).length, 2057);
  const prompt = buildSpeakingUserPrompt({
    transcripts: answers,
    testMeta: { title: 'Urban transport interview', cueCard: 'Describe a memorable journey. Explain the destination, companions, events and why you remember it.', questions: Object.fromEntries(questionKeys.map(key => [key, 'How does transport affect life in your city, and what changes would help people?'])) },
    durations: Object.fromEntries(questionKeys.map(key => [key, key === '1_0' ? 120 : 45])),
  });
  for (const answer of Object.values(answers)) assert(prompt.includes(answer));
  const budget = await prepareRequestBudget('groq', SPEAKING_SYSTEM_PROMPT_COMPACT, prompt, { model: 'openai/gpt-oss-120b' });
  assert(budget.ok);
  assert(budget.outputTokens >= 2000);
  assert(budget.inputTokens + budget.outputTokens <= 7600);
  console.log(`  Synthetic interview budget: ${budget.inputTokens} input + ${budget.outputTokens} output.`);
});

console.log(`\n${checks} speaking part criteria contract checks passed.`);
