import assert from 'node:assert/strict';
import { normalizeWritingEvaluation } from '../src/utils/ieltsRubric.js';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';
import { getPerformanceStore, hydrateFromRemoteAttempts } from '../src/utils/performanceStore.js';
import { saveSkillScore } from '../src/utils/storage.js';
import { serializeAttempt } from '../src/utils/attemptPayload.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
} });

let checks = 0;
function check(name, run) {
  memory.clear();
  run();
  checks++;
  console.log(`✓ ${name}`);
}
const criterion = band => ({ band, evidence: 'An exact phrase from the submitted response.', personalizedAssessment: 'The response develops a relevant idea.', nextBandAdvice: 'Explain one supporting example.', corrections: [] });
function grade(task1, task2) {
  return normalizeWritingEvaluation({
    task1: { criteria: Object.fromEntries(['taskAchievement', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map((key, i) => [key, criterion(task1[i])])), hasOverview: true },
    task2: { criteria: Object.fromEntries(['taskResponse', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map((key, i) => [key, criterion(task2[i])])) },
    overallSummary: 'The responses address both tasks.',
  }, { task1Words: 170, task2Words: 270 });
}
function moduleResult(graded, id = 'writing-recommendation-fixture') {
  return {
    ...graded, attemptId: id, testId: 100, testLabel: 'Writing fixture',
    status: 'completed', band: graded.overallBand, evaluationStatus: 'completed',
    coverage: { complete: true }, t1: 'A complete report.', t2: 'A complete essay.',
  };
}
const tasks = model => model.recommendations.filter(rec => rec.skill === 'writing').map(rec => rec.taskKind).sort();
function hydrate(payload) {
  memory.clear();
  assert(hydrateFromRemoteAttempts([{ ...payload, clerk_user_id: 'fixture-user', data: JSON.stringify(payload.data) }], 'fixture-user'));
  return getPerformanceStore().attempts;
}

try {
  check('grader, module result save, serialization and hydration retain Task 1 7.5 and Task 2 6', () => {
    const graded = grade([8, 8, 7, 7], [6, 6, 6, 6]);
    assert.equal(graded.task1Band, 7.5);
    assert.equal(graded.task2Band, 6);
    const score = moduleResult(graded);
    saveSkillScore('writing', score);
    const saved = getPerformanceStore().attempts[0];
    assert.equal(saved.writing.task1Band, 7.5);
    assert.equal(saved.writing.task2Band, 6);
    assert.deepEqual(saved.writing.taskCriteria, graded.taskCriteria);
    assert.deepEqual(tasks(buildPracticeInsights([saved])), [2]);
    const payload = serializeAttempt(saved);
    const before = structuredClone(payload);
    const restored = hydrate(payload);
    assert.deepEqual(restored[0].writing.taskCriteria, graded.taskCriteria);
    assert.equal(restored[0].writing.task1Band, 7.5);
    assert.equal(restored[0].writing.task2Band, 6);
    const model = buildPracticeInsights(restored);
    assert.deepEqual(tasks(model), [2]);
    assert.equal(model.recommendations.find(rec => rec.skill === 'writing').band, 6);
    assert.deepEqual(payload, before, 'Hydration and recommendations must not alter the stored payload.');
  });

  check('the flat module-to-cloud result envelope also restores separate task grades', () => {
    const graded = grade([8, 8, 7, 7], [6, 6, 6, 6]);
    const score = moduleResult(graded);
    const payload = serializeAttempt({ ...score, id: score.attemptId, type: 'writing' });
    const restored = hydrate(payload);
    assert.equal(restored[0].writing.task1Band, 7.5);
    assert.equal(restored[0].writing.task2Band, 6);
    assert.deepEqual(restored[0].writing.taskCriteria, graded.taskCriteria);
    assert.deepEqual(tasks(buildPracticeInsights(restored)), [2]);
  });

  check('equally weak Writing tasks both become recommendations after a save and reload', () => {
    const graded = grade([5, 5, 5, 5], [5, 5, 5, 5]);
    saveSkillScore('writing', moduleResult(graded));
    const restored = hydrate(serializeAttempt(getPerformanceStore().attempts[0]));
    assert.deepEqual(tasks(buildPracticeInsights(restored)), [1, 2]);
    assert(buildPracticeInsights(restored).recommendations.every(rec => rec.band === 5));
  });

  check('four saved per-task criterion bands recover the same rounded task score when individual bands are absent', () => {
    const graded = grade([6, 6, 6, 7], [8, 8, 8, 8]);
    assert.equal(graded.task1Band, 6.5);
    const score = { ...moduleResult(graded), task1Band: null, task2Band: null };
    saveSkillScore('writing', score);
    const restored = hydrate(serializeAttempt(getPerformanceStore().attempts[0]));
    const model = buildPracticeInsights(restored);
    assert.deepEqual(tasks(model), [1]);
    assert.equal(model.recommendations.find(rec => rec.skill === 'writing').band, graded.task1Band);
    assert.equal(model.bySkill.writing.sections.find(section => section.key === 1).band, graded.task1Band);
  });

  check('aggregate-only and incomplete Writing results cannot fabricate task recommendations', () => {
    const cases = [
      { id: 'aggregate', type: 'writing', status: 'completed', writing: { band: 5 } },
      { id: 'partial', type: 'writing', status: 'partial', writing: { task1Band: 5, task2Band: 5 } },
      { id: 'missing-task', type: 'writing', status: 'completed', writing: { coverage: { complete: false }, task1Band: 5, task2Band: 0 } },
      { id: 'malformed', type: 'writing', status: 'completed', writing: { band: 5, taskCriteria: { task1: { taskAchievement: criterion(5), coherenceAndCohesion: criterion(5), lexicalResource: criterion(5) } } } },
    ];
    for (const attempt of cases) assert.deepEqual(tasks(buildPracticeInsights([attempt])), [], attempt.id);
  });
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
}

console.log(`\n${checks} Writing recommendation flow checks passed.`);
