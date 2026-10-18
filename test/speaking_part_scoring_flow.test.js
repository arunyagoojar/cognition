import assert from 'node:assert/strict';
import { normalizeSpeakingEvaluation } from '../src/utils/ieltsRubric.js';
import { recoverSpeakingDiagnostics } from '../src/utils/speakingDiagnostics.js';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';
import { getPerformanceStore, hydrateFromRemoteAttempts, derivePerformanceSummary } from '../src/utils/performanceStore.js';
import { saveSkillScore } from '../src/utils/storage.js';
import { serializeAttempt } from '../src/utils/attemptPayload.js';

const criterionKeys = ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'];
const evidence = [
  'I enjoy reading in the garden because it helps me relax.',
  'We was travelling to the mountains.',
  'Investment in public transport can reduce congestion.',
];
const transcripts = {
  '0_0': `Whenever I have free time, ${evidence[0]} My family often joins me there.`,
  '1_0': `${evidence[1]} I remember the journey because the train crossed a long bridge.`,
  '2_0': `${evidence[2]} Cities also need safe walking routes and reliable services.`,
};
function rawGrade(scores = [[8, 8, 8], [5, 6, 5], [8, 8, 8]], flags = [false, true, false]) {
  return {
    criteria: Object.fromEntries(criterionKeys.map(key => [key, {
      band: 5, personalizedAssessment: 'The interview communicates the main ideas with some limitations.',
      nextBandAdvice: 'Extend the supporting explanation.', corrections: [],
    }])),
    partDiagnostics: Object.fromEntries(scores.map((bands, index) => [`part${index + 1}`, {
      needsPractice: flags[index],
      evidence: evidence[index],
      reason: bands[0] < 7 ? 'Develop the explanation and improve sentence control.' : 'The answer develops a clear relevant point.',
      nextAction: 'Record a fresh answer with one reason and one specific example.',
      practiceBand: 9, // Deliberately incorrect: code must compute this field.
      criteria: Object.fromEntries(criterionKeys.map((key, i) => [key, {
        band: bands[i], evidence: evidence[index], feedback: `${key} is demonstrated in this part of the answer.`,
      }])),
    }])),
    overallSummary: 'A complete interview with uneven performance between parts.',
    confidence: 'high',
  };
}
function normalize(raw) {
  const result = normalizeSpeakingEvaluation(raw, { transcripts });
  assert(result);
  return { ...result, band: result.overallBand, transcripts: structuredClone(transcripts), coverage: { isComplete: true }, bandEligible: true };
}
function attempt(result, id = 'numeric-speaking-parts') {
  return { id, type: 'speaking', testId: 100, status: 'completed', completedAt: '2026-10-18T01:00:00.000Z', speaking: result };
}
const recommendations = model => model.recommendations.filter(rec => rec.skill === 'speaking');
const parts = model => recommendations(model).map(rec => rec.part).sort();
function assertBands(criteria, expected) {
  assert(criteria, 'All three criterion grades must be preserved.');
  for (let i = 0; i < criterionKeys.length; i++) assert.equal(criteria[criterionKeys[i]].band, expected[i]);
}
let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log(`✓ ${name}`);
}

check('strong Parts 1 and 3 leave only the low-scoring Part 2 recommendation', () => {
  const result = normalize(rawGrade());
  const model = buildPracticeInsights([attempt(result)]);
  assert.deepEqual(parts(model), [2]);
  const rec = recommendations(model)[0];
  assert.equal(rec.practiceBand, 5.5);
  assert.equal(rec.band, 5.5);
  assert.equal(rec.scoreKind, 'part_practice_estimate');
  assertBands(rec.criteria, [5, 6, 5]);
  assert.equal(rec.testId, 100);
  assert.equal(rec.sourceAttemptId, 'numeric-speaking-parts');
  for (const [part, expected] of [[1, [8, 8, 8]], [2, [5, 6, 5]], [3, [8, 8, 8]]]) {
    const section = model.bySkill.speaking.sections.find(item => item.key === part);
    assertBands(section.criteria, expected);
    assert.equal(section.practiceBand, part === 2 ? 5.5 : 8);
    assert.equal(section.band, section.practiceBand);
  }
});

check('practice grades are computed independently from the interview band and model-supplied number', () => {
  const raw = rawGrade();
  const before = structuredClone(raw);
  const result = normalize(raw);
  assert.equal(result.overallBand, 5);
  assert.equal(result.partDiagnostics.part1.practiceBand, 8);
  assert.equal(result.partDiagnostics.part2.practiceBand, 5.5);
  assert.equal(result.partDiagnostics.part3.practiceBand, 8);
  assert.equal(recoverSpeakingDiagnostics(result).part2.practiceBand, 5.5);
  assert.deepEqual(raw, before, 'Normalization must not rewrite the original grading response.');
});

check('equally low scores recommend all three parts rather than hiding tied weaknesses', () => {
  const result = normalize(rawGrade([[5, 5, 5], [5, 5, 5], [5, 5, 5]], [true, true, true]));
  const model = buildPracticeInsights([attempt(result)]);
  assert.deepEqual(parts(model), [1, 2, 3]);
  for (const rec of recommendations(model)) {
    assert.equal(rec.practiceBand, 5);
    assertBands(rec.criteria, [5, 5, 5]);
  }
});

check('a false qualitative flag cannot conceal a valid low practice grade', () => {
  const result = normalize(rawGrade([[8, 8, 8], [5, 6, 5], [8, 8, 8]], [false, false, false]));
  assert.deepEqual(parts(buildPracticeInsights([attempt(result)])), [2]);
});

check('strong current practice grades override old weak scores and stale true flags', () => {
  const latest = attempt(normalize(rawGrade([[8, 8, 8], [8, 8, 8], [8, 8, 8]], [true, true, true])));
  const older = attempt(normalize(rawGrade([[5, 5, 5], [5, 5, 5], [5, 5, 5]], [true, true, true])), 'older-weak-speaking');
  older.completedAt = '2026-10-17T01:00:00.000Z';
  assert.deepEqual(parts(buildPracticeInsights([latest, older])), []);
});

check('invalid per-part criterion numbers cannot become numeric practice grades', () => {
  for (const band of [5.5, '5', -1, 10, null, undefined, Number.NaN]) {
    const raw = rawGrade();
    raw.partDiagnostics.part2.criteria.lexicalResource.band = band;
    const result = normalize(raw);
    const diagnostic = result.partDiagnostics.part2;
    assert(diagnostic, 'Valid qualitative feedback may remain when its numerical breakdown is malformed.');
    assert.equal(diagnostic.practiceBand, undefined, `Invalid criterion band: ${String(band)}`);
    assert.equal(diagnostic.criteria, undefined);
    assert.equal(recoverSpeakingDiagnostics(result).part2?.practiceBand, undefined);
  }
});

check('numeric grades require evidence and feedback from the same part', () => {
  for (const replacement of [
    { evidence: evidence[0] },
    { evidence: 'A sentence the candidate never said.' },
    { evidence: '' },
    { feedback: '' },
  ]) {
    const raw = rawGrade();
    Object.assign(raw.partDiagnostics.part2.criteria.lexicalResource, replacement);
    const result = normalize(raw);
    assert.equal(result.partDiagnostics.part2.practiceBand, undefined);
    assert.equal(result.partDiagnostics.part2.criteria, undefined);
    assert.equal(recoverSpeakingDiagnostics(result).part2?.practiceBand, undefined);
  }
  const raw = rawGrade();
  raw.partDiagnostics.part2.criteria.pronunciation = { band: 9, evidence: evidence[1], feedback: 'A transcript cannot support this claim.' };
  const result = normalize(raw);
  assert.equal(result.partDiagnostics.part2.practiceBand, 5.5);
  assert.equal(result.partDiagnostics.part2.criteria.pronunciation, undefined);
});

check('qualitative historical results and located corrections retain recommendations without invented numbers', () => {
  const raw = rawGrade();
  for (const diagnostic of Object.values(raw.partDiagnostics)) {
    delete diagnostic.criteria;
    delete diagnostic.practiceBand;
  }
  const qualitative = buildPracticeInsights([attempt(normalize(raw))]);
  assert.deepEqual(parts(qualitative), [2]);
  assert.equal(recommendations(qualitative)[0].practiceBand, undefined);
  assert.equal(recommendations(qualitative)[0].band, undefined);
  const legacy = normalize(rawGrade());
  legacy.partDiagnostics = {};
  legacy.criteria.grammaticalRangeAndAccuracy.corrections = [{ original: evidence[1], alternative: 'We were travelling to the mountains.', explanation: 'Use were with we.' }];
  const recovered = buildPracticeInsights([attempt(legacy)]);
  assert.deepEqual(parts(recovered), [2]);
  assert.equal(recommendations(recovered)[0].practiceBand, undefined);
  assert.equal(recommendations(recovered)[0].band, undefined);
});

check('saving, serializing and hydrating retain the full numeric breakdown without changing the interview band', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key),
  } });
  try {
    const result = normalize(rawGrade());
    saveSkillScore('speaking', { ...result, attemptId: 'numeric-speaking-parts', testId: 100, status: 'completed' });
    const saved = getPerformanceStore().attempts[0];
    const payload = serializeAttempt(saved);
    const before = structuredClone(payload);
    assert.equal(payload.band, 5);
    memory.clear();
    assert(hydrateFromRemoteAttempts([{ ...payload, clerk_user_id: 'fixture-user', data: JSON.stringify(payload.data) }], 'fixture-user'));
    const restored = getPerformanceStore().attempts[0];
    assert.equal(restored.speaking.band, 5);
    assert.deepEqual(restored.speaking.partDiagnostics, result.partDiagnostics);
    assert.equal(derivePerformanceSummary().latestScores.speaking.band, 5);
    const model = buildPracticeInsights([restored]);
    assert.deepEqual(parts(model), [2]);
    assert.equal(recommendations(model)[0].practiceBand, 5.5);
    assertBands(recommendations(model)[0].criteria, [5, 6, 5]);
    assert.deepEqual(payload, before);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

console.log(`\n${checks} Speaking part scoring flow checks passed.`);
