import assert from 'node:assert/strict';
import { evaluateSpeakingResponses } from '../src/utils/evaluation/evaluationEngine.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
import { speakingQuestionKey, speakingTestContext } from '../src/utils/speakingContext.js';
import { getProductionSpeakingPackage } from '../src/data/production/adapters.js';
import { CONTENT_CATALOG } from '../src/data/production/registry.js';
import { saveLocalGroqKey, setActiveAiProvider } from '../src/utils/storage.js';
import { derivePerformanceSummary, getPerformanceStore, recordAttempt } from '../src/utils/performanceStore.js';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';

const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const previousFetch = globalThis.fetch;
const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
} });
const criterionKeys = ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'];
const source = getProductionSpeakingPackage(CONTENT_CATALOG.speaking[0].id);
let activeFixture;
let gradingRequests = 0;
const scoredResults = [];

function fixture(part, { omitLast = false } = {}) {
  const selected = selectFocusedContent(source, { skill: 'speaking', part });
  const selectedPart = selected.parts[0];
  const transcripts = Object.fromEntries(selectedPart.questions.map((_, index) => [
    speakingQuestionKey(selectedPart, index),
    `For part ${part}, answer ${index + 1}, I describe visiting the local library because it offers a quiet place to study with my family.`,
  ]));
  if (omitLast) delete transcripts[speakingQuestionKey(selectedPart, selectedPart.questions.length - 1)];
  const quote = Object.values(transcripts)[0];
  const graded = {
    criteria: Object.fromEntries(criterionKeys.map(key => [key, { band: 6, personalizedAssessment: 'The answer communicates a clear point.', nextBandAdvice: 'Develop the supporting example.', corrections: [] }])),
    partDiagnostics: quote ? { [`part${part}`]: {
      needsPractice: true, evidence: quote, reason: 'Develop the explanation and improve sentence control.',
      nextAction: 'Record a new answer with a specific example.',
      criteria: Object.fromEntries(criterionKeys.map((key, index) => [key, { band: [5, 6, 5][index], evidence: quote, feedback: `Improve ${key} in this answer.` }])),
    } } : {},
    overallSummary: 'The selected part communicates a relevant point with room for development.',
  };
  return { part, selected, transcripts, graded, context: speakingTestContext(selected), expectedQuestions: selectedPart.questions.length };
}

async function evaluate(current, options = {}) {
  activeFixture = current;
  return evaluateSpeakingResponses({
    transcripts: current.transcripts, testMeta: current.context,
    durations: Object.fromEntries(Object.keys(current.transcripts).map(key => [key, 25])),
    expectedQuestions: current.expectedQuestions, practiceMode: 'drill', expectedParts: [current.part],
    ...options,
  });
}
function assertNoWholeInterviewGrade(result) {
  assert.equal(result.band, null);
  assert.equal(result.overallSpeakingBand, null);
  for (const key of criterionKeys) assert.equal(result.criteria[key]?.band, null);
  assert.equal(result.criteria.pronunciation.band, null);
}
function assertNoNumericPartGrades(result) {
  for (const diagnostic of Object.values(result.partDiagnostics || {})) {
    assert.equal(diagnostic.practiceBand, undefined);
    for (const criterion of Object.values(diagnostic.criteria || {})) assert.equal(criterion.band, undefined);
  }
}

try {
  saveLocalGroqKey('fixture-focused-speaking-key');
  setActiveAiProvider('groq');
  for (const [skill, band] of [['reading', 6], ['listening', 7], ['writing', 6.5], ['speaking', 6]]) {
    recordAttempt({ id: `full-${skill}`, type: skill, status: 'completed', completedAt: '2026-10-17T10:00:00Z', [skill]: { band } });
  }
  const storeBefore = getPerformanceStore();
  const summaryBefore = derivePerformanceSummary();
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://api.groq.com/openai/v1/models') return Response.json({ data: [{ id: 'openai/gpt-oss-120b' }] });
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions', 'Only fixture provider endpoints may be called.');
    gradingRequests++;
    const request = JSON.parse(options.body);
    const prompt = request.messages[1].content;
    for (const [key, question] of Object.entries(activeFixture.context.questions)) {
      if (activeFixture.transcripts[key]) assert(prompt.includes(question));
    }
    for (const answer of Object.values(activeFixture.transcripts)) assert(prompt.includes(answer));
    assert(Object.keys(activeFixture.context.questions).every(key => key.startsWith(`${activeFixture.part - 1}_`)));
    return Response.json({ choices: [{ message: { content: JSON.stringify(activeFixture.graded) } }] });
  };

  for (const part of [1, 2, 3]) {
    const current = fixture(part);
    const result = await evaluate(current);
    assert.equal(result.status, 'completed');
    assert.equal(result.evaluationState, 'PARTIAL');
    assert.equal(result.focusedPracticeComplete, true);
    assertNoWholeInterviewGrade(result);
    assert.deepEqual(Object.keys(result.partDiagnostics), [`part${part}`]);
    const diagnostic = result.partDiagnostics[`part${part}`];
    assert.equal(diagnostic.practiceBand, 5.5);
    criterionKeys.forEach((key, index) => assert.equal(diagnostic.criteria[key].band, [5, 6, 5][index]));
    assert.deepEqual(getPerformanceStore(), storeBefore, 'Evaluation alone must not alter performance history.');
    scoredResults.push({ part, result });
  }
  assert.equal(gradingRequests, 3);
  console.log('✓ Completed production Speaking Parts 1, 2 and 3 retain practice criteria without issuing a full Speaking band.');

  for (const part of [1, 3]) {
    const result = await evaluate(fixture(part, { omitLast: true }));
    assert.equal(result.status, 'partial');
    assert.equal(result.focusedPracticeComplete, false);
    assert.equal(result.evaluationState, 'PARTIAL');
    assertNoWholeInterviewGrade(result);
    assertNoNumericPartGrades(result);
  }
  const emptyPartTwo = await evaluate(fixture(2, { omitLast: true }));
  assert.equal(emptyPartTwo.evaluationState, 'NOT_ASSESSED');
  assert.equal(emptyPartTwo.band, null);
  assert.equal(emptyPartTwo.overallSpeakingBand, null);
  assertNoNumericPartGrades(emptyPartTwo);
  console.log('✓ Unfinished selected parts receive no numeric part estimates or whole-interview grades.');

  const partTwo = fixture(2);
  const incompleteFull = await evaluate(partTwo, {
    practiceMode: 'full', expectedParts: [1, 2, 3],
    expectedQuestions: source.parts.reduce((total, part) => total + part.questions.length, 0),
  });
  assert.equal(incompleteFull.status, 'partial');
  assert.equal(incompleteFull.focusedPracticeComplete, false);
  assertNoWholeInterviewGrade(incompleteFull);
  assertNoNumericPartGrades(incompleteFull);
  const wrongPart = await evaluate(partTwo, { expectedParts: [3] });
  assert.equal(wrongPart.status, 'partial');
  assert.equal(wrongPart.focusedPracticeComplete, false);
  assertNoWholeInterviewGrade(wrongPart);
  assertNoNumericPartGrades(wrongPart);
  console.log('✓ Cached AI feedback cannot leak numeric grades into incomplete full interviews or mismatched selected parts.');

  for (const { part, result } of scoredResults) {
    recordAttempt({
      id: `focused-speaking-${part}`, type: 'drill', skill: 'speaking', focusKey: `speaking.part${part}`,
      practiceMode: 'drill', bandEligible: false, status: 'completed',
      completedAt: '2026-10-18T01:00:00Z', speaking: result,
    });
  }
  const storeAfter = getPerformanceStore();
  assert.deepEqual(storeAfter.attempts.filter(attempt => attempt.type !== 'drill'), storeBefore.attempts);
  const summaryAfter = derivePerformanceSummary();
  assert.equal(summaryAfter.overallBand, summaryBefore.overallBand);
  assert.equal(summaryAfter.latestScores.speaking.band, summaryBefore.latestScores.speaking.band);
  assert.deepEqual(summaryAfter.skillHistory, summaryBefore.skillHistory);
  assert.deepEqual(buildPracticeInsights(storeAfter.attempts).recommendations, buildPracticeInsights(storeBefore.attempts).recommendations);
  console.log('✓ Saved Speaking drills remain separate from full-test scores, histories and full-test recommendations.');
} finally {
  globalThis.fetch = previousFetch;
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete globalThis.localStorage;
}

console.log('\n4 focused Speaking scoring checks passed.');
