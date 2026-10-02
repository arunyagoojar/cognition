import { buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';
import { getReadingTestAdapter } from '../content/contentAdapter.js';

export function getRandomizedReadingTest(seed = null) {
  const activeSeed = seed !== null ? seed : `read-dyn-${Date.now()}`;
  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });
  return getReadingTestAdapter(manifest);
}

export function getReadingTest(testId) {
  if (!testId) return getRandomizedReadingTest();
  const manifest = buildDynamicPracticeManifest({ seed: testId, testType: 'UNKNOWN' });
  return getReadingTestAdapter(manifest);
}
