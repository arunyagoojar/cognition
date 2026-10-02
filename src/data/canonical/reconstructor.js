/**
 * Full Authentic Test Reconstructor for Cognition IELTS
 * Reconstructs the complete 4-skill examination entirely from canonical packages,
 * compares structure against authentic manifests and source definitions,
 * checks physical audio and image asset existence, question continuous numbering,
 * and produces deterministic PASS / FAIL / NEEDS_REVIEW reconstruction reports.
 */

import { canonicalRepository } from './repository.js';
import { CANONICAL_PATTERNS } from './sourceEvidence.js';

// Safe Node environment detection for CLI / reconstruction tools (disabled in browser)
const isBrowser = typeof window !== 'undefined';
const nodeFs = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('fs') : null;
const nodePath = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('path') : null;
const nodeUrl = !isBrowser && typeof process !== 'undefined' && process.getBuiltinModule ? process.getBuiltinModule('url') : null;

let ROOT_DIR = null;
if (!isBrowser && nodePath && nodeUrl) {
  try {
    const filename = nodeUrl.fileURLToPath(import.meta.url);
    const dirname = nodePath.dirname(filename);
    ROOT_DIR = nodePath.resolve(dirname, '../../..');
  } catch (_) {}
}

/**
 * Verifies that a physical asset file exists on disk.
 */
function verifyAssetExists(relativeUrl) {
  if (!relativeUrl || !nodeFs || !nodePath || !ROOT_DIR) return false;
  const cleanPath = relativeUrl.replace(/^\//, '');
  const fullPath = nodePath.join(ROOT_DIR, 'public', cleanPath);
  return nodeFs.existsSync(fullPath);
}

/**
 * Reconstructs a complete authentic IELTS exam from canonical packages.
 */
export function reconstructTest(testId) {
  const errors = [];
  const warnings = [];
  const assetDiscrepancies = [];

  const manifest = canonicalRepository.getAuthenticManifest(testId);
  if (!manifest) {
    return {
      testId,
      status: 'FAIL',
      sectionsChecked: { listening: false, reading: false, writing: false, speaking: false },
      totalQuestions: 0,
      expectedQuestions: 85, // 40 L + 40 R + 2 W + 3 S
      assetDiscrepancies: [`Manifest not found for ${testId}`],
      errors: [`Manifest not found for ${testId}`],
      warnings: [],
      verifiedAt: new Date().toISOString()
    };
  }

  let totalQuestions = 0;
  const sectionsChecked = { listening: false, reading: false, writing: false, speaking: false };

  // 1. Listening Reconstruction (4 Sections, 40 Questions)
  try {
    const lSections = manifest.listening.map(id => canonicalRepository.getListeningSectionById(id));
    if (lSections.length !== 4) {
      errors.push(`Listening: Expected 4 sections in manifest, found ${lSections.length}`);
    }

    let lQuestionCount = 0;
    const lSeenQNums = new Set();

    lSections.forEach((sec, idx) => {
      const expectedSecNum = idx + 1;
      if (!sec) {
        errors.push(`Listening: Section package ${manifest.listening[idx]} could not be resolved`);
        return;
      }

      if (sec.sectionNumber !== expectedSecNum) {
        errors.push(`Listening Section ${sec.id}: expected sectionNumber ${expectedSecNum}, got ${sec.sectionNumber}`);
      }

      // Audio verification
      if (!sec.audio || !sec.audio.file) {
        errors.push(`Listening Section ${sec.id}: missing audio reference`);
      } else if (!verifyAssetExists(sec.audio.file)) {
        assetDiscrepancies.push(`Missing physical audio file: ${sec.audio.file}`);
        errors.push(`Listening Section ${sec.id}: audio file does not exist on disk: ${sec.audio.file}`);
      }

      // Question continuity
      (sec.questionGroups || []).forEach(grp => {
        (grp.questions || []).forEach(q => {
          lQuestionCount++;
          totalQuestions++;
          lSeenQNums.add(q.questionNumber);

          if (!q.answer || !q.answer.primaryAnswer) {
            errors.push(`Listening Question ${q.id}: missing primaryAnswer`);
          } else if (/^(answer\d+|item\d+|placeholder|\uffff)/i.test(q.answer.primaryAnswer)) {
            errors.push(`Listening Question ${q.id}: contains synthetic placeholder "${q.answer.primaryAnswer}"`);
          }
        });
      });
    });

    for (let q = 1; q <= 40; q++) {
      if (!lSeenQNums.has(q)) {
        errors.push(`Listening: Missing question number ${q} in 1-40 sequence`);
      }
    }

    if (lQuestionCount === 40 && errors.filter(e => e.startsWith('Listening')).length === 0) {
      sectionsChecked.listening = true;
    }
  } catch (err) {
    errors.push(`Listening reconstruction error: ${err.message}`);
  }

  // 2. Reading Reconstruction (3 Passages, 40 Questions)
  try {
    const rPassages = manifest.reading.map(id => canonicalRepository.getReadingPassageById(id));
    if (rPassages.length !== 3) {
      errors.push(`Reading: Expected 3 passages in manifest, found ${rPassages.length}`);
    }

    let rQuestionCount = 0;
    const rSeenQNums = new Set();

    rPassages.forEach((pass, idx) => {
      const expectedPassNum = idx + 1;
      if (!pass) {
        errors.push(`Reading: Passage package ${manifest.reading[idx]} could not be resolved`);
        return;
      }

      if (pass.passageNumber !== expectedPassNum) {
        errors.push(`Reading Passage ${pass.id}: expected passageNumber ${expectedPassNum}, got ${pass.passageNumber}`);
      }

      if (!pass.passageText || pass.passageText.length < 250) {
        errors.push(`Reading Passage ${pass.id}: passage text missing or too short (< 250 chars)`);
      }

      (pass.questionGroups || []).forEach(grp => {
        (grp.questions || []).forEach(q => {
          rQuestionCount++;
          totalQuestions++;
          rSeenQNums.add(q.questionNumber);

          if (!q.answer || !q.answer.primaryAnswer) {
            errors.push(`Reading Question ${q.id}: missing primaryAnswer`);
          } else if (/^(answer\d+|item\d+|placeholder|\uffff)/i.test(q.answer.primaryAnswer)) {
            errors.push(`Reading Question ${q.id}: contains synthetic placeholder "${q.answer.primaryAnswer}"`);
          }
        });
      });
    });

    for (let q = 1; q <= 40; q++) {
      if (!rSeenQNums.has(q)) {
        errors.push(`Reading: Missing question number ${q} in 1-40 sequence`);
      }
    }

    if (rQuestionCount === 40 && errors.filter(e => e.startsWith('Reading')).length === 0) {
      sectionsChecked.reading = true;
    }
  } catch (err) {
    errors.push(`Reading reconstruction error: ${err.message}`);
  }

  // 3. Writing Reconstruction (2 Tasks)
  try {
    const wTasks = manifest.writing.map(id => canonicalRepository.getWritingTaskById(id));
    if (wTasks.length !== 2) {
      errors.push(`Writing: Expected 2 tasks in manifest, found ${wTasks.length}`);
    }

    wTasks.forEach((task, idx) => {
      const expectedTaskNum = idx + 1;
      if (!task) {
        errors.push(`Writing: Task package ${manifest.writing[idx]} could not be resolved`);
        return;
      }

      totalQuestions++;

      if (task.taskNumber !== expectedTaskNum) {
        errors.push(`Writing Task ${task.id}: expected taskNumber ${expectedTaskNum}, got ${task.taskNumber}`);
      }

      if (!task.prompt || task.prompt.length < 20) {
        errors.push(`Writing Task ${task.id}: prompt missing or too short`);
      }

      if (task.taskNumber === 1) {
        if (!task.image || !task.image.file) {
          errors.push(`Writing Task 1 ${task.id}: missing image reference`);
        } else if (!verifyAssetExists(task.image.file)) {
          assetDiscrepancies.push(`Missing physical image file: ${task.image.file}`);
          errors.push(`Writing Task 1 ${task.id}: image file does not exist on disk: ${task.image.file}`);
        }
      }
    });

    if (errors.filter(e => e.startsWith('Writing')).length === 0) {
      sectionsChecked.writing = true;
    }
  } catch (err) {
    errors.push(`Writing reconstruction error: ${err.message}`);
  }

  // 4. Speaking Reconstruction (3 Parts)
  try {
    const sParts = manifest.speaking.map(id => canonicalRepository.getSpeakingPartById(id));
    if (sParts.length !== 3) {
      errors.push(`Speaking: Expected 3 parts in manifest, found ${sParts.length}`);
    }

    sParts.forEach((part, idx) => {
      const expectedPartNum = idx + 1;
      if (!part) {
        errors.push(`Speaking: Part package ${manifest.speaking[idx]} could not be resolved`);
        return;
      }

      totalQuestions++;

      if (part.partNumber !== expectedPartNum) {
        errors.push(`Speaking Part ${part.id}: expected partNumber ${expectedPartNum}, got ${part.partNumber}`);
      }

      if (part.partNumber === 2 && (!part.cueCard || !part.cueCard.topic)) {
        errors.push(`Speaking Part 2 ${part.id}: missing cueCard topic`);
      }
    });

    if (errors.filter(e => e.startsWith('Speaking')).length === 0) {
      sectionsChecked.speaking = true;
    }
  } catch (err) {
    errors.push(`Speaking reconstruction error: ${err.message}`);
  }

  const status = errors.length === 0 
    ? (warnings.length === 0 ? 'PASS' : 'NEEDS_REVIEW') 
    : 'FAIL';

  return {
    testId,
    status,
    sectionsChecked,
    totalQuestions,
    expectedQuestions: 85,
    assetDiscrepancies,
    errors,
    warnings,
    verifiedAt: new Date().toISOString()
  };
}

/**
 * Reconstructs all 24 authentic Cambridge tests and returns a full diagnostic report.
 */
export function reconstructAllTests() {
  const reports = [];
  for (let book = 14; book <= 19; book++) {
    for (let test = 1; test <= 4; test++) {
      const testId = `CAM${book}-T${test}`;
      reports.push(reconstructTest(testId));
    }
  }
  return reports;
}
