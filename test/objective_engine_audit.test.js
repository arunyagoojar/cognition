import assert from 'node:assert/strict';
import { PRODUCTION_READING, PRODUCTION_LISTENING } from '../src/data/production/registry.js';
import { evaluateDeterministic, DETERMINISTIC } from '../src/utils/bandCalculator.js';
import { getReadingTest } from '../src/data/reading/index.js';
import { evaluateReadingResponses, evaluateListeningResponses } from '../src/utils/evaluation/evaluationEngine.js';
import { buildAnswerReviewItems } from '../src/utils/answerReview.js';
assert.equal(evaluateDeterministic('needs', ['need', 'needs']).result, DETERMINISTIC.MATCH);
assert.equal(evaluateDeterministic('needs', ['needs', 'need']).result, DETERMINISTIC.MATCH);
for (const [evaluate, field] of [[evaluateReadingResponses, 'passages'], [evaluateListeningResponses, 'sections']]) {
  for (const answer of ['need', 'the need', '“need”', ' THE NEED. ', 'needs']) {
    const result = await evaluate({ [field]: [{ id: 'part1', questions: [{ id: 'q1', questionNumber: 1, questionType: 'summary_completion', answer: 'need', acceptedAnswers: ['need','needs'], wordLimit: 'NO MORE THAN TWO WORDS' }] }], answers: { q1: answer } });
    assert.equal(result.itemResults.q1.finalResult, 'CORRECT', `${field}: valid written form ${answer} needs no AI verification`);
    assert.equal(result.itemResults.q1.evaluationMethod, 'DETERMINISTIC');
  }
}
let total = 0;
for (const test of [...PRODUCTION_READING, ...PRODUCTION_LISTENING]) {
  const questions = (test.passages || test.parts).flatMap(p => p.questions);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length, `${test.id}: unique question IDs`);
  for (const q of questions) {
    const accepted = q.acceptedAnswers?.length ? q.acceptedAnswers : [q.answer];
    for (const variant of accepted) {
      assert.equal(evaluateDeterministic(variant, accepted).result, DETERMINISTIC.MATCH, `${test.id}/${q.id}: every explicit accepted variant wins over near-matches`);
      assert.equal(evaluateDeterministic(variant, [...accepted].reverse()).result, DETERMINISTIC.MATCH, 'variant ordering cannot affect the verdict');
    }
    total++;
  }
}
const test = getReadingTest(235, true);
const answers = { q1: 'needs', q5: 'C', q7: 'A', q8: 'B', q11: 'FALSE', q19: 'FALSE', q36: 'classical education' };
const result = await evaluateReadingResponses({ passages: test.passages, answers });
for (const id of ['q1', 'q5', 'q7', 'q11', 'q19', 'q36']) assert.equal(result.itemResults[id].finalResult, 'CORRECT');
assert.equal(result.itemResults.q8.candidateAnswer, 'B');
assert.equal(result.itemResults.q8.finalResult, 'INCORRECT');
assert.equal(result.itemResults.q6.candidateAnswer, null);
const review = buildAnswerReviewItems(result, test, 'reading');
assert.equal(review.q7.candidateAnswer, 'A');
assert.equal(review.q8.candidateAnswer, 'B');
assert.equal(review.q6.answerLabels.B, 'oxen');
assert.equal(review.q11.officialAnswer, 'FALSE');
assert(Object.values(review).every(row => row.questionText));
const old = { answers: { q11: 'FALSE' }, itemResults: { q11: { candidateAnswer: 'FALSE', officialAnswer: 'TRUE', finalResult: 'INCORRECT' } } };
const correctedReview = buildAnswerReviewItems(old, test, 'reading');
assert.equal(correctedReview.q11.officialAnswer, 'FALSE');
assert.match(correctedReview.q11.keyCorrection, /not been recalculated/);
assert.equal(old.itemResults.q11.officialAnswer, 'TRUE', 'historical score data is never silently rewritten');
console.log(`Objective audit: ${total} reading/listening questions, all accepted variants in both orders, and Test 235 grading/review passed.`);
