import assert from 'node:assert/strict';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';
import { getPerformanceStore, hydrateFromRemoteAttempts } from '../src/utils/performanceStore.js';

let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log(`✓ ${name}`);
}

const quotes = [
  'I live in a apartment.',
  'We was travelling to the mountains.',
  'Public transport make cities cleaner.',
];
const transcripts = {
  '0_0': `${quotes[0]} I enjoy my neighbourhood because my friends live nearby.`,
  '1_0': `${quotes[1]} I remember the train crossing a long bridge.`,
  '2_0': `${quotes[2]} The government should invest in services that everybody can use.`,
};
const corrections = [
  { original: quotes[0], alternative: 'I live in an apartment.', explanation: 'Use an before a vowel sound.' },
  { original: quotes[1], alternative: 'We were travelling to the mountains.', explanation: 'Use were with we.' },
  { original: quotes[2], alternative: 'Public transport makes cities cleaner.', explanation: 'Use a singular verb with transport.' },
];
const criteria = (band = 5) => ({
  fluencyAndCoherence: { band, personalizedAssessment: 'Develop the supporting explanation.', corrections: [], nextBandAdvice: 'Extend the main point with one example.' },
  lexicalResource: { band, personalizedAssessment: 'Use more precise topic vocabulary.', corrections: [], nextBandAdvice: 'Practise paraphrasing one key phrase.' },
  grammaticalRangeAndAccuracy: { band, personalizedAssessment: 'Agreement and article errors recur.', corrections: structuredClone(corrections), nextBandAdvice: 'Practise the corrected sentence patterns in a new answer.' },
  pronunciation: { status: 'not_assessed', band: null, corrections: [] },
});
const diagnostics = (flags = [true, true, true]) => Object.fromEntries(flags.map((needsPractice, i) => [`part${i + 1}`, {
  needsPractice,
  reason: needsPractice ? 'Agreement or article errors affect this response.' : 'This part develops the answer clearly.',
  evidence: quotes[i],
  nextAction: 'Record a fresh response using the corrected sentence pattern.',
}]));
const attempt = (speaking = {}, extra = {}) => ({
  id: 'completed-speaking', type: 'speaking', testId: 100, status: 'completed',
  completedAt: '2026-10-17T22:00:00.000Z',
  speaking: { band: 5, bandEligible: true, coverage: { isComplete: true }, transcripts: structuredClone(transcripts), criteria: criteria(), ...speaking },
  ...extra,
});
const parts = model => model.recommendations.filter(rec => rec.skill === 'speaking').map(rec => rec.part).sort();

function assertNoInventedPartBands(model) {
  for (const rec of model.recommendations.filter(item => item.skill === 'speaking')) {
    assert.equal(rec.kind, 'section');
    assert(!Object.hasOwn(rec, 'band'), 'Whole-interview criterion scores cannot become invented part bands.');
    assert.equal(rec.testId, 100);
    assert.equal(rec.sourceAttemptId, 'completed-speaking');
    assert(transcripts[`${rec.part - 1}_0`].includes(rec.evidence), 'The recommendation needs evidence from the indicated part.');
  }
}

check('all three equally weak speaking parts produce specific practice recommendations', () => {
  const original = attempt({ partDiagnostics: diagnostics() });
  const before = structuredClone(original);
  const model = buildPracticeInsights([original]);
  assert.deepEqual(parts(model), [1, 2, 3]);
  assert(model.bySkill.speaking.hasDetailedResults);
  assert(!model.missingDetailedSkills.includes('speaking'));
  assertNoInventedPartBands(model);
  assert.deepEqual(original, before);
});

check('saved criterion corrections recover weak parts when AI omitted part diagnostics', () => {
  const original = attempt({ partDiagnostics: {} });
  const before = structuredClone(original);
  const model = buildPracticeInsights([original]);
  assert.deepEqual(parts(model), [1, 2, 3]);
  assert(model.bySkill.speaking.hasDetailedResults);
  assertNoInventedPartBands(model);
  assert.deepEqual(original, before);
});

check('a correction from Part 2 recommends only Part 2', () => {
  const limitedCriteria = criteria();
  limitedCriteria.grammaticalRangeAndAccuracy.corrections = [corrections[1]];
  const model = buildPracticeInsights([attempt({ criteria: limitedCriteria })]);
  assert.deepEqual(parts(model), [2]);
  assertNoInventedPartBands(model);
});

check('criterion evidence and corrections locate Parts 1 and 3 without inventing a Part 2 weakness', () => {
  const located = criteria();
  located.fluencyAndCoherence.evidence = transcripts['0_0'];
  located.lexicalResource.corrections = [corrections[0]];
  located.grammaticalRangeAndAccuracy.corrections = [corrections[2]];
  const model = buildPracticeInsights([attempt({ criteria: located, partDiagnostics: {} })]);
  assert.deepEqual(parts(model), [1, 3]);
  assertNoInventedPartBands(model);
});

check('quote matching normalizes typography without fuzzy matching or partial words', () => {
  const normalized = criteria();
  normalized.grammaticalRangeAndAccuracy.corrections = [{
    ...corrections[1],
    original: 'ＷＥ   ＷＡＳ ＴＲＡＶＥＬＬＩＮＧ ＴＯ ＴＨＥ ＭＯＵＮＴＡＩＮＳ!',
  }];
  assert.deepEqual(parts(buildPracticeInsights([attempt({ criteria: normalized })])), [2]);
  for (const original of ['We went travelling to the mountains.', 'I live in a apart', 'I live', 'transport', 'neighbourhood ... ...', 'my neighbourhood ...']) {
    const invalid = criteria();
    invalid.grammaticalRangeAndAccuracy.corrections = [{ ...corrections[0], original }];
    assert.deepEqual(parts(buildPracticeInsights([attempt({ criteria: invalid })])), [], original);
  }
});

check('positive evidence without a correction and unchanged alternatives do not invent weaknesses', () => {
  const positive = criteria();
  for (const criterion of Object.values(positive)) {
    criterion.corrections = [];
    criterion.evidence = transcripts['1_0'];
    criterion.personalizedAssessment = 'The answer gives a clear personal example.';
  }
  assert.deepEqual(parts(buildPracticeInsights([attempt({ criteria: positive })])), []);
  const unchanged = criteria();
  unchanged.grammaticalRangeAndAccuracy.corrections = [{
    original: quotes[1], alternative: quotes[1], explanation: 'This sentence already expresses the intended meaning.',
  }];
  assert.deepEqual(parts(buildPracticeInsights([attempt({ criteria: unchanged })])), []);
});

check('high-scoring criteria with minor corrections do not generate generic weak-part recommendations', () => {
  const model = buildPracticeInsights([attempt({ band: 8, criteria: criteria(8) })]);
  assert.deepEqual(parts(model), []);
});

check('latest explicit strong-part findings override fallback corrections and earlier weak findings', () => {
  const latest = attempt({ partDiagnostics: diagnostics([false, true, false]) });
  const older = attempt({ partDiagnostics: diagnostics() }, { id: 'older-speaking', completedAt: '2026-10-16T22:00:00.000Z' });
  const model = buildPracticeInsights([latest, older]);
  assert.deepEqual(parts(model), [2]);
  assertNoInventedPartBands(model);
});

check('a low overall score without located quotes does not invent a weak part', () => {
  const unlocated = criteria();
  for (const criterion of Object.values(unlocated)) {
    criterion.corrections = [];
    criterion.evidence = '';
  }
  const model = buildPracticeInsights([attempt({
    criteria: unlocated,
    partFeedback: { part1: 'Use a wider range of grammar.', part2: 'Develop ideas more fully.', part3: 'Use more precise vocabulary.' },
  })]);
  assert.deepEqual(parts(model), []);
  const fabricated = criteria();
  fabricated.grammaticalRangeAndAccuracy.corrections = [{ original: 'This quote was never spoken.', alternative: 'A better sentence.', explanation: 'An improvement.' }];
  assert.deepEqual(parts(buildPracticeInsights([attempt({ criteria: fabricated })])), []);
});

check('a quote repeated across parts cannot attribute a criterion error to one particular part', () => {
  const ambiguous = criteria();
  ambiguous.grammaticalRangeAndAccuracy.corrections = [{ original: 'I am agree.', alternative: 'I agree.', explanation: 'Agree is a verb.' }];
  const model = buildPracticeInsights([attempt({ criteria: ambiguous, transcripts: {
    '0_0': 'I am agree. My family lives nearby.',
    '1_0': 'I am agree. The journey was memorable.',
    '2_0': 'I am agree. The city should provide more buses.',
  } })]);
  assert.deepEqual(parts(model), []);
});

check('incomplete attempts and focused drills cannot produce full-test speaking recommendations', () => {
  const source = attempt({ partDiagnostics: diagnostics() });
  const cases = [
    { ...source, status: 'partial' },
    { ...source, practiceMode: 'drill' },
    { ...source, speaking: { ...source.speaking, bandEligible: false } },
    { ...source, speaking: { ...source.speaking, coverage: { isComplete: false } } },
  ];
  for (const value of cases) assert.deepEqual(parts(buildPracticeInsights([value])), []);
});

check('ordinary saved server result JSON retains the same speaking recommendations after hydration', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  } });
  try {
    const source = attempt({ partDiagnostics: {} });
    const row = {
      id: source.id, clerk_user_id: 'fixture-user', type: 'speaking', band: '5', status: 'completed',
      test_id: 100, completed_at: source.completedAt,
      data: JSON.stringify(source.speaking),
    };
    const originalRow = structuredClone(row);
    assert(hydrateFromRemoteAttempts([row], 'fixture-user'));
    const saved = getPerformanceStore();
    const savedBefore = structuredClone(saved);
    const model = buildPracticeInsights(saved.attempts);
    assert.deepEqual(parts(model), [1, 2, 3]);
    assert.deepEqual(parts(model), parts(buildPracticeInsights([source])));
    assertNoInventedPartBands(model);
    assert.deepEqual(getPerformanceStore(), savedBefore, 'Deriving recommendations must not rewrite stored scores or responses.');
    assert.deepEqual(row, originalRow);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', originalStorage);
  }
});

console.log(`\n${checks} speaking recommendation checks passed.`);
