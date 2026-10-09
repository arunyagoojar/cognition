/**
 * IELTS Writing/Speaking rubric v2 — band arithmetic is code, not model output.
 */
import assert from 'node:assert/strict';
import {
  roundIeltsBand, countWords, normalizeWritingEvaluation, normalizeSpeakingEvaluation, buildWritingUserPrompt,
} from '../src/utils/ieltsRubric.js';
import { validateWritingEvaluationJson } from '../src/utils/geminiEvaluator.js';

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const crit = (b) => ({ band: b, evidence: 'e', rationale: 'r', improvementFocus: 'i' });
const writing = (t1, t2, extra = {}) => ({
  task1: { criteria: { taskAchievement: crit(t1[0]), coherenceAndCohesion: crit(t1[1]), lexicalResource: crit(t1[2]), grammaticalRangeAndAccuracy: crit(t1[3]) }, hasOverview: true, feedback: 'f1', ...extra.t1 },
  task2: { criteria: { taskResponse: crit(t2[0]), coherenceAndCohesion: crit(t2[1]), lexicalResource: crit(t2[2]), grammaticalRangeAndAccuracy: crit(t2[3]) }, feedback: 'f2' },
  overallSummary: 's', strengths: 'st', areasForImprovement: 'a', confidence: 'high',
});

console.log('== IELTS rubric v2 ==');
t('IELTS rounding: .25 → .5, .75 → next band', () => {
  assert.equal(roundIeltsBand(6.125), 6); assert.equal(roundIeltsBand(6.25), 6.5);
  assert.equal(roundIeltsBand(6.5), 6.5); assert.equal(roundIeltsBand(6.75), 7); assert.equal(roundIeltsBand(9.4), 9);
});
t('word count is whitespace tokens', () => { assert.equal(countWords('  The  chart shows\nthree lines. '), 5); assert.equal(countWords(''), 0); });
t('Writing: task bands from criteria, Task 2 counts double', () => {
  const r = normalizeWritingEvaluation(writing([6, 6, 6, 6], [7, 7, 7, 7]), { task1Words: 170, task2Words: 280 });
  assert.equal(r.task1Band, 6); assert.equal(r.task2Band, 7);
  assert.equal(r.overallBand, 6.5); // (6 + 2×7) / 3 = 6.67 → 6.5 (nearest half band)
});
t('Writing: criteria are whole bands even if the model sends halves', () => {
  const r = normalizeWritingEvaluation(writing([6.5, 6, 6, 6], [7, 7, 7, 6.5]), { task1Words: 170, task2Words: 280 });
  assert.ok(Object.values(r.taskCriteria.task1).every(c => Number.isInteger(c.band)));
});
t('Writing: no overview caps Task Achievement at 5', () => {
  const r = normalizeWritingEvaluation(writing([7, 7, 7, 7], [7, 7, 7, 7], { t1: { hasOverview: false } }), { task1Words: 170, task2Words: 280 });
  assert.equal(r.taskCriteria.task1.taskAchievement.band, 5);
  assert.equal(r.task1Band, 6.5);
});
t('Writing: ≤20 words is Band 1 per official descriptors; a missing task is Band 0', () => {
  const r = normalizeWritingEvaluation(writing([6, 6, 6, 6], [7, 7, 7, 7]), { task1Words: 18, task2Words: 0 });
  assert.equal(r.task1Band, 1); assert.equal(r.task2Band, 0); assert.equal(r.overallBand, 0.5);
});
t('Writing: model-supplied overall bands are ignored', () => {
  const raw = { ...writing([5, 5, 5, 5], [5, 5, 5, 5]), overallBand: 9, task1Band: 9, task2Band: 9 };
  const r = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 260 });
  assert.equal(r.overallBand, 5);
});
t('Writing: malformed JSON is rejected (no invented score)', () => {
  assert.equal(normalizeWritingEvaluation({ task1: {}, task2: {} }, { task1Words: 160, task2Words: 260 }), null);
});
t('Writing: client validator accepts a server-normalized result unchanged', () => {
  const r = normalizeWritingEvaluation(writing([6, 6, 6, 6], [7, 7, 7, 7]), { task1Words: 170, task2Words: 280 });
  assert.equal(validateWritingEvaluationJson(r), r);
});
t('Speaking: pronunciation is never taken from a transcript; band is provisional', () => {
  const raw = { criteria: { fluencyAndCoherence: crit(7), lexicalResource: crit(6), grammaticalRangeAndAccuracy: crit(6), pronunciation: { band: 8 } } };
  const r = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(r.criteria.pronunciation.band, null); assert.equal(r.provisional, true);
  assert.equal(r.overallBand, 6.5); // mean 6.33 → 6.5
});
t('Speaking: four criteria when audio is assessed', () => {
  const raw = { criteria: { fluencyAndCoherence: crit(7), lexicalResource: crit(7), grammaticalRangeAndAccuracy: crit(6), pronunciation: crit(7) } };
  const r = normalizeSpeakingEvaluation(raw, { audioAssessed: true });
  assert.equal(r.overallBand, 7); assert.equal(r.provisional, false); // 6.75 → 7
});
t('prompt carries both prompts and real word counts', () => {
  const p = buildWritingUserPrompt({ prompts: { task1: 'P1', task2: 'P2' }, task1Text: 'a b c', task2Text: '' });
  assert.ok(p.includes('P1') && p.includes('(3 words; minimum 150)') && p.includes('(0 words; minimum 250)'));
});
t('Writing: calculation applies rounding once at final stage without intermediate rounding', () => {
  // Task 1: [6, 6, 6, 7] -> mean = 6.25 (would round to 6.5 if intermediate rounded)
  // Task 2: [6, 7, 7, 7] -> mean = 6.75 (would round to 7.0 if intermediate rounded)
  // Pre-rounded formula: (6.5 + 2 * 7.0) / 3 = 6.833 -> 7.0
  // Official single-stage formula: (6.25 + 2 * 6.75) / 3 = 19.75 / 3 = 6.5833 -> 6.5!
  const r = normalizeWritingEvaluation(writing([6, 6, 6, 7], [6, 7, 7, 7]), { task1Words: 170, task2Words: 280 });
  assert.equal(r.task1Band, 6.5);
  assert.equal(r.task2Band, 7.0);
  assert.equal(r.overallBand, 6.5);
});
t('Writing: overviewStatus uncertain does NOT trigger an automatic cap at Band 5', () => {
  const r = normalizeWritingEvaluation(writing([7, 7, 7, 7], [7, 7, 7, 7], { t1: { overviewStatus: 'uncertain', hasOverview: true } }), { task1Words: 170, task2Words: 280 });
  assert.equal(r.taskCriteria.task1.taskAchievement.band, 7);
});
t('prompt carries structured Task 1 visual data when provided', () => {
  const table = {
    caption: 'passenger numbers',
    rows: [['City', 'Passengers'], ['London', '775']]
  };
  const p = buildWritingUserPrompt({
    prompts: { task1: 'Summarize', task2: 'Discuss', task1Data: { visualType: 'table', table } },
    task1Text: 'Words', task2Text: 'Words'
  });
  assert.ok(p.includes('TASK 1 VERIFIED STRUCTURED DATA'));
  assert.ok(p.includes('London | 775'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
