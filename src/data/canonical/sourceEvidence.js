/**
 * Immutable Canonical ID System & Source Evidence Model for Cognition IELTS
 * Implements deterministic provenance tracking, coordinate bounding boxes,
 * and immutable hierarchical ID schemes.
 */

// Canonical ID Regex patterns
export const CANONICAL_PATTERNS = {
  test: /^CAM(\d{1,2})-T([1-4])$/,
  listeningSection: /^CAM(\d{1,2})-T([1-4])-L-S([1-4])$/,
  listeningQuestion: /^CAM(\d{1,2})-T([1-4])-L-S([1-4])-Q(\d{2})$/,
  listeningGroup: /^CAM(\d{1,2})-T([1-4])-L-S([1-4])-G(\d{2})$/,
  readingPassage: /^CAM(\d{1,2})-T([1-4])-R-P([1-3])$/,
  readingQuestion: /^CAM(\d{1,2})-T([1-4])-R-P([1-3])-Q(\d{2})$/,
  readingGroup: /^CAM(\d{1,2})-T([1-4])-R-P([1-3])-G(\d{2})$/,
  writingTask: /^CAM(\d{1,2})-T([1-4])-W-T([1-2])$/,
  speakingPart: /^CAM(\d{1,2})-T([1-4])-S-P([1-3])$/,
  speakingSuite: /^CAM(\d{1,2})-T([1-4])-S$/,
};

/**
 * Creates an immutable canonical test ID (e.g. CAM14-T4).
 */
export function formatTestId(book, test) {
  const b = String(book).replace(/[^0-9]/g, '');
  const t = String(test).replace(/[^0-9]/g, '');
  return `CAM${b}-T${t}`;
}

/**
 * Creates an immutable canonical Listening section ID (e.g. CAM14-T4-L-S1).
 */
export function formatListeningSectionId(book, test, section) {
  return `${formatTestId(book, test)}-L-S${section}`;
}

/**
 * Creates an immutable canonical Listening question ID (e.g. CAM14-T4-L-S1-Q01).
 */
export function formatListeningQuestionId(book, test, section, questionNumber) {
  const qStr = String(questionNumber).padStart(2, '0');
  return `${formatListeningSectionId(book, test, section)}-Q${qStr}`;
}

/**
 * Creates an immutable canonical Listening question group ID (e.g. CAM14-T4-L-S1-G01).
 */
export function formatListeningGroupId(book, test, section, groupNumber = 1) {
  const gStr = String(groupNumber).padStart(2, '0');
  return `${formatListeningSectionId(book, test, section)}-G${gStr}`;
}

/**
 * Creates an immutable canonical Reading passage ID (e.g. CAM14-T4-R-P1).
 */
export function formatReadingPassageId(book, test, passage) {
  return `${formatTestId(book, test)}-R-P${passage}`;
}

/**
 * Creates an immutable canonical Reading question ID (e.g. CAM14-T4-R-P1-Q01).
 */
export function formatReadingQuestionId(book, test, passage, questionNumber) {
  const qStr = String(questionNumber).padStart(2, '0');
  return `${formatReadingPassageId(book, test, passage)}-Q${qStr}`;
}

/**
 * Creates an immutable canonical Reading question group ID (e.g. CAM14-T4-R-P1-G01).
 */
export function formatReadingGroupId(book, test, passage, groupNumber = 1) {
  const gStr = String(groupNumber).padStart(2, '0');
  return `${formatReadingPassageId(book, test, passage)}-G${gStr}`;
}

/**
 * Creates an immutable canonical Writing task ID (e.g. CAM14-T4-W-T1).
 */
export function formatWritingTaskId(book, test, task) {
  return `${formatTestId(book, test)}-W-T${task}`;
}

/**
 * Creates an immutable canonical Speaking part ID (e.g. CAM14-T4-S-P1).
 */
export function formatSpeakingPartId(book, test, part) {
  return `${formatTestId(book, test)}-S-P${part}`;
}

/**
 * Creates an immutable canonical Speaking suite ID (e.g. CAM14-T4-S).
 */
export function formatSpeakingSuiteId(book, test) {
  return `${formatTestId(book, test)}-S`;
}

/**
 * Parses any canonical ID into its structured components.
 */
export function parseCanonicalId(id) {
  if (!id || typeof id !== 'string') return null;

  for (const [key, pattern] of Object.entries(CANONICAL_PATTERNS)) {
    const match = id.match(pattern);
    if (match) {
      return {
        type: key,
        book: parseInt(match[1], 10),
        test: parseInt(match[2], 10),
        unit: match[3] ? parseInt(match[3], 10) : undefined,
        item: match[4] ? parseInt(match[4], 10) : undefined,
        canonicalId: id
      };
    }
  }

  return null;
}

/**
 * Creates a validated SourceEvidence record.
 */
export function createSourceEvidence({
  sourceFile,
  sourceFileHash,
  sourcePage,
  sourceBoundingBox,
  originalExtractedText,
  normalizedText,
  extractionMethod = 'native_pdf',
  extractionConfidence = 1.0,
  notes = ''
}) {
  return {
    sourceFile: String(sourceFile || 'Cambridge IELTS Authentic Examination Papers'),
    sourceFileHash: sourceFileHash || undefined,
    sourcePage: Number(sourcePage || 1),
    sourceBoundingBox: sourceBoundingBox ? {
      x0: Number(sourceBoundingBox.x0 || 0),
      y0: Number(sourceBoundingBox.y0 || 0),
      x1: Number(sourceBoundingBox.x1 || 0),
      y1: Number(sourceBoundingBox.y1 || 0)
    } : undefined,
    originalExtractedText: String(originalExtractedText || ''),
    normalizedText: String(normalizedText || originalExtractedText || ''),
    extractionMethod,
    extractionConfidence: Math.min(1.0, Math.max(0.0, Number(extractionConfidence || 1.0))),
    notes: notes || undefined
  };
}

/**
 * Validates whether a SourceEvidence object contains mandatory fields.
 */
export function validateSourceEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, errors: ['Missing source evidence object'] };
  }

  const errors = [];
  if (!evidence.sourceFile) errors.push('sourceFile is required');
  if (typeof evidence.sourcePage !== 'number' || evidence.sourcePage < 1) {
    errors.push('sourcePage must be a positive integer');
  }
  if (!evidence.originalExtractedText && evidence.originalExtractedText !== '') {
    errors.push('originalExtractedText must be present');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
