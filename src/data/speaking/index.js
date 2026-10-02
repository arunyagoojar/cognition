/**
 * Speaking data layer — PRODUCTION CONTENT (Phase 3).
 *
 * Serves the available Speaking content from the production database: Part 2 cue
 * cards only (the source corpus contains no Part 1 / Part 3 material — coverage is
 * explicitly partial and the evaluation engine withholds an overall band unless
 * all three parts are attempted).
 */
import {
  getProductionSpeakingPackage,
  getRandomProductionSpeakingPackage,
} from '../production/adapters.js';

export function getSpeakingTest(testId) {
  if (!testId) return getRandomizedSpeakingTest();
  return getProductionSpeakingPackage(testId) || getRandomizedSpeakingTest();
}

export function getRandomizedSpeakingTest() {
  return getRandomProductionSpeakingPackage();
}
