import { buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';
import { getSpeakingTestAdapter } from '../content/contentAdapter.js';

export function getRandomizedSpeakingTest(seed = null) {
  const activeSeed = seed !== null ? seed : `speak-dyn-${Date.now()}`;
  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });
  return getSpeakingTestAdapter(manifest);
}

export function getSpeakingTest(testId) {
  if (!testId) return getRandomizedSpeakingTest();
  const manifest = buildDynamicPracticeManifest({ seed: testId, testType: 'UNKNOWN' });
  return getSpeakingTestAdapter(manifest);
}
