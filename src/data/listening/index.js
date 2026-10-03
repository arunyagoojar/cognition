/**
 * Listening data layer — PRODUCTION CONTENT (Phase 3).
 *
 * Serves Listening tests from the production content database
 * (content-db → src/data/production/productionContent.js). The previous V2-backed
 * randomized generators are no longer the runtime source for Listening.
 */
import { getProductionListeningTest, getAllProductionListeningTests } from '../production/adapters.js';

export function getListeningTest(testId, includeAnswers = false) {
  if (!testId) return getRandomizedListeningTest(null, includeAnswers);
  const test = getProductionListeningTest(testId, includeAnswers);
  if (test) return test;
  // Unknown id → deterministic fallback to the first production test, through
  // the adapter so answers stay gated and media resolves to R2
  const all = getAllProductionListeningTests();
  return all.length ? getProductionListeningTest(all[0].testId, includeAnswers) : null;
}

export function getRandomizedListeningTest(seed = null, includeAnswers = false) {
  const all = getAllProductionListeningTests();
  if (!all.length) return null;
  let pick;
  if (seed) {
    const match = all.find(t => String(t.testId) === String(seed) || t.id === seed);
    pick = match || all[Math.floor(Math.random() * all.length)];
  } else {
    pick = all[Math.floor(Math.random() * all.length)];
  }
  return getProductionListeningTest(pick.testId, includeAnswers);
}

export { getAllProductionListeningTests };
