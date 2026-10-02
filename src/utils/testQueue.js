// Persistent Rotating Randomized Test Queue for IELTS Practice & Full Mock Exams
import { AVAILABLE_AUTHENTIC_TESTS } from '../data/exams/examAssembler.js';

const QUEUE_STORAGE_KEY = 'omniprep_test_rotation_queue_v2';
const RECENT_KEY = 'omniprep_recent_tests_v1';

/**
 * Random test id, avoiding the last few recently served tests so consecutive
 * practice sessions always feel fresh (exit + restart gives a new test).
 */
export function getRandomTestId(excludeCount = 5) {
  const all = AVAILABLE_AUTHENTIC_TESTS.map(t => t.id);
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch (_) { recent = []; }
  const pool = all.filter(id => !recent.includes(id));
  const pickFrom = pool.length ? pool : all;
  const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  recent = [pick, ...recent.filter(id => id !== pick)].slice(0, excludeCount);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (_) {}
  return pick;
}

/**
 * Modern Fisher-Yates shuffle algorithm.
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Loads the persisted queue state from localStorage.
 */
export function getStoredQueueState() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse test rotation queue from localStorage', e);
    return null;
  }
}

/**
 * Saves the queue state to localStorage.
 */
export function saveQueueState(state) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Failed to persist test rotation queue', e);
  }
}

/**
 * Synchronizes queue with available tests:
 * - If no queue exists, creates a fresh randomized queue.
 * - If new tests were added to the dataset, inserts them into the unplayed pool without destroying current progress.
 * - Removes any test IDs that no longer exist.
 */
export function initializeOrSyncQueue() {
  const allTestIds = AVAILABLE_AUTHENTIC_TESTS.map(t => t.id);
  const stored = getStoredQueueState();

  if (!stored || !Array.isArray(stored.queue) || stored.queue.length === 0) {
    const freshQueue = shuffleArray(allTestIds);
    const initialState = {
      queue: freshQueue,
      completedInCycle: [],
      cycleNumber: 1
    };
    saveQueueState(initialState);
    return initialState;
  }

  let { queue, completedInCycle = [], cycleNumber = 1 } = stored;

  // Filter out any IDs that no longer exist in AVAILABLE_AUTHENTIC_TESTS
  queue = queue.filter(id => allTestIds.includes(id));
  completedInCycle = completedInCycle.filter(id => allTestIds.includes(id));

  // Detect any new tests added to the dataset
  const missingTests = allTestIds.filter(id => !queue.includes(id));
  if (missingTests.length > 0) {
    const shuffledNew = shuffleArray(missingTests);
    // Insert new tests into the unplayed section of the queue
    const unplayedPart = queue.filter(id => !completedInCycle.includes(id));
    const playedPart = queue.filter(id => completedInCycle.includes(id));
    queue = [...unplayedPart, ...shuffledNew, ...playedPart];
  }

  const syncedState = { queue, completedInCycle, cycleNumber };
  saveQueueState(syncedState);
  return syncedState;
}

/**
 * Returns the currently recommended next test in the rotating queue.
 * A completed test will NOT appear again until all available tests in the rotation cycle are completed.
 */
export function getNextTestInRotation() {
  const { completedInCycle, cycleNumber } = initializeOrSyncQueue();
  const allTests = AVAILABLE_AUTHENTIC_TESTS;

  // Random pick among the tests not yet completed in this rotation cycle —
  // every practice start serves a fresh test (old behaviour replayed a fixed order).
  const uncompleted = allTests.filter(t => !completedInCycle.includes(t.id));
  const pool = uncompleted.length ? uncompleted : allTests;
  const testMeta = pool[Math.floor(Math.random() * pool.length)];
  const nextId = testMeta.id;

  const completedCount = completedInCycle.length;
  const totalCount = allTests.length;
  const queue = allTests.map(t => t.id);
  const positionInRotation = completedCount + 1;

  return {
    test: testMeta,
    testId: testMeta.id,
    label: testMeta.label,
    book: testMeta.book,
    testNumber: testMeta.testNumber,
    completedCount,
    totalCount,
    positionInRotation: Math.min(positionInRotation, totalCount),
    cycleNumber,
    isNextInRotation: true
  };
}

/**
 * Marks a test as completed:
 * - Moves the completed test to the BACK of the queue.
 * - Records it in completedInCycle so it cannot appear again until all others are finished.
 * - When all tests in the cycle have been completed, starts a new cycle and resets cycle completions.
 */
export function markTestCompletedInRotation(testId) {
  if (!testId) return getNextTestInRotation();

  const state = initializeOrSyncQueue();
  const allTestIds = AVAILABLE_AUTHENTIC_TESTS.map(t => t.id);

  let { queue, completedInCycle, cycleNumber } = state;

  // Move testId to the BACK of the queue
  queue = [...queue.filter(id => id !== testId), testId];

  // Add to completedInCycle if not already present
  if (!completedInCycle.includes(testId)) {
    completedInCycle = [...completedInCycle, testId];
  }

  // Check if all available tests have now been completed in this rotation cycle
  if (completedInCycle.length >= allTestIds.length) {
    // Cycle is complete! Start new cycle and reshuffle unplayed queue
    cycleNumber += 1;
    completedInCycle = [];
    queue = shuffleArray(allTestIds);
  }

  const updatedState = { queue, completedInCycle, cycleNumber };
  saveQueueState(updatedState);
  return getNextTestInRotation();
}

/**
 * Resets the rotation queue back to an initial fresh shuffled state.
 */
export function resetTestQueue() {
  const allTestIds = AVAILABLE_AUTHENTIC_TESTS.map(t => t.id);
  const freshQueue = shuffleArray(allTestIds);
  const initialState = {
    queue: freshQueue,
    completedInCycle: [],
    cycleNumber: 1
  };
  saveQueueState(initialState);
  return getNextTestInRotation();
}
