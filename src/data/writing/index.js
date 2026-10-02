import { buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';
import { getWritingTestAdapter } from '../content/contentAdapter.js';

export function getRandomizedWritingTest(seed = null) {
  const activeSeed = seed !== null ? seed : `write-dyn-${Date.now()}`;
  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });
  return getWritingTestAdapter(manifest);
}

export function getWritingTest(testId) {
  if (!testId) return getRandomizedWritingTest();
  const manifest = buildDynamicPracticeManifest({ seed: testId, testType: 'UNKNOWN' });
  return getWritingTestAdapter(manifest);
}
