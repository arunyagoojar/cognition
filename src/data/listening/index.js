import { buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';
import { getListeningTestAdapter } from '../content/contentAdapter.js';

export function getRandomizedListeningTest(seed = null, includeAnswers = false) {
  const activeSeed = seed !== null ? seed : `listen-dyn-${Date.now()}`;
  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });
  return getListeningTestAdapter(manifest, includeAnswers);
}

export function getListeningTest(testId, includeAnswers = false) {
  if (!testId) return getRandomizedListeningTest(null, includeAnswers);
  const manifest = buildDynamicPracticeManifest({ seed: testId, testType: 'UNKNOWN' });
  return getListeningTestAdapter(manifest, includeAnswers);
}
