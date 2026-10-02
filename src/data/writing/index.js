/**
 * Writing data layer — PRODUCTION CONTENT (Phase 5).
 * Academic Writing tests from the production database; source Task 1 + Task 2
 * relationships preserved. Practice mode can serve a single task.
 */
import {
  getProductionWritingTest,
  getRandomProductionWritingTest,
  getRandomProductionWritingTask,
} from '../production/adapters.js';

export function getWritingTest(testId) {
  if (!testId) return getRandomizedWritingTest();
  return getProductionWritingTest(testId) || getRandomProductionWritingTest();
}

export function getRandomizedWritingTest() {
  return getRandomProductionWritingTest();
}

export function getRandomizedWritingTask(taskKind) {
  return getRandomProductionWritingTask(taskKind);
}
