import assert from 'node:assert/strict';
import { getProductionReadingTest, getProductionListeningTest } from '../src/data/production/adapters.js';
import { evaluateReadingResponses, evaluateListeningResponses } from '../src/utils/evaluation/evaluationEngine.js';
import { saveSkillScore } from '../src/utils/storage.js';
import { serializeAttempt } from '../src/utils/attemptPayload.js';
import { getPerformanceStore, hydrateFromRemoteAttempts } from '../src/utils/performanceStore.js';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';
import index from '../src/data/production/analyticsIndex.json' with { type: 'json' };

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const originalFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('Network prohibited in this fixture'); };
let passed = 0;
try {
  for (const [skill, source, grade] of [
    ['reading', getProductionReadingTest(100, true), evaluateReadingResponses],
    ['listening', getProductionListeningTest(185, true), evaluateListeningResponses],
  ]) {
    const sections = source.passages || source.parts;
    for (const scenario of ['one-weak', 'all-weak', 'all-correct', 'one-blank']) {
      values.clear();
      const answers = {};
      for (const [index, section] of sections.entries()) {
        for (const [position, question] of section.questions.entries()) {
          const weak = scenario === 'all-weak' || scenario === 'one-weak' && index === 1;
          const correct = !weak || position < Math.floor(section.questions.length * 0.2);
          answers[question.id] = scenario === 'one-blank' && index === 1 ? ''
            : correct ? question.acceptedAnswers?.[0] ?? question.answer : `zzinvalidzz${question.questionNumber}`;
        }
      }
      const result = await grade({ passages: sections, sections, answers });
      assert.equal(result.status, 'completed');
      assert.equal(Object.keys(result.itemResults).length, 40);
      assert(Object.values(result.itemResults).every(item => item.officialAnswer != null && item.finalResult && item.questionNumber != null && item.part));
      if (scenario !== 'one-blank') assert(Object.values(result.itemResults).every(item => item.candidateAnswer != null));
      if (scenario === 'all-correct') assert.equal(result.raw, 40);
      const id = `${skill}-${scenario}`;
      const scoreData = { ...result, testId: source.testId, attemptId: id };
      // Exact application save path: nested canonical local record and flat cloud payload.
      saveSkillScore(skill, scoreData);
      const local = getPerformanceStore().attempts[0];
      const before = buildPracticeInsights([local], index);
      const payload = serializeAttempt({ ...scoreData, id, type: skill, testId: source.testId });
      values.clear();
      assert(hydrateFromRemoteAttempts([{ ...payload, data: JSON.stringify(payload.data), clerk_user_id: 'fixture-user' }], 'fixture-user'));
      const restored = getPerformanceStore().attempts[0];
      const after = buildPracticeInsights([restored], index);
      assert.deepEqual(restored[skill].itemResults, result.itemResults, 'every scored verdict and part survives cloud hydration');
      assert.deepEqual(after.bySkill[skill].sections.map(({ key, correct, total, uncertain }) => ({ key, correct, total, uncertain })), before.bySkill[skill].sections.map(({ key, correct, total, uncertain }) => ({ key, correct, total, uncertain })));
      const recommendations = after.recommendations.filter(item => item.skill === skill && item.kind === 'section');
      const expected = scenario === 'all-correct' ? [] : scenario === 'all-weak' ? sections.map((_, index) => index + 1) : [2];
      assert.deepEqual(recommendations.map(item => item.part).sort(), expected);
      assert(recommendations.every(item => item.testId === source.testId && item.sourceAttemptId === id));
      const counts = after.bySkill[skill].sections.map(item => `${item.key}:${item.correct}/${item.total}`).join(', ');
      console.log(`✓ ${skill} ${scenario}: raw ${result.raw}/40; parts ${counts}; recommended ${recommendations.map(item => item.part).join(',') || 'none'}; ${Object.keys(restored[skill].itemResults).length} item records retained`);
      passed++;
    }
  }
  assert.equal(fetches, 0, 'no network request or real provider used');
} finally {
  globalThis.fetch = originalFetch;
}
console.log(`${passed} actual objective grader → local save → serialize → remote hydrate → recommendation checks passed`);
