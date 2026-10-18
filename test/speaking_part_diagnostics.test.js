import assert from 'node:assert/strict';
import {
  SPEAKING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_COMPACT, normalizeSpeakingEvaluation,
} from '../src/utils/ieltsRubric.js';

const transcripts = {
  '0_0': 'I I like my home because it is near my family.',
  '1_0': 'The journey was difficult because we were late and lost.',
  '2_0': 'Governments should build it and it and it helps the city.',
};
const criterion = band => ({ band, personalizedAssessment: 'Ideas need clearer support.', corrections: [], nextBandAdvice: 'Develop one example.' });
const raw = (partDiagnostics = {}) => ({
  criteria: {
    fluencyAndCoherence: criterion(5), lexicalResource: criterion(5), grammaticalRangeAndAccuracy: criterion(5),
  },
  partDiagnostics,
});
const diagnostic = (evidence, needsPractice = true) => ({
  needsPractice, evidence, reason: 'The answer repeats language without developing its point.', nextAction: 'Give a reason, then one concrete example.',
});
const complete = {
  part1: diagnostic('I I like my home'),
  part2: diagnostic('we were late and lost'),
  part3: diagnostic('and it and it'),
};
let checks = 0;
function test(name, run) {
  run();
  checks++;
  console.log(`✓ ${name}`);
}

test('full and compact prompts explicitly request the same evidence-backed per-part JSON contract', () => {
  for (const prompt of [SPEAKING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_COMPACT]) {
    assert(prompt.includes('one partDiagnostics entry for EVERY attempted part; omit unanswered parts'));
    assert(prompt.includes('Equal weaknesses can make all attempted parts true'));
    assert(prompt.includes('contiguous quote from a candidate ANSWER in THAT part'));
    const schemaText = /"partDiagnostics":\s*(\{[^\n]+\}),\s*"partFeedback"/.exec(prompt)?.[1];
    assert(schemaText, 'The output JSON example must actually include diagnostics, not just mention it in prose.');
    const schema = JSON.parse(schemaText);
    assert.deepEqual(Object.keys(schema), ['part1', 'part2', 'part3']);
    for (const entry of Object.values(schema)) {
      assert.equal(typeof entry.needsPractice, 'boolean');
      for (const field of ['evidence', 'reason', 'nextAction']) assert.equal(typeof entry[field], 'string');
      assert(!Object.hasOwn(entry, 'band'));
    }
  }
});

test('equally weak attempted parts remain independently eligible and never become invented part bands', () => {
  const result = normalizeSpeakingEvaluation(raw(complete), { transcripts });
  assert.equal(result.overallBand, 5);
  assert.deepEqual(Object.keys(result.partDiagnostics), ['part1', 'part2', 'part3']);
  for (const entry of Object.values(result.partDiagnostics)) {
    assert.equal(entry.needsPractice, true);
    assert(!Object.hasOwn(entry, 'band'));
  }
  assert.equal(result.criteria.pronunciation.band, null);
});

test('a supported no-practice observation remains false independently of the interview band', () => {
  const result = normalizeSpeakingEvaluation(raw({ part1: diagnostic('it is near my family', false) }), { transcripts });
  assert.equal(result.partDiagnostics.part1.needsPractice, false);
  assert.equal(result.overallBand, 5);
});

test('missing diagnostics preserve a valid grade while malformed diagnostics cannot masquerade as healthy parts', () => {
  const missing = normalizeSpeakingEvaluation(raw());
  assert.equal(missing.overallBand, 5);
  assert.deepEqual(missing.partDiagnostics, {});
  const invalidEntries = [
    { ...complete.part1, needsPractice: undefined },
    { ...complete.part1, needsPractice: 'false' },
    { ...complete.part1, evidence: '  ' },
    { ...complete.part1, reason: '' },
    { ...complete.part1, nextAction: 17 },
    [],
  ];
  for (const entry of invalidEntries) {
    const result = normalizeSpeakingEvaluation(raw({ part1: entry }), { transcripts });
    assert.equal(result.overallBand, 5);
    assert.deepEqual(result.partDiagnostics, {});
  }
});

test('quote validation rejects wrong-part evidence, invented wording and unanswered parts', () => {
  const result = normalizeSpeakingEvaluation(raw({
    part1: diagnostic(transcripts['1_0']),
    part2: diagnostic('the train arrived comfortably on time'),
    part3: diagnostic(transcripts['2_0']),
  }), { transcripts: { '0_0': transcripts['0_0'], '1_0': transcripts['1_0'] } });
  assert.deepEqual(result.partDiagnostics, {});
  assert.equal(result.overallBand, 5);
});

test('quotes cannot be manufactured across separate answers and numeric part bands are discarded', () => {
  const separate = { '0_0': 'I enjoy cycling', '0_1': 'around the park.' };
  const crossQuestion = normalizeSpeakingEvaluation(raw({ part1: diagnostic('cycling around') }), { transcripts: separate });
  assert.deepEqual(crossQuestion.partDiagnostics, {});
  const result = normalizeSpeakingEvaluation(raw({ part1: { ...complete.part1, band: 5 }, part4: complete.part1 }), { transcripts });
  assert.deepEqual(Object.keys(result.partDiagnostics), ['part1']);
  assert(!Object.hasOwn(result.partDiagnostics.part1, 'band'));
});

console.log(`\n${checks} speaking part diagnostic checks passed.`);
