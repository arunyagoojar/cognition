/**
 * Reading data layer — PRODUCTION CONTENT (Phase 6).
 * Academic Reading tests from the verified production database.
 */
import {
  getProductionReadingTest,
  getRandomProductionReadingTest,
} from '../production/adapters.js';

export function getReadingTest(testId, includeAnswers = false) {
  if (!testId) return getRandomizedReadingTest(includeAnswers);
  // An explicit source identity must never resolve to a different random test.
  return getProductionReadingTest(testId, includeAnswers);
}

export function getRandomizedReadingTest(includeAnswers = false) {
  return getRandomProductionReadingTest(includeAnswers);
}
