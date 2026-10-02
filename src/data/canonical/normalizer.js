/**
 * Deterministic Answer Normalization & Text Fidelity Engine for Cognition IELTS
 * Strict character and token transformations:
 * - Ligature unfolding (ﬁ -> fi, ﬂ -> fl, etc.)
 * - Curly quotes & apostrophe unification
 * - Dash & hyphen unification
 * - Whitespace & newline collapse
 * - HTML entity decoding
 * - Punctuation stripping without altering semantic tokens
 * - Zero LLM dependency: 100% deterministic & verifiable.
 */

// Common PDF ligature mappings
const LIGATURE_MAP = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'ft',
  '\uFB06': 'st',
  '\u00E6': 'ae',
  '\u00C6': 'AE',
  '\u0153': 'oe',
  '\u0152': 'OE',
};

// Common quotation and punctuation variants
const PUNCTUATION_MAP = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u201F': '"',
  '\u00AB': '"',
  '\u00BB': '"',
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2015': '-',
  '\u2212': '-',
  '\u00A0': ' ', // Non-breaking space
  '\u200B': '',  // Zero-width space
};

/**
 * Normalizes general text strings (removes PDF artifacts, unfolds ligatures, standardizes quotes/dashes).
 */
export function normalizeText(text) {
  if (text === null || text === undefined) return '';
  let str = String(text);

  // 1. Unfold ligatures
  for (const [lig, replacement] of Object.entries(LIGATURE_MAP)) {
    if (str.includes(lig)) {
      str = str.replaceAll(lig, replacement);
    }
  }

  // 2. Standardize quotation marks, hyphens, spaces
  for (const [char, replacement] of Object.entries(PUNCTUATION_MAP)) {
    if (str.includes(char)) {
      str = str.replaceAll(char, replacement);
    }
  }

  // 3. Decode basic HTML entities
  str = str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 4. Collapse multiple whitespace and normalize newlines
  str = str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return str;
}

/**
 * Deterministic Answer Normalization according to IELTS rubric rules.
 * Does NOT perform semantic rewriting or alter numeric values.
 */
export function normalizeAnswer(answer, rules = {}) {
  if (answer === null || answer === undefined) return '';
  let str = normalizeText(answer);

  // Case normalization unless explicitly caseSensitive
  if (!rules.caseSensitive) {
    str = str.toLowerCase();
  }

  // Trim surrounding punctuation (commas, periods, semicolons, brackets)
  if (rules.trimPunctuation !== false) {
    str = str.replace(/^[\s.,;:!?'"()[\]{}]+|[\s.,;:!?'"()[\]{}]+$/g, '');
  }

  // Remove leading articles if allowArticles is enabled
  if (rules.allowArticles) {
    str = str.replace(/^(the|a|an)\s+/i, '');
  }

  // Remove currency symbols if matching numeric/fee answers
  str = str.replace(/^[£$€]\s*/, '').trim();

  // Collapse inner spaces
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * Checks whether a candidate's answer matches an official AnswerDefinition deterministically.
 */
export function isAnswerMatch(candidateAnswer, answerDefinition) {
  if (!candidateAnswer && candidateAnswer !== 0) return false;
  if (!answerDefinition) return false;

  const rules = answerDefinition.normalizationRules || {};
  const normCandidate = normalizeAnswer(candidateAnswer, rules);

  if (!normCandidate) return false;

  // Build list of valid accepted targets
  const targets = [
    answerDefinition.primaryAnswer,
    ...(Array.isArray(answerDefinition.acceptedAnswers) ? answerDefinition.acceptedAnswers : [])
  ].filter(Boolean);

  for (const target of targets) {
    const normTarget = normalizeAnswer(target, rules);

    // Exact match on normalized tokens
    if (normCandidate === normTarget) {
      return true;
    }

    // Direct numeric match
    if (answerDefinition.answerType === 'number') {
      const numCandidate = parseFloat(normCandidate);
      const numTarget = parseFloat(normTarget);
      if (!isNaN(numCandidate) && !isNaN(numTarget)) {
        const tolerance = rules.numericTolerance ?? 0;
        if (Math.abs(numCandidate - numTarget) <= tolerance) {
          return true;
        }
      }
    }

    // Check optional slash variants in target (e.g. "thirty five / thirty-five")
    if (target.includes('/')) {
      const slashParts = target.split('/').map(p => normalizeAnswer(p, rules));
      if (slashParts.includes(normCandidate)) {
        return true;
      }
    }

    // Plural variant match only if explicitly enabled in rules
    if (rules.allowPluralVariants) {
      if (normCandidate + 's' === normTarget || normTarget + 's' === normCandidate) {
        return true;
      }
      if (normCandidate + 'es' === normTarget || normTarget + 'es' === normCandidate) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Phase 17: Source Text Comparison Engine
 * Classifies the fidelity difference between original source text and extracted representation.
 */
export function compareTextRepresentations(sourceText, extractedText) {
  if (sourceText === extractedText) {
    return 'EXACT_MATCH';
  }

  const normSource = normalizeText(sourceText);
  const normExtracted = normalizeText(extractedText);

  if (normSource === normExtracted) {
    return 'NORMALIZED_MATCH';
  }

  // Calculate Levenshtein-based similarity on character sequence
  const lenMax = Math.max(normSource.length, normExtracted.length);
  if (lenMax === 0) return 'EXACT_MATCH';

  // Quick word token check
  const sourceWords = normSource.split(/\s+/);
  const extractedWords = normExtracted.split(/\s+/);

  const matchedWords = sourceWords.filter(w => extractedWords.includes(w)).length;
  const wordOverlapRatio = matchedWords / Math.max(sourceWords.length, extractedWords.length);

  if (wordOverlapRatio >= 0.95) {
    return 'MINOR_EXTRACTION_DIFFERENCE';
  }

  if (wordOverlapRatio >= 0.70) {
    return 'AMBIGUOUS';
  }

  return 'FAIL';
}
