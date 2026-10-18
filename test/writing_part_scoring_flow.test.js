import assert from 'node:assert/strict';
import { evaluateWritingWithAI } from '../src/utils/geminiEvaluator.js';
import { RUBRIC_VERSION } from '../src/utils/ieltsRubric.js';
import { prepareRequestBudget } from '../src/utils/ai/requestBudget.js';
import { saveLocalGroqKey, saveSkillScore, setActiveAiProvider } from '../src/utils/storage.js';
import { getPerformanceStore, hydrateFromRemoteAttempts } from '../src/utils/performanceStore.js';
import { serializeAttempt } from '../src/utils/attemptPayload.js';
import { recheckLastTest } from '../src/utils/recheckLastTest.js';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';
import { CONTENT_CATALOG, loadSkillContent } from '../src/data/production/registry.js';
import { getWritingTest } from '../src/data/writing/index.js';

const criterionKeys = [
  ['taskAchievement', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'],
  ['taskResponse', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'],
];
function fixtureGrade(task1, task2) {
  return {
    ...Object.fromEntries([task1, task2].map((bands, index) => [`task${index + 1}`, {
      criteria: Object.fromEntries(criterionKeys[index].map((key, i) => [key, {
        band: bands[i], evidence: index ? 'reliable public transport' : 'The figures show a clear trend',
        personalizedAssessment: `This is feedback for Task ${index + 1} ${key}.`,
        nextBandAdvice: `Improve one example in Task ${index + 1}.`, corrections: [],
      }])),
      hasOverview: true, positionClear: true, feedback: `Feedback for Task ${index + 1}.`,
    }])),
    overallBand: 9, task1Band: 9, task2Band: 9,
    overallSummary: 'Both tasks address the questions with different levels of control.',
    confidence: 'high',
  };
}
function assertTaskCriteria(record, one, two) {
  for (const [index, bands] of [one, two].entries()) {
    const criteria = record.taskCriteria?.[`task${index + 1}`];
    assert.deepEqual(Object.keys(criteria).sort(), [...criterionKeys[index]].sort());
    for (const [i, key] of criterionKeys[index].entries()) {
      assert.equal(criteria[key].band, bands[i]);
      assert.match(criteria[key].personalizedAssessment, new RegExp(`Task ${index + 1}`));
    }
  }
}
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const previousFetch = globalThis.fetch;
const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
} });

try {
  await loadSkillContent('writing');
  const test = getWritingTest(CONTENT_CATALOG.writing[0].id);
  assert(test.task1?.prompt && test.task2?.prompt);
  const task1Text = 'The figures show a clear trend in the number of passengers using different transport services. '.repeat(11).trim();
  const task2Text = 'Cities should invest in reliable public transport because affordable journeys connect residents to education and employment. '.repeat(17).trim();
  const prompts = {
    task1: test.task1.prompt, task2: test.task2.prompt,
    task1Data: { visualType: test.task1.visualType, table: test.task1.table, image: test.task1.image?.file },
  };
  saveLocalGroqKey('fixture-writing-part-score-key');
  setActiveAiProvider('groq');
  let currentGrade = fixtureGrade([8, 8, 7, 7], [6, 6, 6, 6]);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://api.groq.com/openai/v1/models') return Response.json({ data: [{ id: 'openai/gpt-oss-120b' }] });
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions', 'The fixture must never reach another endpoint.');
    const request = JSON.parse(options.body);
    const prompt = request.messages[1].content;
    assert(prompt.includes(test.task1.prompt));
    assert(prompt.includes(test.task2.prompt));
    assert(prompt.includes(task1Text));
    assert(prompt.includes(task2Text));
    const budget = await prepareRequestBudget('groq', request.messages[0].content, prompt, { model: request.model });
    assert.equal(budget.ok, true);
    assert.equal(request.max_completion_tokens, budget.outputTokens);
    assert(budget.inputTokens + request.max_completion_tokens <= 7600);
    requests.push(request);
    return Response.json({ choices: [{ message: { content: JSON.stringify(currentGrade) } }] });
  };

  const initial = await evaluateWritingWithAI({ task1Text, task2Text, prompts });
  assert.equal(initial.evaluationStatus, 'completed');
  assertTaskCriteria(initial, [8, 8, 7, 7], [6, 6, 6, 6]);
  assert.equal(initial.task1Band, 7.5);
  assert.equal(initial.task2Band, 6);
  assert.equal(initial.band, 6.5, 'Task 2 counts twice; an unweighted average would round to 7.0.');
  assert.equal(initial.rubricVersion, RUBRIC_VERSION);
  assert.equal(requests.length, 1);
  console.log('✓ Initial Writing evaluation validates four criteria per task and computes Task 2 double weighting.');

  const id = 'existing-writing-part-score-attempt';
  saveSkillScore('writing', {
    ...initial, attemptId: id, testId: test.testId, testLabel: test.title,
    status: 'completed', t1: task1Text, t2: task2Text,
    rubricVersion: 'previous-rubric-version', modelUsed: 'previous-model', providerUsed: 'gemini',
    scoringMethod: 'Previous scoring method',
  });
  const before = getPerformanceStore();
  assert.deepEqual(buildPracticeInsights(before.attempts).recommendations.filter(rec => rec.skill === 'writing').map(rec => rec.taskKind), [2]);
  // Recheck must run the provider path rather than reusing the first grade.
  memory.delete('omniprep_ai_cache');
  currentGrade = fixtureGrade([5, 5, 5, 5], [5, 5, 5, 5]);
  const rechecked = await recheckLastTest();
  assert.equal(rechecked.ok, true, rechecked.message);
  assert.equal(rechecked.band, 5);
  assert.equal(requests.length, 2);
  const after = getPerformanceStore();
  assert.equal(after.attempts.length, before.attempts.length);
  assert.equal(after.attempts[0].id, id);
  const updated = after.attempts[0].writing;
  assertTaskCriteria(updated, [5, 5, 5, 5], [5, 5, 5, 5]);
  assert.equal(updated.task1Band, 5);
  assert.equal(updated.task2Band, 5);
  assert.equal(updated.band, 5);
  assert.equal(updated.t1, task1Text);
  assert.equal(updated.t2, task2Text);
  assert.equal(updated.rubricVersion, RUBRIC_VERSION);
  assert.equal(updated.providerUsed, 'groq');
  assert.equal(updated.modelUsed, 'openai/gpt-oss-120b');
  assert.match(updated.scoringMethod, /Task 2/);
  assert.deepEqual(buildPracticeInsights(after.attempts).recommendations.filter(rec => rec.skill === 'writing').map(rec => rec.taskKind).sort(), [1, 2]);
  console.log('✓ Writing recheck updates the same attempt with new task criteria, grades and evaluator metadata.');

  const payload = serializeAttempt({ ...updated, id, type: 'writing', testId: test.testId, status: 'completed', band: rechecked.band });
  memory.clear();
  assert(hydrateFromRemoteAttempts([{ ...payload, clerk_user_id: 'fixture-user', data: JSON.stringify(payload.data) }], 'fixture-user'));
  const restored = getPerformanceStore().attempts[0];
  assert.equal(restored.id, id);
  assert.equal(restored.writing.band, 5);
  assertTaskCriteria(restored.writing, [5, 5, 5, 5], [5, 5, 5, 5]);
  assert.equal(restored.writing.rubricVersion, RUBRIC_VERSION);
  assert.deepEqual(buildPracticeInsights([restored]).recommendations.filter(rec => rec.skill === 'writing').map(rec => rec.taskKind).sort(), [1, 2]);
  console.log('✓ Rechecked task grades survive the dashboard cloud payload and hydration without changing the weighted overall score.');
} finally {
  globalThis.fetch = previousFetch;
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete globalThis.localStorage;
}

console.log('\n3 Writing part scoring flow checks passed.');
