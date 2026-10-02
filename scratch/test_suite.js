import { 
  createAttemptId, 
  getPerformanceStore, 
  recordAttempt, 
  derivePerformanceSummary, 
  resetPerformanceData,
  PERFORMANCE_STORAGE_KEY
} from '../src/utils/performanceStore.js';
import { 
  validateSpeakingEvaluationJson, 
  validateWritingEvaluationJson,
  IELTS_SPEAKING_SYSTEM_PROMPT_V1,
  IELTS_WRITING_SYSTEM_PROMPT_V1
} from '../src/utils/geminiEvaluator.js';
import { 
  initializeOrSyncQueue, 
  getNextTestInRotation, 
  markTestCompletedInRotation, 
  resetTestQueue 
} from '../src/utils/testQueue.js';
import { AVAILABLE_AUTHENTIC_TESTS } from '../src/data/exams/examAssembler.js';

// Polyfill window, localStorage, and CustomEvent for node testing
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
};

let passed = 0;
let failed = 0;

function assert(condition, testName, message = '') {
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testName}: ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('RUNNING COGNITION 13-POINT ARCHITECTURE ACCEPTANCE TESTS');
console.log('====================================================\n');

// Clear storage before starting
localStorage.clear();

// TEST 1: New Speaking attempt. band = null before evaluation.
const newAttemptId = createAttemptId('speaking');
const initialSpeakingAttempt = {
  id: newAttemptId,
  type: 'speaking',
  testId: 'cambridge17_t1',
  status: 'not_started',
  overallBand: null,
  speaking: {
    band: null,
    evaluationStatus: 'not_started',
    criteria: null
  }
};
recordAttempt(initialSpeakingAttempt);
const storedAttempt = getPerformanceStore().attempts.find(a => a.id === newAttemptId);
assert(
  storedAttempt && storedAttempt.overallBand === null && storedAttempt.speaking.band === null,
  'TEST 1: New Speaking attempt band is strictly null before evaluation',
  `Expected null but got: ${storedAttempt?.speaking?.band}`
);

// TEST 2: AI evaluation begins. status = evaluating, band = null.
const evaluatingAttempt = {
  ...storedAttempt,
  status: 'evaluating',
  overallBand: null,
  speaking: {
    ...storedAttempt.speaking,
    evaluationStatus: 'evaluating',
    band: null
  }
};
recordAttempt(evaluatingAttempt);
const duringEval = getPerformanceStore().attempts.find(a => a.id === newAttemptId);
assert(
  duringEval && duringEval.speaking.evaluationStatus === 'evaluating' && duringEval.speaking.band === null,
  'TEST 2: Speaking attempt during evaluation has status = evaluating and band = null',
  `Expected evaluating and null, got ${duringEval?.speaking?.evaluationStatus}, ${duringEval?.speaking?.band}`
);

// TEST 3: AI evaluation succeeds. status = completed, band = actual validated result.
const validGeminiJson = {
  overallBand: 7.5,
  confidence: "high",
  criteria: {
    fluencyAndCoherence: { band: 7.5, evidence: "Good pace", rationale: "Clear", improvementFocus: "Idioms" },
    lexicalResource: { band: 7.5, evidence: "Wide vocab", rationale: "Precise", improvementFocus: "Collocations" },
    grammaticalRangeAndAccuracy: { band: 7.0, evidence: "Complex sentences", rationale: "Minor slips", improvementFocus: "Tenses" },
    pronunciation: { status: "insufficient_audio_evidence", band: null, evidence: "Text transcript", rationale: "Requires audio" }
  },
  overallSummary: "Strong communication demonstrated across all prompts."
};
const validatedResult = validateSpeakingEvaluationJson(validGeminiJson);
assert(
  validatedResult && validatedResult.overallBand === 7.5 && validatedResult.criteria.pronunciation.status === 'insufficient_audio_evidence' && validatedResult.criteria.pronunciation.band === null,
  'TEST 3a: Speaking AI JSON schema validation succeeds & enforces pronunciation audio guard',
  `Validated result: ${JSON.stringify(validatedResult)}`
);

const completedAttempt = {
  ...duringEval,
  status: 'completed',
  completedAt: new Date().toISOString(),
  overallBand: validatedResult.overallBand,
  speaking: {
    ...duringEval.speaking,
    evaluationStatus: 'completed',
    band: validatedResult.overallBand,
    criteria: validatedResult.criteria
  }
};
recordAttempt(completedAttempt);
const afterEval = getPerformanceStore().attempts.find(a => a.id === newAttemptId);
assert(
  afterEval && afterEval.speaking.evaluationStatus === 'completed' && afterEval.speaking.band === 7.5,
  'TEST 3b: Speaking completed attempt has validated band 7.5 in canonical store',
  `Expected 7.5, got ${afterEval?.speaking?.band}`
);

// TEST 4: AI evaluation fails. status = failed, band = null (NEVER substitute 7, 0, or default).
const invalidGeminiJson = {
  overallBand: 7.0
  // Missing criteria and explanations!
};
const failedValidation = validateSpeakingEvaluationJson(invalidGeminiJson);
assert(
  failedValidation === null,
  'TEST 4a: Malformed AI JSON is strictly rejected by schema validator',
  `Expected null but got: ${JSON.stringify(failedValidation)}`
);

const failedAttemptId = createAttemptId('speaking');
const failedAttempt = {
  id: failedAttemptId,
  type: 'speaking',
  testId: 'cambridge17_t2',
  status: 'completed',
  overallBand: null,
  speaking: {
    band: null,
    evaluationStatus: 'failed',
    criteria: null,
    message: 'AI evaluation failed to produce valid rubric response.'
  }
};
recordAttempt(failedAttempt);
const storedFailed = getPerformanceStore().attempts.find(a => a.id === failedAttemptId);
assert(
  storedFailed && storedFailed.speaking.evaluationStatus === 'failed' && storedFailed.speaking.band === null,
  'TEST 4b: Failed AI evaluation stores band = null without substituting default score',
  `Expected null, got ${storedFailed?.speaking?.band}`
);

// TEST 5: Reset Scores. All performance attempts removed. Reload application. Still zero historical scores.
resetPerformanceData();
const storeAfterReset = getPerformanceStore();
const summaryAfterReset = derivePerformanceSummary();
assert(
  storeAfterReset.attempts.length === 0 && summaryAfterReset.hasScores === false && summaryAfterReset.latestScores.speaking === null,
  'TEST 5a: resetPerformanceData removes all attempts and resets summary to empty',
  `Attempts count: ${storeAfterReset.attempts.length}`
);

// Simulate browser reload by reading fresh from localStorage
const reloadedStore = getPerformanceStore();
assert(
  reloadedStore.attempts.length === 0,
  'TEST 5b: Zero historical scores persist across application reload',
  `Expected 0 attempts, got ${reloadedStore.attempts.length}`
);

// TEST 6: Dashboard. Dashboard score is derived from canonical store.
// Record a 4-skill attempt and check derived overall band
const mockAttemptId = createAttemptId('full_mock');
recordAttempt({
  id: mockAttemptId,
  type: 'full_mock',
  testId: 'c17_t1',
  testLabel: 'Cambridge 17 · Test 1',
  status: 'completed',
  completedAt: new Date().toISOString(),
  listening: { band: 7.5, raw: 32 },
  reading: { band: 8.0, raw: 35 },
  writing: { band: 7.0, evaluationStatus: 'completed' },
  speaking: { band: 7.5, evaluationStatus: 'completed' }
});
const dashSummary = derivePerformanceSummary();
assert(
  dashSummary.hasScores === true && Number(dashSummary.overallBand) === 7.5 && dashSummary.latestScores.reading.band === 8.0,
  'TEST 6: Dashboard scores and overall band (7.5) are derived directly from canonical store',
  `Overall band: ${dashSummary.overallBand}`
);

// TEST 7: Performance page. Performance score matches canonical store.
assert(
  dashSummary.latestScores.listening.band === 7.5 && dashSummary.latestScores.writing.band === 7.0 && dashSummary.bestScores.reading === 8.0,
  'TEST 7: Performance page skill metrics and bestScores match canonical store',
  `Best reading: ${dashSummary.bestScores.reading}`
);

// TEST 8: Results page. Current attempt score matches canonical store.
const retrievedAttempt = getPerformanceStore().attempts.find(a => a.id === mockAttemptId);
assert(
  retrievedAttempt && retrievedAttempt.reading.band === 8.0 && retrievedAttempt.writing.band === 7.0,
  'TEST 8: Results page reads canonical attempt and matches exact score',
  `Retrieved: ${JSON.stringify(retrievedAttempt?.reading)}`
);

// TEST 9: Complete a mock test.
assert(
  retrievedAttempt.listening && retrievedAttempt.reading && retrievedAttempt.writing && retrievedAttempt.speaking,
  'TEST 9: Complete mock test records all 4 skills in one canonical attempt',
  `Attempt skills present: ${Object.keys(retrievedAttempt)}`
);

// TEST 10: After completing a test: Test moves to back of queue.
resetTestQueue();
const initialQueueState = initializeOrSyncQueue();
const test1 = getNextTestInRotation();
const firstTestId = test1.testId;
const initialQueueOrder = [...initialQueueState.queue];

// Complete firstTestId
markTestCompletedInRotation(firstTestId);
const queueAfterCompletion = initializeOrSyncQueue();
const lastItemInQueue = queueAfterCompletion.queue[queueAfterCompletion.queue.length - 1];
const nextTest = getNextTestInRotation();

assert(
  lastItemInQueue === firstTestId && nextTest.testId !== firstTestId,
  'TEST 10: Completed test moves to the back of the queue and next test is selected',
  `Last item in queue: ${lastItemInQueue}, First was: ${firstTestId}, Next is: ${nextTest.testId}`
);

// TEST 11: Complete all tests. New randomized cycle is generated.
const totalTestsCount = AVAILABLE_AUTHENTIC_TESTS.length;
// Mark remaining tests in cycle as completed
for (let i = 1; i < totalTestsCount; i++) {
  const current = getNextTestInRotation();
  markTestCompletedInRotation(current.testId);
}
const cycle2State = initializeOrSyncQueue();
assert(
  cycle2State.cycleNumber === 2 && cycle2State.completedInCycle.length === 0,
  'TEST 11: After completing all tests in cycle, cycle number increments to 2 and new pool begins',
  `Cycle number: ${cycle2State.cycleNumber}, completed in cycle: ${cycle2State.completedInCycle.length}`
);

// TEST 12: Start another test. Test is selected from the new randomized cycle.
const cycle2FirstTest = getNextTestInRotation();
assert(
  cycle2FirstTest && cycle2FirstTest.cycleNumber === 2 && AVAILABLE_AUTHENTIC_TESTS.some(t => t.id === cycle2FirstTest.testId),
  'TEST 12: Next test is correctly selected from the new randomized cycle pool',
  `Selected: ${cycle2FirstTest.label}`
);

// TEST 13: Reset scores. Historical scores reset. Test rotation remains intact.
const queueBeforeScoreReset = JSON.stringify(initializeOrSyncQueue());
resetPerformanceData();
const queueAfterScoreReset = JSON.stringify(initializeOrSyncQueue());
const performanceAfterReset = derivePerformanceSummary();

assert(
  performanceAfterReset.hasScores === false && performanceAfterReset.completedCount === 0 && queueBeforeScoreReset === queueAfterScoreReset,
  'TEST 13: Resetting performance data wipes all scores while keeping test rotation queue completely intact',
  `Performance hasScores: ${performanceAfterReset.hasScores}, Queue preserved: ${queueBeforeScoreReset === queueAfterScoreReset}`
);

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
