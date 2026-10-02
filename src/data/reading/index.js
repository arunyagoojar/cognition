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
  return getProductionReadingTest(testId, includeAnswers) || getRandomProductionReadingTest(includeAnswers);
}

export function getRandomizedReadingTest(includeAnswers = false) {
  return getRandomProductionReadingTest(includeAnswers);
}
