/**
 * Cognition IELTS — Evaluation & Scoring Architecture Verification Suite
 * Tests deterministic scoring, answer normalization, evaluation state machine,
 * fallback chains, partial submission handling, empty submission handling,
 * and canonical performance storage resets.
 */

import { 
  isCandidateAnswerCorrect, 
  evaluateFullMockExam,
  evaluateListeningResponses,
  deriveInsightsFromEvaluation
} from '../src/utils/evaluation/evaluationEngine.js';
import { 
  getPerformanceStore, 
  recordAttempt, 
  derivePerformanceSummary, 
  resetPerformanceData 
} from '../src/utils/performanceStore.js';
import { calculateReadingBand, calculateListeningBand, calculateOverallBand } from '../src/utils/bandCalculator.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  }
}

console.log('============================================================');
console.log('COGNITION IELTS — EVALUATION ARCHITECTURE TEST SUITE');
console.log('============================================================\n');

async function runTests() {
  // ── TEST 1: Deterministic Answer Normalization & Matching ──
  console.log('--- [Test 1] Deterministic Answer Normalization & Matching ---');
  assert(isCandidateAnswerCorrect('university', 'UNIVERSITY'), 'Case insensitive match matches');
  assert(isCandidateAnswerCorrect('  london bridge  ', 'London Bridge'), 'Whitespace trimmed match matches');
  assert(isCandidateAnswerCorrect('centre', 'center / centre'), 'Slash alternative matches');
  assert(isCandidateAnswerCorrect('15', '50') === false, 'Different numbers ("15" vs "50") never match');
  assert(isCandidateAnswerCorrect('student', 'students') === false, 'Morphological variations ("student" vs "students") never automatically match');
  assert(isCandidateAnswerCorrect('', 'validAnswer') === false, 'Empty answer fails');
  assert(isCandidateAnswerCorrect(null, 'validAnswer') === false, 'Null answer fails');

  // ── TEST 2: Official Cambridge Band Conversion ──
  console.log('\n--- [Test 2] Official Cambridge Band Conversion ---');
  assert(calculateReadingBand(40) === 9.0, 'Reading raw 40 = Band 9.0');
  assert(calculateReadingBand(35) === 8.0, 'Reading raw 35 = Band 8.0');
  assert(calculateReadingBand(30) === 7.0, 'Reading raw 30 = Band 7.0');
  assert(calculateReadingBand(23) === 6.0, 'Reading raw 23 = Band 6.0');
  assert(calculateReadingBand(0) === 0.0, 'Reading raw 0 = Band 0.0');

  assert(calculateListeningBand(40) === 9.0, 'Listening raw 40 = Band 9.0');
  assert(calculateListeningBand(35) === 8.0, 'Listening raw 35 = Band 8.0');
  assert(calculateListeningBand(30) === 7.0, 'Listening raw 30 = Band 7.0');
  assert(calculateListeningBand(0) === 0.0, 'Listening raw 0 = Band 0.0');

  // ── TEST 3: Overall Band Strict Calculation Rules ──
  console.log('\n--- [Test 3] Overall Band Calculation Rules ---');
  assert(calculateOverallBand(7.0, 7.0, 7.0, 7.0) === 7.0, 'All 7.0 = 7.0');
  assert(calculateOverallBand(6.5, 6.5, 6.5, 6.5) === 6.5, 'All 6.5 = 6.5');
  assert(calculateOverallBand(7.0, 8.0, 6.5, 7.5) === 7.5, 'Average 7.25 rounds up to 7.5 per official Cambridge rules');
  assert(calculateOverallBand(7.0, 7.0, 6.0, 7.0) === 7.0, 'Average 6.75 rounds up to 7.0 per official Cambridge rules');
  assert(calculateOverallBand(7.0, null, 7.0, 7.0) === null, 'Missing/null skill produces null overallBand');
  assert(calculateOverallBand(null, null, null, null) === null, 'All null skills produces null overallBand');

  // ── TEST 4: Empty Submission Test (Section 57) ──
  console.log('\n--- [Test 4] Empty Full Mock Submission ---');
  const emptyRecord = await evaluateFullMockExam({
    testId: 'test-empty',
    testLabel: 'Empty Test Run',
    rawExamPackage: {
      listening: { sections: [{ questions: [{ id: 'q1', answer: 'cat' }] }] },
      reading: { passages: [{ questions: [{ id: 'q2', answer: 'dog' }] }] },
      writing: { task1: { prompt: 'T1' }, task2: { prompt: 'T2' } },
      speaking: { parts: [{ questions: [{ id: 'sq1' }] }] }
    },
    sectionAnswers: {
      listening: { answers: {} },
      reading: { answers: {} },
      writing: { t1: '', t2: '' },
      speaking: { transcripts: {} }
    }
  });

  assert(emptyRecord.skills.reading.status === 'not_attempted', 'Empty Reading marked not_attempted');
  assert(emptyRecord.skills.reading.band === null, 'Empty Reading band is null');
  assert(emptyRecord.skills.listening.status === 'not_attempted', 'Empty Listening marked not_attempted');
  assert(emptyRecord.skills.listening.band === null, 'Empty Listening band is null');
  assert(emptyRecord.skills.writing.status === 'not_attempted', 'Empty Writing marked not_attempted');
  assert(emptyRecord.skills.writing.band === null, 'Empty Writing band is null');
  assert(emptyRecord.skills.speaking.status === 'not_attempted', 'Empty Speaking marked not_attempted');
  assert(emptyRecord.skills.speaking.band === null, 'Empty Speaking band is null');
  assert(emptyRecord.overallBand === null, 'Empty mock overallBand is strictly null');
  assert(emptyRecord.strengths.length === 0, 'No strengths manufactured for empty submission');
  assert(emptyRecord.priorityAreas.length === 0, 'No priority areas manufactured for empty submission');
  assert(emptyRecord.recommendations.length === 0, 'No recommendations manufactured for empty submission');

  // ── TEST 5: Partial Submission Test (Section 41) ──
  console.log('\n--- [Test 5] Partial Mock Submission (Only 1 Skill Attempted) ---');
  const partialRecord = await evaluateFullMockExam({
    testId: 'test-partial',
    testLabel: 'Partial Test Run',
    rawExamPackage: {
      listening: { sections: [{ questions: [{ id: 'l1', answer: 'ocean' }] }] },
      reading: { passages: [{ questions: [{ id: 'r1', answer: 'forest' }] }] },
      writing: { task1: { prompt: 'T1' }, task2: { prompt: 'T2' } },
      speaking: { parts: [{ questions: [{ id: 'sq1' }] }] }
    },
    sectionAnswers: {
      listening: { answers: { l1: 'ocean' } }, // Answered Listening correctly!
      reading: { answers: {} }, // Unattempted
      writing: { t1: '', t2: '' }, // Unattempted
      speaking: { transcripts: {} } // Unattempted
    }
  });

  assert(partialRecord.skills.listening.status === 'completed', 'Attempted Listening marked completed');
  assert(typeof partialRecord.skills.listening.band === 'number', 'Listening has evaluated band');
  assert(partialRecord.skills.reading.status === 'not_attempted', 'Unattempted Reading remains not_attempted');
  assert(partialRecord.skills.reading.band === null, 'Unattempted Reading band is null');
  assert(partialRecord.overallBand === null, 'Overall band is null when only 1 skill completed');
  assert(partialRecord.status === 'completed', 'Partial test attempt status marked completed');

  // ── TEST 6: Real Diagnostic Insights Generation ──
  console.log('\n--- [Test 6] Genuine Diagnostic Insights Generation ---');
  const testSkills = {
    listening: { status: 'completed', band: 7.5, raw: 32, total: 40 },
    reading: { status: 'completed', band: 6.0, raw: 23, total: 40 },
    writing: {
      status: 'completed',
      band: 6.5,
      strengths: 'Clear argumentative structure in Task 2',
      areasForImprovement: 'Improve paragraph transitions',
      criteria: {
        taskAchievement: { band: 6.5, improvementFocus: 'Detail data in Task 1' },
        coherenceAndCohesion: { band: 6.0, improvementFocus: 'Use varied discourse markers' }
      }
    },
    speaking: {
      status: 'completed',
      band: 7.0,
      strengths: 'Natural pacing and idiomatic phrases',
      areasForImprovement: 'Avoid repetition in Part 3',
      criteria: {
        fluencyAndCoherence: { band: 7.0, improvementFocus: 'Extend abstract points' }
      }
    }
  };

  const insights = deriveInsightsFromEvaluation(testSkills);
  assert(insights.strengths.length > 0, 'Generates real strengths for completed skills');
  assert(insights.priorityAreas.length > 0, 'Generates real priority areas for completed skills');
  assert(insights.recommendations.length > 0, 'Generates targeted drill recommendations');
  assert(insights.strengths.some(s => s.detail.includes('Clear argumentative structure')), 'Includes verified writing strength');

  // ── TEST 7: Reset Performance Data (Section 51) ──
  console.log('\n--- [Test 7] Reset Performance Data ---');
  // Mock localStorage for Node test
  globalThis.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
      key: (i) => Object.keys(store)[i] || null,
      get length() { return Object.keys(store).length; }
    };
  })();

  // Seed storage with scores and protected keys
  localStorage.setItem('omniprep_gemini_key', 'test-gemini-key');
  localStorage.setItem('omniprep_groq_key', 'test-groq-key');
  localStorage.setItem('omniprep_target_band', '8.5');
  localStorage.setItem('omniprep_theme', 'dark');

  recordAttempt({
    id: 'attempt-1',
    status: 'completed',
    overallBand: 7.5,
    skills: {
      listening: { status: 'completed', band: 7.5 },
      reading: { status: 'completed', band: 7.5 },
      writing: { status: 'completed', band: 7.5 },
      speaking: { status: 'completed', band: 7.5 },
    }
  });

  const beforeSummary = derivePerformanceSummary();
  assert(beforeSummary.hasScores === true, 'Performance store has scores before reset');
  assert(beforeSummary.overallBand === 7.5, 'Overall band is 7.5 before reset');

  resetPerformanceData();

  const afterSummary = derivePerformanceSummary();
  assert(afterSummary.hasScores === false, 'Performance store has no scores after reset');
  assert(afterSummary.overallBand === null, 'Overall band is null after reset');
  // Phase 4 security contract: plaintext API keys must NOT survive a reset —
  // credentials live encrypted server-side, never in localStorage.
  assert(localStorage.getItem('omniprep_gemini_key') === null, 'Plaintext Gemini key removed by reset');
  assert(localStorage.getItem('omniprep_groq_key') === null, 'Plaintext Groq key removed by reset');
  assert(localStorage.getItem('omniprep_target_band') === '8.5', 'Target band preserved after reset');
  assert(localStorage.getItem('omniprep_theme') === 'dark', 'Theme preserved after reset');

  // ── TEST 8: 90% Answered Listening Test Evaluation (Partial with Unanswered Items) ──
  console.log('\n--- [Test 8] 90% Answered Listening Test (36/40 Answered) ---');
  const dummyQuestions = Array.from({ length: 40 }, (_, i) => ({
    id: `q${i + 1}`,
    questionNumber: i + 1,
    answer: `answer${i + 1}`,
    type: 'completion'
  }));
  // Student answered 36 questions correctly, left 4 questions blank
  const dummyAnswers = {};
  for (let i = 1; i <= 36; i++) {
    dummyAnswers[`q${i}`] = `answer${i}`;
  }

  const listeningResult = await evaluateListeningResponses({
    sections: [{ part: 1, questions: dummyQuestions }],
    answers: dummyAnswers
  });

  assert(listeningResult.status === 'completed', '90% answered listening test has status completed');
  assert(listeningResult.raw === 36, `36 answers scored correctly (got ${listeningResult.raw})`);
  assert(listeningResult.total === 40, 'Total questions is 40');
  assert(listeningResult.band === 8.0, `Band score for 36/40 is 8.0 (got ${listeningResult.band})`);
  assert(listeningResult.percentage === 90, `Percentage is 90% (got ${listeningResult.percentage}%)`);
  assert(listeningResult.itemResults.q37.finalResult === 'INCORRECT', 'Unanswered q37 marked INCORRECT');
  assert(listeningResult.itemResults.q1.finalResult === 'CORRECT', 'Answered q1 marked CORRECT');

  console.log('\n============================================================');
  console.log(`ALL EVALUATION ARCHITECTURE TESTS PASSED (${passedTests} passed, ${failedTests} failed)`);
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
