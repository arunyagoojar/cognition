/**
 * Exam assembler — PRODUCTION CONTENT (Phase 3).
 *
 * Listening and Speaking are served from the production content database
 * (content-db → src/data/production/productionContent.js). Reading and Writing
 * and Reading are served from the production content database.
 */
import { CONTENT_CATALOG } from '../production/registry.js';
import { getAuditedListeningIdentity } from '../production/listeningAvailability.js';
import { getPreferredPracticePool } from '../production/practicePriority.js';
import {
  PRODUCTION_LISTENING,
  PRODUCTION_SPEAKING,
  PRODUCTION_WRITING,
} from '../production/registry.js';
import {
  adaptProductionListening,
  adaptProductionSpeaking,
  adaptProductionWriting,
  adaptProductionReading,
  getAllProductionReadingTests,
  getAllProductionListeningTests,
} from '../production/adapters.js';

function pickReadingCluster(testId) {
  const pool = getPreferredPracticePool('reading', getAllProductionReadingTests());
  const match = pool.find(rec => String(rec.testId) === String(testId) || rec.id === String(testId));
  if (match || !pool.length) return match || null;
  // Pin an intact cluster to exam IDs with no corresponding Reading test.
  // Restoring that exam must not select a different Reading source package.
  let hash = 0;
  for (const char of String(testId)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

// The test rotation queue is driven by the production Listening corpus.
export const AVAILABLE_AUTHENTIC_TESTS = CONTENT_CATALOG.listening.map(rec => ({
  id: rec.testId,
  book: getAuditedListeningIdentity(rec)?.label.split(' · ')[0] || (rec.cambridgeIdentity?.length
    ? `Cambridge ${rec.cambridgeIdentity[0].book}`
    : 'Cognition IELTS'),
  testNumber: rec.testId,
  label: getAuditedListeningIdentity(rec)?.label || (rec.cambridgeIdentity?.length
    ? `${rec.title} (Cambridge ${rec.cambridgeIdentity[0].book} Test ${rec.cambridgeIdentity[0].test})`
    : rec.title),
}));

function pickProductionListening(testId) {
  const pool = getPreferredPracticePool('listening', getAllProductionListeningTests());
  const match = pool.find(
    t => String(t.testId) === String(testId) || t.id === String(testId));
  let index = Math.floor(Math.random() * pool.length);
  if (testId !== null && testId !== undefined) {
    let hash = 0;
    for (const char of String(testId)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    index = hash % pool.length;
  }
  const rec = match || pool[index];
  return rec ? adaptProductionListening(rec, true) : null;
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
  const readingRec = pickReadingCluster(testId);

  const manifest = { seed: testId, testType: 'UNKNOWN', source: 'production-database' };

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
    reading: readingRec ? adaptProductionReading(readingRec, true) : null,
    writing,
    speaking
  };
}

export function getRandomizedFullExam(seed = null) {
  const activeSeed = seed !== null && seed !== undefined ? seed : `dyn-${Math.floor(Math.random() * 1000000)}`;
  const savedTestId = PRODUCTION_LISTENING.some(t => String(t.testId) === String(seed))
    ? String(seed) : null;

  const manifest = { seed: activeSeed, testType: 'UNKNOWN', source: 'production-database' };

  const listening = pickProductionListening(savedTestId);
  const listeningTestId = listening?.testId;
  const writingRec = PRODUCTION_WRITING.find(w => String(w.testId) === String(listeningTestId))
    || PRODUCTION_WRITING[Math.floor(Math.random() * PRODUCTION_WRITING.length)];
  const readingRec = pickReadingCluster(listeningTestId);

  return {
    testId: listeningTestId ? String(listeningTestId) : `mock-random-${activeSeed}`,
    title: `Dynamic IELTS Mock Exam (${listening?.title || activeSeed})`,
    book: 'Cognition Production Content',
    isRandomized: !savedTestId,
    manifest,
    listening,
    reading: readingRec ? adaptProductionReading(readingRec, true) : null,
    writing: writingRec ? adaptProductionWriting(writingRec) : null,
    speaking: pickProductionSpeaking()
  };
}
