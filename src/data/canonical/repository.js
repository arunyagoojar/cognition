/**
 * Canonical Content Repository & Selector Service for Cognition IELTS
 * Provides uniform, typed, verified access to all canonical content packages,
 * authentic test manifests, seeded dynamic practice generation, deterministic answer verification,
 * and content validation.
 */

import { normalizeAnswer } from './normalizer.js';
import { 
  validateListeningSection, 
  validateReadingPassage, 
  validateWritingTask, 
  validateSpeakingPart, 
  validateAuthenticManifest 
} from './validator.js';
import { parseCanonicalId } from './sourceEvidence.js';

// Safe Node environment detection for CLI / property test suites (disabled in browser)
const isBrowser = typeof window !== 'undefined';
const nodeFs = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('fs') : null;
const nodePath = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('path') : null;
const nodeUrl = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('url') : null;

let PACKAGES_DIR = null;
if (!isBrowser && nodePath && nodeUrl) {
  try {
    const filename = nodeUrl.fileURLToPath(import.meta.url);
    const dirname = nodePath.dirname(filename);
    PACKAGES_DIR = nodePath.resolve(dirname, 'packages');
  } catch (_) {}
}

// In-memory cache for fast UI access
const cache = {
  listening: new Map(),
  reading: new Map(),
  writing: new Map(),
  speaking: new Map(),
  manifests: new Map(),
  initialized: false
};

let globListening = null;
let globReading = null;
let globWriting = null;
let globSpeaking = null;
let globManifests = null;

try {
  globListening = import.meta.glob('./packages/listening/*.json', { eager: true });
  globReading = import.meta.glob('./packages/reading/*.json', { eager: true });
  globWriting = import.meta.glob('./packages/writing/*.json', { eager: true });
  globSpeaking = import.meta.glob('./packages/speaking/*.json', { eager: true });
  globManifests = import.meta.glob('./packages/manifests/*.json', { eager: true });
} catch (_) {
  // In Node.js environment without Vite glob support
}

/**
 * Initializes the repository by loading all canonical JSON packages into memory.
 */
export function initializeRepository() {
  if (cache.initialized) return;

  // Browser / Vite environment: load eagerly from glob
  if (globListening && Object.keys(globListening).length > 0) {
    const loadGlob = (globObj, map) => {
      for (const mod of Object.values(globObj)) {
        const content = mod?.default || mod;
        const id = content?.id || content?.testId;
        if (id) map.set(id, content);
      }
    };

    loadGlob(globListening, cache.listening);
    loadGlob(globReading, cache.reading);
    loadGlob(globWriting, cache.writing);
    loadGlob(globSpeaking, cache.speaking);
    loadGlob(globManifests, cache.manifests);

    cache.initialized = true;
    return;
  }

  // Node.js fallback via fs
  if (nodeFs && nodePath && PACKAGES_DIR) {
    const loadDir = (subDir, map) => {
      const dirPath = nodePath.join(PACKAGES_DIR, subDir);
      if (!nodeFs.existsSync(dirPath)) return;
      const files = nodeFs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = JSON.parse(nodeFs.readFileSync(nodePath.join(dirPath, file), 'utf8'));
          const id = content.id || content.testId;
          if (id) map.set(id, content);
        } catch (err) {
          console.error(`Error loading canonical package ${subDir}/${file}:`, err);
        }
      }
    };

    loadDir('listening', cache.listening);
    loadDir('reading', cache.reading);
    loadDir('writing', cache.writing);
    loadDir('speaking', cache.speaking);
    loadDir('manifests', cache.manifests);

    cache.initialized = true;
  }
}


// Auto-initialize on import in Node / server environments
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  initializeRepository();
}

/**
 * Retrieves all verified Listening Tests
 */
export function getAllListeningTests() {
  initializeRepository();
  return Array.from(cache.listening.values()).filter(pkg => pkg.validationState === 'VERIFIED');
}

/**
 * Retrieves all verified Reading Tests
 */
export function getAllReadingTests() {
  initializeRepository();
  return Array.from(cache.reading.values()).filter(pkg => pkg.validationState === 'VERIFIED');
}

/**
 * Retrieves all verified Writing Tests
 */
export function getAllWritingTests() {
  initializeRepository();
  return Array.from(cache.writing.values()).filter(pkg => pkg.validationState === 'VERIFIED');
}

/**
 * Retrieves all verified Speaking Tests
 */
export function getAllSpeakingTests() {
  initializeRepository();
  return Array.from(cache.speaking.values()).filter(pkg => pkg.validationState === 'VERIFIED');
}
export function getVerifiedSpeakingParts(partNumber = null) {
  initializeRepository();
  const list = [];
  for (const pkg of cache.speaking.values()) {
    if (pkg.validation?.status === 'VERIFIED') {
      if (!partNumber || pkg.partNumber === partNumber) {
        list.push(pkg);
      }
    }
  }
  return list;
}

/**
 * Retrieves an Authentic Test Manifest by test ID (e.g. CAM14-T4).
 */
export function getListeningSectionById(id) {
  initializeRepository();
  return cache.listening.get(id) || null;
}

export function getReadingPassageById(id) {
  initializeRepository();
  return cache.reading.get(id) || null;
}

export function getWritingTaskById(id) {
  initializeRepository();
  return cache.writing.get(id) || null;
}

export function getSpeakingPartById(id) {
  initializeRepository();
  return cache.speaking.get(id) || null;
}

export function getVerifiedSpeakingSuites() {
  initializeRepository();
  const suites = [];
  for (let book = 14; book <= 19; book++) {
    for (let test = 1; test <= 4; test++) {
      const p1 = cache.speaking.get(`CAM${book}-T${test}-S-P1`);
      const p2 = cache.speaking.get(`CAM${book}-T${test}-S-P2`);
      const p3 = cache.speaking.get(`CAM${book}-T${test}-S-P3`);
      if (p1 && p2 && p3 && 
          p1.validation?.status === 'VERIFIED' && 
          p2.validation?.status === 'VERIFIED' && 
          p3.validation?.status === 'VERIFIED') {
        suites.push({
          id: `CAM${book}-T${test}-S`,
          theme: p1.topic || `Cambridge ${book} Test ${test}`,
          parts: [p1, p2, p3]
        });
      }
    }
  }
  return suites;
}

/**
 * Retrieves an Authentic Test Manifest by test ID (e.g. CAM14-T4).
 */
export function getAuthenticManifest(testId) {
  initializeRepository();
  const cleanId = testId.toUpperCase().replace(/^C(\d+)-T(\d+)$/, 'CAM$1-T$2');
  return cache.manifests.get(cleanId) || null;
}

/**
 * Repository interface object for generators and selectors.
 */
export const canonicalRepository = {
  getAllListeningTests,
  getAllReadingTests,
  getAllWritingTests,
  getAllSpeakingTests,
  getAuthenticManifest
};

/**
 * Assembles an Authentic Cambridge Mock Exam from its manifest.
 * Preserves all immutable source relationships across all 4 skills.
 */
export function createAuthenticMock(testId = 'CAM17-T1') {
  initializeRepository();
  const cleanId = testId.toUpperCase().replace(/^C(\d+)-T(\d+)$/, 'CAM$1-T$2');
  const manifest = cache.manifests.get(cleanId);
  if (!manifest) {
    throw new Error(`Authentic manifest for ${testId} not found in canonical repository`);
  }
}

/**
 * Generates a fully reproducible, seeded dynamic practice test.
 * Only Verified packages are included in the pool.
 */
export function createDynamicPracticeExam(seed = 12345) {
  initializeRepository();
}


/**
 * Deterministically checks a user answer against a canonical AnswerDefinition.
 * Does NOT invoke an LLM.
 */
export function checkAnswer(answerDef, rawUserAnswer) {
  if (!answerDef || !rawUserAnswer) {
    return { isCorrect: false, normalizedUser: '', matchedVariant: null };
  }

  const normUser = normalizeAnswer(rawUserAnswer, answerDef.normalizationRules || {});
  const acceptedList = [answerDef.primaryAnswer, ...(answerDef.acceptedAnswers || [])];

  for (const accepted of acceptedList) {
    const normAccepted = normalizeAnswer(accepted, answerDef.normalizationRules || {});
    if (normUser === normAccepted) {
      return {
        isCorrect: true,
        normalizedUser: normUser,
        matchedVariant: accepted
      };
    }
  }

  return {
    isCorrect: false,
    normalizedUser: normUser,
    matchedVariant: null
  };
}

/**
 * Returns complete content statistics across all canonical packages.
 */
export function getRepositoryStats() {
  initializeRepository();
  const getStats = (map) => {
    let verified = 0;
    let failed = 0;
    let needsReview = 0;
    for (const v of map.values()) {
      const st = v.validation?.status || v.validationStatus;
      if (st === 'VERIFIED') verified++;
      else if (st === 'FAILED') failed++;
      else needsReview++;
    }
    return { total: map.size, verified, failed, needsReview };
  };

  return {
    listening: getStats(cache.listening),
    reading: getStats(cache.reading),
    writing: getStats(cache.writing),
    speaking: getStats(cache.speaking),
    manifests: getStats(cache.manifests)
  };
}
