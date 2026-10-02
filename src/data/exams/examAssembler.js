/**
 * Exam assembler — PRODUCTION CONTENT (Phase 3).
 *
 * Listening and Speaking are served from the production content database
 * (content-db → src/data/production/productionContent.js). Reading and Writing
 * remain on the V2 content source until their production databases are built
 * (Phase 3 scope: Listening + Speaking only).
 */
import { buildAuthenticMockManifest, buildDynamicPracticeManifest } from '../content/contentTestBuilder.js';

import { getPackagesByTestType } from '../content/contentRepository.js';
import {
  PRODUCTION_LISTENING,
  PRODUCTION_SPEAKING,
  PRODUCTION_WRITING,
  PRODUCTION_READING,
} from '../production/productionContent.js';
import {
  adaptProductionListening,
  adaptProductionSpeaking,
  adaptProductionWriting,
  adaptProductionReading,
} from '../production/adapters.js';

// The test rotation queue is driven by the production Listening corpus.
export const AVAILABLE_AUTHENTIC_TESTS = PRODUCTION_LISTENING.map(rec => ({
  id: rec.testId,
  book: rec.cambridgeIdentity?.length
    ? `Cambridge ${rec.cambridgeIdentity[0].book}`
    : 'Cognition IELTS',
  testNumber: rec.testId,
  label: rec.cambridgeIdentity?.length
    ? `${rec.title} (Cambridge ${rec.cambridgeIdentity[0].book} Test ${rec.cambridgeIdentity[0].test})`
    : rec.title,
}));

function pickProductionListening(testId) {
  const match = PRODUCTION_LISTENING.find(
    t => String(t.testId) === String(testId) || t.id === String(testId));
  const rec = match || PRODUCTION_LISTENING[Math.floor(Math.random() * PRODUCTION_LISTENING.length)];
  return rec ? adaptProductionListening(rec, false) : null;
}

function pickProductionSpeaking() {
  const pool = PRODUCTION_SPEAKING;
  const pkg = pool[Math.floor(Math.random() * pool.length)];
  return pkg ? adaptProductionSpeaking(pkg) : null;
}

export function getAuthenticExam(testId) {
  // Listening + Speaking come from the production database, deterministically by testId.
  const listening = pickProductionListening(testId);
  const speaking = pickProductionSpeaking();

  // Writing now comes from the production database, matched by test number
  // (Writing test N pairs with Listening test N as the source packages are numbered).
  const writingRec = PRODUCTION_WRITING.find(w => String(w.testId) === String(testId))
    || PRODUCTION_WRITING[Math.floor(Math.random() * PRODUCTION_WRITING.length)];
  const writing = writingRec ? adaptProductionWriting(writingRec) : null;
  const readingRec = PRODUCTION_READING.find(r => String(r.testId) === String(testId))
    || PRODUCTION_READING[Math.floor(Math.random() * PRODUCTION_READING.length)];

  const manifest = buildAuthenticMockManifest({ seed: testId, testType: 'UNKNOWN' });

  if (!listening) {
    return {
      testId: 'error-insufficient',
      title: 'Content Unavailable',
      isRandomized: false,
      error: 'NO_PRODUCTION_LISTENING_CONTENT',
      manifest
    };
  }

  return {
    testId: testId,
    title: `Authentic Mock Exam (${listening.title})`,
    book: 'Cognition Production Content',
    isRandomized: false,
    manifest, // reading source of truth (V2) — to be replaced in a later phase
    listening,
    reading: readingRec ? adaptProductionReading(readingRec) : null,
    writing,
    speaking
  };
}

export function getRandomizedFullExam(seed = null) {
  const activeSeed = seed !== null && seed !== undefined ? seed : `dyn-${Math.floor(Math.random() * 1000000)}`;
  const savedTestId = PRODUCTION_LISTENING.some(t => String(t.testId) === String(seed))
    ? String(seed) : null;

  const manifest = buildDynamicPracticeManifest({ seed: activeSeed, testType: 'UNKNOWN' });

  const listening = pickProductionListening(savedTestId);
  const listeningTestId = listening?.testId;
  const writingRec = PRODUCTION_WRITING.find(w => String(w.testId) === String(listeningTestId))
    || PRODUCTION_WRITING[Math.floor(Math.random() * PRODUCTION_WRITING.length)];
  const readingRec = PRODUCTION_READING.find(r => String(r.testId) === String(listeningTestId))
    || PRODUCTION_READING[Math.floor(Math.random() * PRODUCTION_READING.length)];

  return {
    testId: listeningTestId ? String(listeningTestId) : `mock-random-${activeSeed}`,
    title: `Dynamic IELTS Mock Exam (${listening?.title || activeSeed})`,
    book: 'Cognition Production Content',
    isRandomized: !savedTestId,
    manifest,
    listening,
    reading: readingRec ? adaptProductionReading(readingRec) : null,
    writing: writingRec ? adaptProductionWriting(writingRec) : null,
    speaking: pickProductionSpeaking()
  };
}
