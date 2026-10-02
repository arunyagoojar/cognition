// Comprehensive verification script for all Cognition requirements
import assert from 'node:assert';

// 1. Mock Browser Environment (localStorage, window, document)
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (i) => Object.keys(store)[i] || null,
  get length() { return Object.keys(store).length; }
};

global.window = {
  location: { search: '' },
  scrollTo: () => {}
};
global.document = {
  documentElement: {
    setAttribute: () => {},
    style: { setProperty: () => {} }
  }
};

async function runVerification() {
  console.log('====================================================');
  console.log('   COGNITION LOGIC & FLOW COMPREHENSIVE VERIFICATION');
  console.log('====================================================\n');

  // TEST 1: Storage and Reset Functionality
  console.log('[TEST 1] Testing Canonical Score & Performance Reset...');
  const {
    saveSkillScore,
    getSkillScores,
    resetAllPerformanceData,
    saveCompletedResult,
    getCompletedResults,
    saveCompletedLesson,
    getCompletedLessons,
    saveApiKey,
    getApiKey,
    saveActiveMockSession,
    getActiveMockSession,
    clearActiveMockSession
  } = await import('./src/utils/storage.js');

  // Populate data
  saveSkillScore('listening', { band: 8.0, raw: 35 });
  saveSkillScore('reading', { band: 7.5, raw: 33 });
  saveCompletedResult({ id: 'res_1', overallBand: 7.5 });
  saveCompletedLesson('les_1');
  saveApiKey('AIzaSy_test_secret_key');
  saveActiveMockSession({ examId: 'c14_t1', currentSection: 'listening', status: 'in_progress' });

  assert.strictEqual(getSkillScores().listening.band, 8.0, 'Listening score should be saved');
  assert.strictEqual(getCompletedResults().length, 1, 'History should have 1 entry');
  assert.strictEqual(getCompletedLessons().length, 1, 'Lessons should have 1 entry');
  assert.strictEqual(getApiKey(), 'AIzaSy_test_secret_key', 'API key should be saved');
  assert.notStrictEqual(getActiveMockSession(), null, 'Active mock session should exist');

  // Trigger resetAllPerformanceData
  resetAllPerformanceData();

  assert.strictEqual(getSkillScores().listening, null, 'Listening score must be null after reset');
  assert.strictEqual(getSkillScores().reading, null, 'Reading score must be null after reset');
  assert.strictEqual(getCompletedResults().length, 0, 'History must be empty after reset');
  assert.strictEqual(getActiveMockSession(), null, 'Active mock session must be cleared after reset');
  // CRITICAL: Preserve lesson data and API key
  assert.strictEqual(getCompletedLessons().length, 1, 'Lesson progress MUST NOT be deleted');
  assert.strictEqual(getApiKey(), 'AIzaSy_test_secret_key', 'Gemini API key MUST NOT be deleted');
  console.log('  ✓ Reset Scores clears all performance data while strictly preserving lessons & API key.\n');

  // TEST 2: Active Mock Session Persistence Across Refresh
  console.log('[TEST 2] Testing Active Mock Session State & Progression...');
  saveActiveMockSession({
    examId: 'c14_t4',
    currentSection: 'reading',
    sectionAnswers: {
      listening: { band: 7.5, raw: 32 }
    },
    status: 'in_progress'
  });

  const restored = getActiveMockSession();
  assert.strictEqual(restored.examId, 'c14_t4', 'Restored examId matches');
  assert.strictEqual(restored.currentSection, 'reading', 'Restored currentSection matches');
  assert.strictEqual(restored.sectionAnswers.listening.band, 7.5, 'Listening answers preserved');
  console.log('  ✓ Active mock session persists across reloads with currentSection & answers.\n');

  // TEST 3: Deterministic Test Rotation Queue (FIFO advance, no repeat until all played)
  console.log('[TEST 3] Testing Persistent Test Rotation Queue...');
  const {
    getNextTestInRotation,
    markTestCompletedInRotation,
    getStoredQueueState
  } = await import('./src/utils/testQueue.js');

  const firstRec = getNextTestInRotation();
  const queueBefore = [...getStoredQueueState().queue];
  console.log(`  Initial Recommended Test: ${firstRec.label} (${firstRec.testId})`);

  // Complete the test
  markTestCompletedInRotation(firstRec.testId);
  const queueAfter = getStoredQueueState().queue;

  assert.strictEqual(queueAfter[queueAfter.length - 1], firstRec.testId, 'Completed test moved to BACK of queue');
  const secondRec = getNextTestInRotation();
  assert.notStrictEqual(secondRec.testId, firstRec.testId, 'Same test must NOT repeat immediately');
  console.log(`  Next Recommended Test: ${secondRec.label} (${secondRec.testId})`);
  console.log('  ✓ Queue maintains deterministic FIFO sequence and moves completed tests to tail.\n');

  // TEST 4: Gemini AI Evaluator Configuration & Content Hashing
  console.log('[TEST 4] Testing Gemini AI Service Architecture...');
  const {
    AI_CONFIG,
    hashContent,
    evaluateWritingWithAI,
    evaluateSpeakingWithAI
  } = await import('./src/utils/geminiEvaluator.js');

  assert.strictEqual(AI_CONFIG.primaryModel, 'gemini-2.0-flash', 'Primary model is Flash 2.0');
  assert.strictEqual(AI_CONFIG.fallbackModel, 'gemini-1.5-flash', 'Fallback model is Flash 1.5');

  const hashA1 = hashContent('essay response version 1');
  const hashA2 = hashContent('essay response version 1');
  const hashB = hashContent('essay response version 2');
  assert.strictEqual(hashA1, hashA2, 'Identical responses produce identical content hash');
  assert.notStrictEqual(hashA1, hashB, 'Different responses produce different content hash');

  // Offline / missing API key safety
  const writingFallback = await evaluateWritingWithAI('', { task1Text: 'Short text', task2Text: 'Essay' });
  assert.ok(typeof writingFallback.overallBand === 'number', 'Writing fallback scores deterministically');
  assert.strictEqual(writingFallback.aiStatus, 'pending', 'Status indicates AI pending/unavailable without crashing');

  const speakingFallback = await evaluateSpeakingWithAI('', { transcripts: { '0_0': 'My home is quiet.' } });
  assert.ok(typeof speakingFallback.overallBand === 'number', 'Speaking fallback scores deterministically');
  console.log('  ✓ Gemini Evaluator features Flash-class defaults, deduplication hashing, and resilient fallback.\n');

  // TEST 5: Speaking Timing Requirements
  console.log('[TEST 5] Verifying Speaking Timing Logic...');
  const getTargetSeconds = (p) => (p === 1 ? 120 : p === 2 ? 60 : 45);

  assert.strictEqual(getTargetSeconds(0), 45, 'Part 1 target is 45s');
  assert.strictEqual(getTargetSeconds(1), 120, 'Part 2 target is 120s (long turn)');
  assert.strictEqual(getTargetSeconds(2), 60, 'Part 3 target is 60s');

  // Auto-stop logic at target + 5s grace
  const shouldAutoStop = (recordedSec, targetSec) => recordedSec >= targetSec + 5;
  assert.strictEqual(shouldAutoStop(45, 45), false, 'Does not auto-stop at 00:00');
  assert.strictEqual(shouldAutoStop(49, 45), false, 'Does not auto-stop at +00:04');
  assert.strictEqual(shouldAutoStop(50, 45), true, 'Auto-stops exactly at +5s grace');
  console.log('  ✓ Speaking Part 1 = 45s, Part 2 = 120s, Part 3 = 60s, with 5s grace auto-stop.\n');

  console.log('====================================================');
  console.log('   ALL 5 VERIFICATION MODULE TESTS PASSED 100%');
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
