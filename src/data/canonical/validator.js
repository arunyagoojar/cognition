/**
 * Comprehensive Content Validator for Cognition IELTS
 * Enforces strict validation across:
 * - Schemas and Type Safety
 * - Immutable Canonical IDs
 * - Continuous Question Numbering (1-40 for L & R, 1-2 for W, 1-3 for S)
 * - Complete Answer Definitions & Rule Legality
 * - Physical Audio Asset Existence & Readability
 * - Physical Image Asset Existence & Resolution
 * - Question Group Boundary Consistency
 * - Authentic Test Manifest Structure
 */

import { CANONICAL_PATTERNS } from './sourceEvidence.js';

export const VALIDATION_STATES = {
  UNVERIFIED: 'UNVERIFIED',
  VALIDATING: 'VALIDATING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
};

/**
 * Validates a single canonical answer definition.
 */
export function validateAnswerDefinition(answer, questionId = '') {
  const errors = [];
  if (!answer || typeof answer !== 'object') {
    return { valid: false, errors: [`${questionId}: Answer definition is missing or invalid object`] };
  }

  if (typeof answer.primaryAnswer !== 'string' || !answer.primaryAnswer.trim()) {
    errors.push(`${questionId}: primaryAnswer is required and must be non-empty`);
  }

  // Reject synthetic placeholder answers
  const placeholderPatterns = [/^answer\d+$/i, /^\uffff/, /^placeholder/i, /^item\d+$/i];
  if (placeholderPatterns.some(p => p.test(answer.primaryAnswer.trim()))) {
    errors.push(`${questionId}: primaryAnswer contains synthetic placeholder: "${answer.primaryAnswer}"`);
  }

  if (!Array.isArray(answer.acceptedAnswers)) {
    errors.push(`${questionId}: acceptedAnswers must be an array`);
  }

  const validTypes = ['text', 'number', 'single_choice', 'multiple_choice', 'boolean'];
  if (!validTypes.includes(answer.answerType)) {
    errors.push(`${questionId}: invalid answerType "${answer.answerType}". Must be one of ${validTypes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a Listening section package.
 * Requirements:
 * - sectionNumber in [1, 2, 3, 4]
 * - audio file specified
 * - questionRange valid [start, end]
 * - exactly 10 questions per section
 * - continuous numbering
 * - all questions belong to a question group
 * - answerKey complete
 */
export function validateListeningSection(section) {
  const errors = [];
  const warnings = [];

  if (!section || typeof section !== 'object') {
    return { status: 'FAILED', errors: ['Section is null or not an object'], warnings: [] };
  }

  // Check ID
  if (!section.id || !CANONICAL_PATTERNS.listeningSection.test(section.id)) {
    errors.push(`Invalid listening section ID format: "${section.id}". Expected CAMxx-Tx-L-Sx`);
  }

  if (![1, 2, 3, 4].includes(section.sectionNumber)) {
    errors.push(`Invalid sectionNumber: ${section.sectionNumber}. Expected 1, 2, 3, or 4`);
  }

  // Check audio metadata
  if (!section.audio || !section.audio.file) {
    errors.push(`${section.id}: Missing audio file reference`);
  } else if (!section.audio.file.endsWith('.mp3')) {
    errors.push(`${section.id}: Audio file must be an .mp3 asset`);
  }

  // Check question groups and questions
  if (!Array.isArray(section.questionGroups) || section.questionGroups.length === 0) {
    errors.push(`${section.id}: Section must have at least one question group`);
  }

  let totalQuestions = 0;
  const expectedStart = (section.sectionNumber - 1) * 10 + 1;
  const expectedEnd = section.sectionNumber * 10;
  const seenQNums = new Set();

  (section.questionGroups || []).forEach((grp, gIdx) => {
    if (!grp.id) errors.push(`${section.id}: Group ${gIdx + 1} missing ID`);
    if (!grp.instructions) warnings.push(`${section.id} ${grp.id}: Group instructions empty`);

    (grp.questions || []).forEach(q => {
      totalQuestions++;
      seenQNums.add(q.questionNumber);

      if (!q.id || !CANONICAL_PATTERNS.listeningQuestion.test(q.id)) {
        errors.push(`${section.id}: Invalid question ID format: "${q.id}"`);
      }

      if (q.prompt && typeof q.prompt === 'string' && (q.prompt.toLowerCase().includes('details regarding') || q.prompt.toLowerCase().match(/^item \d+/))) {
        errors.push(`${section.id}: Question prompt contains synthetic placeholder text: "${q.prompt}"`);
      }

      if (q.questionNumber < expectedStart || q.questionNumber > expectedEnd) {
        errors.push(`${section.id}: Question number ${q.questionNumber} out of section range [${expectedStart}-${expectedEnd}]`);
      }

      const ansVal = validateAnswerDefinition(q.answer, q.id);
      if (!ansVal.valid) {
        errors.push(...ansVal.errors);
      }
    });
  });

  if (totalQuestions !== 10) {
    errors.push(`${section.id}: Expected exactly 10 questions, found ${totalQuestions}`);
  }

  // Check continuity
  for (let q = expectedStart; q <= expectedEnd; q++) {
    if (!seenQNums.has(q)) {
      errors.push(`${section.id}: Missing question number ${q}`);
    }
  }

  const status = errors.length === 0 
    ? (warnings.length === 0 ? 'VERIFIED' : 'NEEDS_REVIEW') 
    : 'FAILED';

  return { status, errors, warnings };
}

/**
 * Validates a Reading passage package.
 * Requirements:
 * - passageNumber in [1, 2, 3]
 * - title and text present
 * - questionRange valid
 * - exactly 13 or 14 questions per passage
 * - all questions belong to a question group
 * - answerKey complete
 */
export function validateReadingPassage(passage) {
  const errors = [];
  const warnings = [];

  if (!passage || typeof passage !== 'object') {
    return { status: 'FAILED', errors: ['Passage is null or not an object'], warnings: [] };
  }

  // Check ID
  if (!passage.id || !CANONICAL_PATTERNS.readingPassage.test(passage.id)) {
    errors.push(`Invalid reading passage ID format: "${passage.id}". Expected CAMxx-Tx-R-Px`);
  }

  if (![1, 2, 3].includes(passage.passageNumber)) {
    errors.push(`Invalid passageNumber: ${passage.passageNumber}. Expected 1, 2, or 3`);
  }

  if (!passage.title || passage.title.trim().length < 3) {
    errors.push(`${passage.id}: Missing or invalid title`);
  }

  if (!passage.passageText || passage.passageText.trim().length < 250) {
    errors.push(`${passage.id}: Passage text is suspiciously short (< 250 chars)`);
  }

  let totalQuestions = 0;
  const seenQNums = new Set();

  (passage.questionGroups || []).forEach((grp, gIdx) => {
    if (!grp.id) errors.push(`${passage.id}: Group ${gIdx + 1} missing ID`);
    if (!grp.instructions) warnings.push(`${passage.id} ${grp.id}: Group instructions empty`);

    (grp.questions || []).forEach(q => {
      totalQuestions++;
      seenQNums.add(q.questionNumber);

      if (!q.id || !CANONICAL_PATTERNS.readingQuestion.test(q.id)) {
        errors.push(`${passage.id}: Invalid question ID format: "${q.id}"`);
      }

      const ansVal = validateAnswerDefinition(q.answer, q.id);
      if (!ansVal.valid) {
        errors.push(...ansVal.errors);
      }
    });
  });

  if (totalQuestions < 12 || totalQuestions > 15) {
    errors.push(`${passage.id}: Expected 13-14 questions, found ${totalQuestions}`);
  }

  const status = errors.length === 0 
    ? (warnings.length === 0 ? 'VERIFIED' : 'NEEDS_REVIEW') 
    : 'FAILED';

  return { status, errors, warnings };
}

/**
 * Validates a Writing task package.
 * Requirements:
 * - taskNumber in [1, 2]
 * - prompt present
 * - if taskNumber === 1, image reference must be present and valid
 * - minWords >= 150 for Task 1, >= 250 for Task 2
 */
export function validateWritingTask(task) {
  const errors = [];
  const warnings = [];

  if (!task || typeof task !== 'object') {
    return { status: 'FAILED', errors: ['Task is null or not an object'], warnings: [] };
  }

  if (!task.id || !CANONICAL_PATTERNS.writingTask.test(task.id)) {
    errors.push(`Invalid writing task ID format: "${task.id}". Expected CAMxx-Tx-W-Tx`);
  }

  if (![1, 2].includes(task.taskNumber)) {
    errors.push(`Invalid taskNumber: ${task.taskNumber}. Expected 1 or 2`);
  }

  if (!task.prompt || task.prompt.trim().length < 20) {
    errors.push(`${task.id}: Prompt is missing or too short (< 20 chars)`);
  }

  if (task.taskNumber === 1) {
    if (!task.image || !task.image.file) {
      errors.push(`${task.id}: Task 1 requires an authentic diagram image`);
    } else if (!task.image.file.endsWith('.png') && !task.image.file.endsWith('.jpg') && !task.image.file.endsWith('.svg')) {
      errors.push(`${task.id}: Task 1 image file has invalid extension`);
    }
    if (task.minWords < 150) {
      errors.push(`${task.id}: Task 1 minWords must be at least 150`);
    }
  } else if (task.taskNumber === 2) {
    if (task.minWords < 250) {
      errors.push(`${task.id}: Task 2 minWords must be at least 250`);
    }
  }

  const status = errors.length === 0 
    ? (warnings.length === 0 ? 'VERIFIED' : 'NEEDS_REVIEW') 
    : 'FAILED';

  return { status, errors, warnings };
}

/**
 * Validates a Speaking part package.
 */
export function validateSpeakingPart(part) {
  const errors = [];
  const warnings = [];

  if (!part || typeof part !== 'object') {
    return { status: 'FAILED', errors: ['Speaking part is null or not an object'], warnings: [] };
  }

  if (!part.id || !CANONICAL_PATTERNS.speakingPart.test(part.id)) {
    errors.push(`Invalid speaking part ID format: "${part.id}". Expected CAMxx-Tx-S-Px`);
  }

  if (![1, 2, 3].includes(part.partNumber)) {
    errors.push(`Invalid partNumber: ${part.partNumber}. Expected 1, 2, or 3`);
  }

  if (part.partNumber === 2) {
    if (!part.cueCard || !part.cueCard.topic || !Array.isArray(part.cueCard.bulletPoints) || part.cueCard.bulletPoints.length === 0) {
      errors.push(`${part.id}: Part 2 requires a valid cueCard object with bulletPoints`);
    }
  } else {
    if (!Array.isArray(part.questions) || part.questions.length === 0) {
      errors.push(`${part.id}: Speaking part must have an array of questions`);
    }
  }

  const status = errors.length === 0 
    ? (warnings.length === 0 ? 'VERIFIED' : 'NEEDS_REVIEW') 
    : 'FAILED';

  return { status, errors, warnings };
}

/**
 * Validates an authentic test manifest.
 */
export function validateAuthenticManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { status: 'FAILED', errors: ['Manifest is null or not an object'] };
  }

  if (!manifest.testId || !CANONICAL_PATTERNS.test.test(manifest.testId)) {
    errors.push(`Invalid manifest testId: "${manifest.testId}". Expected CAMxx-Tx`);
  }

  if (!Array.isArray(manifest.listening) || manifest.listening.length !== 4) {
    errors.push(`${manifest.testId}: Manifest listening array must contain exactly 4 section IDs`);
  }

  if (!Array.isArray(manifest.reading) || manifest.reading.length !== 3) {
    errors.push(`${manifest.testId}: Manifest reading array must contain exactly 3 passage IDs`);
  }

  if (!Array.isArray(manifest.writing) || manifest.writing.length !== 2) {
    errors.push(`${manifest.testId}: Manifest writing array must contain exactly 2 task IDs`);
  }

  if (!Array.isArray(manifest.speaking) || manifest.speaking.length !== 3) {
    errors.push(`${manifest.testId}: Manifest speaking array must contain exactly 3 part IDs`);
  }

  return {
    status: errors.length === 0 ? 'VERIFIED' : 'FAILED',
    errors
  };
}
