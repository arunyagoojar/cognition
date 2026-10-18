import assert from 'node:assert/strict';
import { recheckLastTest } from '../src/utils/recheckLastTest.js';
import { getPerformanceStore, recordAttempt } from '../src/utils/performanceStore.js';
import { saveLocalGroqKey, setActiveAiProvider } from '../src/utils/storage.js';
import { CONTENT_CATALOG, loadSkillContent } from '../src/data/production/registry.js';
import { getProductionSpeakingPackage } from '../src/data/production/adapters.js';
import { evaluateSpeakingResponses } from '../src/utils/evaluation/evaluationEngine.js';
import { speakingTestContext } from '../src/utils/speakingContext.js';
import { RUBRIC_VERSION } from '../src/utils/ieltsRubric.js';

const memory = new Map();
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const previousFetch = globalThis.fetch;
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

try {
  await loadSkillContent('speaking');
  const source = getProductionSpeakingPackage(CONTENT_CATALOG.speaking[0].id);
  const transcripts = Object.fromEntries(source.parts.flatMap(part => part.questions.map((_, index) => [
    `${part.partNumber - 1}_${index}`,
    `In part ${part.partNumber}, answer ${index + 1}, I repeat this same basic description because I find it difficult to explain more.`,
  ])));
  assert.equal(Object.keys(transcripts).length, 19, 'fixture must cover the complete production interview');
  const durations = Object.fromEntries(Object.keys(transcripts).map(key => [key, key === '1_0' ? 105 : 20]));
  const speechMeta = Object.fromEntries(Object.entries(transcripts).map(([key, originalText]) => [key, { originalText, durationSec: durations[key], segments: [] }]));
  const originalTranscripts = { ...transcripts };
  const diagnostics = Object.fromEntries([1, 2, 3].map(part => [`part${part}`, {
    needsPractice: true,
    evidence: `In part ${part}, answer 1, I repeat this same basic description`,
    reason: 'Repetition limits the development of this answer.',
    nextAction: 'Answer this part with one claim, one reason, and one specific example.',
    criteria: Object.fromEntries(['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map(key => [key, {
      band: 5, evidence: `In part ${part}, answer 1`, feedback: 'Develop the idea with a specific example.',
    }])),
  }]));
  const criterion = { band: 5, evidence: 'I repeat this same basic description', rationale: 'Ideas repeat instead of developing.', improvementFocus: 'Develop the answer with a specific example.' };
  const graded = {
    criteria: { fluencyAndCoherence: criterion, lexicalResource: criterion, grammaticalRangeAndAccuracy: criterion },
    partDiagnostics: diagnostics,
    partFeedback: { part1: 'Develop a clear reason.', part2: 'Extend the example.', part3: 'Explain the wider consequence.' },
    overallSummary: 'The interview covers all three parts. Develop the repeated ideas.',
    priorityWeaknesses: ['Add specific examples.'],
    strengths: 'The main points are understandable.',
    areasForImprovement: 'Develop ideas and vary expression.',
    confidence: 'high',
  };

  for (const [skill, band] of [['reading', 6], ['listening', 7.5], ['writing', 6.5]]) {
    recordAttempt({ id: `preserved-${skill}`, type: skill, status: 'completed', completedAt: '2026-10-17T10:00:00Z', [skill]: { band } });
  }
  const attemptId = 'existing-speaking-attempt';
  recordAttempt({
    id: attemptId, type: 'speaking', testId: source.testId, testLabel: source.title,
    status: 'completed', completedAt: '2026-10-17T11:00:00Z',
    speaking: {
      band: 5, overallBand: 5, evaluationState: 'COMPLETED', evaluationStatus: 'completed',
      transcripts, originalTranscripts, durations, speechMeta, recordedCount: 19,
      sttEngine: 'moonshine-base', sttModelVersion: 'base-fp32',
      coverage: { isComplete: true, questionsAnswered: 19, questionsExpected: 19, partsAttempted: ['1', '2', '3'] },
      criteria: null, partDiagnostics: {},
    },
  });
  const before = getPerformanceStore();
  const unrelatedBefore = before.attempts.filter(attempt => attempt.id !== attemptId);
  saveLocalGroqKey('fixture-speaking-recheck-key');
  setActiveAiProvider('groq');
  let gradingRequests = 0;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.groq.com/openai/v1/models') {
      return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] }));
    }
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions', 'test must never access another endpoint');
    gradingRequests++;
    const request = JSON.parse(options.body);
    assert(request.messages[1].content.includes(source.parts[2].questions[0]), 'recheck includes the real Part 3 question');
    assert(request.messages[1].content.includes(transcripts['1_0']), 'recheck includes the original Part 2 response');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(graded) } }] }));
  };

  const result = await recheckLastTest();
  assert.equal(result.ok, true, result.message);
  assert.equal(result.band, 5);
  assert.equal(gradingRequests, 1);
  const after = getPerformanceStore();
  assert.equal(after.attempts.length, before.attempts.length, 'rechecking must update the existing attempt');
  assert.equal(after.attempts.filter(attempt => attempt.id === attemptId).length, 1);
  assert.deepEqual(after.attempts.filter(attempt => attempt.id !== attemptId), unrelatedBefore, 'other skill records must remain unchanged');
  const saved = after.attempts.find(attempt => attempt.id === attemptId).speaking;
  assert.deepEqual(saved.partDiagnostics, Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, { ...value, practiceBand: 5 }])), 'new part-specific criterion scores and evidence must survive the save');
  assert.equal(saved.rubricVersion, RUBRIC_VERSION);
  assert.equal(saved.providerUsed, 'groq');
  assert.equal(saved.modelUsed, 'openai/gpt-oss-120b');
  assert.deepEqual(saved.partFeedback, graded.partFeedback);
  assert.deepEqual(saved.transcripts, transcripts);
  assert.deepEqual(saved.originalTranscripts, originalTranscripts);
  assert.deepEqual(saved.durations, durations);
  assert.deepEqual(saved.speechMeta, speechMeta);
  assert.equal(saved.sttEngine, 'moonshine-base');
  for (const key of ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy']) assert.equal(saved.criteria[key].band, 5);
  assert.equal(saved.criteria.pronunciation.band, null, 'transcript-only rechecks must not invent pronunciation grades');
  const partial = await evaluateSpeakingResponses({ transcripts, durations, speechMeta, testMeta: speakingTestContext(source), expectedQuestions: 30 });
  assert.equal(partial.evaluationState, 'PARTIAL');
  assert.equal(partial.overallSpeakingBand, null);
  for (const diagnostic of Object.values(partial.partDiagnostics)) {
    assert.equal(diagnostic.practiceBand, undefined, 'Incomplete interviews retain qualitative part feedback without numeric practice scores.');
    for (const criterion of Object.values(diagnostic.criteria || {})) assert.equal(criterion.band, undefined);
  }
  console.log('✓ Speaking recheck saves part diagnostics and criteria on the same complete attempt while preserving original answers and other scores');
} finally {
  globalThis.fetch = previousFetch;
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete globalThis.localStorage;
}
