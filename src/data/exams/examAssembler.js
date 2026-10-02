/**
 * Adapter layer replacing legacy content sources with the new V2 deterministic test builder.
 */
import { buildAuthenticMockManifest, buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';
import { 
  getListeningTestAdapter, 
  getReadingTestAdapter, 
  getWritingTestAdapter, 
  getSpeakingTestAdapter 
} from '../content/contentAdapter.js';
import { getPackagesByTestType } from '../content/contentRepository.js';

// We can dynamically build AVAILABLE_AUTHENTIC_TESTS from the V2 repo.
// For now, let's just grab all packages that have 4 listening sections (i.e. full tests)
export const AVAILABLE_AUTHENTIC_TESTS = getPackagesByTestType('listening', 'UNKNOWN')
  .filter(p => p.validation_state === 'VERIFIED' && p.sections?.length === 4)
  .map(p => ({
    id: p.canonical_id,
    book: 'Cognition IELTS',
    testNumber: p.test_id,
    label: p.title || `V2 Practice Test (${p.test_id})`
  }));

export function getAuthenticExam(testId) {
  // Use the ID as a seed to deterministically produce the mock
  const manifest = buildAuthenticMockManifest({ seed: testId, testType: 'UNKNOWN' });
  
  if (manifest.status !== 'OK') {
    return {
      testId: 'error-insufficient',
      title: 'Content Unavailable',
      isRandomized: false,
      error: manifest.error || 'CONTENT_INSUFFICIENT',
      manifest
    };
  }

  const listening = getListeningTestAdapter(manifest);
  const reading = getReadingTestAdapter(manifest);
  const writing = getWritingTestAdapter(manifest);
  const speaking = getSpeakingTestAdapter(manifest);

  return {
    testId: testId,
    title: `Authentic Mock Exam (${testId})`,
    book: 'Canonical V2',
    isRandomized: false,
    manifest, // store the manifest as the source of truth
    listening,
    reading,
    writing,
    speaking
  };
}

export function getRandomizedFullExam(seed = null) {
  const activeSeed = seed !== null && seed !== undefined ? seed : `dyn-${Math.floor(Math.random() * 1000000)}`;
  
  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });
  
  const listening = getListeningTestAdapter(manifest);
  const reading = getReadingTestAdapter(manifest);
  const writing = getWritingTestAdapter(manifest);
  const speaking = getSpeakingTestAdapter(manifest);

  return {
    testId: `mock-random-${activeSeed}`,
    title: `Dynamic Cambridge IELTS Mock Exam (${activeSeed})`,
    book: 'Multi-Cambridge Verified Pool',
    isRandomized: true,
    manifest,
    listening,
    reading,
    writing,
    speaking
  };
}
