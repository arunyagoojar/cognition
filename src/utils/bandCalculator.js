// Official IELTS Academic Band Score Calculator

export function calculateListeningBand(rawScore) {
  if (rawScore >= 39) return 9.0;
  if (rawScore >= 37) return 8.5;
  if (rawScore >= 35) return 8.0;
  if (rawScore >= 32) return 7.5;
  if (rawScore >= 30) return 7.0;
  if (rawScore >= 26) return 6.5;
  if (rawScore >= 23) return 6.0;
  if (rawScore >= 18) return 5.5;
  if (rawScore >= 16) return 5.0;
  if (rawScore >= 13) return 4.5;
  if (rawScore >= 10) return 4.0;
  if (rawScore >= 6) return 3.5;
  if (rawScore >= 4) return 3.0;
  if (rawScore >= 2) return 2.5;
  if (rawScore >= 1) return 2.0;
  return 0.0;
}

export function calculateReadingBand(rawScore) {
  if (rawScore >= 39) return 9.0;
  if (rawScore >= 37) return 8.5;
  if (rawScore >= 35) return 8.0;
  if (rawScore >= 33) return 7.5;
  if (rawScore >= 30) return 7.0;
  if (rawScore >= 27) return 6.5;
  if (rawScore >= 23) return 6.0;
  if (rawScore >= 19) return 5.5;
  if (rawScore >= 15) return 5.0;
  if (rawScore >= 13) return 4.5;
  if (rawScore >= 10) return 4.0;
  if (rawScore >= 6) return 3.5;
  if (rawScore >= 4) return 3.0;
  if (rawScore >= 2) return 2.5;
  if (rawScore >= 1) return 2.0;
  return 0.0;
}

/**
 * Calculates overall IELTS band score based on 4 sub-scores
 * applying official rounding rule (.25 -> .5, .75 -> next whole band)
 */
export function calculateOverallBand(listening, reading, writing, speaking) {
  const scores = [listening, reading, writing, speaking];
  // An IELTS overall score is meaningful only after all four competencies are
  // assessed. Never quietly turn a partial profile into an "overall" band.
  if (!scores.every(s => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 9)) {
    return null;
  }
  
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const decimal = avg - Math.floor(avg);
  
  let rounded = Math.floor(avg);
  if (decimal < 0.25) {
    // rounds down
  } else if (decimal < 0.75) {
    rounded += 0.5;
  } else {
    rounded += 1.0;
  }
  
  return Number(rounded.toFixed(1));
}

export function normalizeAnswer(ans) {
  if (ans === undefined || ans === null) return '';
  return String(ans)
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ");
}

export function isAnswerCorrect(userAnswer, expectedAnswer) {
  if (!userAnswer && userAnswer !== 0) return false;
  const normalizedUser = normalizeAnswer(userAnswer);
  
  if (Array.isArray(expectedAnswer)) {
    return expectedAnswer.some(exp => normalizeAnswer(exp) === normalizedUser);
  }
  
  return normalizeAnswer(expectedAnswer) === normalizedUser;
}

/**
 * Word↔digit equivalence table for safe numeric normalization (Phase 5).
 * Only unambiguous units 0–20 + tens are mapped; everything else stays.
 */
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function canonicalizeNumbers(s) {
  return s
    .split(' ')
    .map(w => (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w) ? String(NUMBER_WORDS[w]) : w))
    .join(' ');
}

/**
 * Strips leading grammatical articles ('a', 'an', 'the') from text.
 * In IELTS Listening & Reading, leading articles are generally optional in note/table completion.
 */
export function stripLeadingArticle(s) {
  if (s === null || s === undefined) return '';
  return String(s).trim().replace(/^(?:the|a|an)\s+/i, '').trim();
}

export function differByArticle(a, b) {
  if (!a || !b) return false;
  const sa = stripLeadingArticle(a);
  const sb = stripLeadingArticle(b);
  return sa !== '' && sa === sb;
}

/**
 * Expands an official answer into its accepted variants, following the key's
 * own notation only:
 *   "11 / eleven (am)" → "11", "eleven am", "eleven"   (slash = alternatives)
 *   "ratio (of fuel)"  → "ratio of fuel", "ratio"      (parentheses = optional words)
 * An array is a pre-expanded list of accepted answers (Reading contract v2).
 */
export function officialAnswerVariants(expectedAnswer) {
  const expanded = [];
  const push = (v) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (t && !expanded.includes(t)) expanded.push(t);
  };
  const sources = Array.isArray(expectedAnswer) ? expectedAnswer : [expectedAnswer];
  for (const src of sources) {
    const expected = String(src ?? '').trim();
    if (!expected) continue;
    push(expected);
    const parts = expected.includes('/') ? expected.split('/').map(x => x.trim()).filter(Boolean) : [expected];
    for (const v of parts) {
      push(v);
      const noArt = stripLeadingArticle(v);
      if (noArt && noArt !== v) push(noArt);
      if (v.includes('(')) {
        push(v.replace(/[()]/g, ' '));                     // optional words included
        push(v.replace(/\s*\([^)]*\)\s*/g, ' '));            // optional words omitted
        const noArtOmitted = stripLeadingArticle(v.replace(/\s*\([^)]*\)\s*/g, ' '));
        if (noArtOmitted) push(noArtOmitted);
      }
    }
  }
  return expanded;
}

/**
 * Singular/plural morphology distance: true when two normalized words differ
 * only by a trailing plural marker. Used only to route to AI verification —
 * never to auto-accept.
 */
function differByPlural(a, b) {
  if (a === b) return false;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (/\s/.test(short)) return false; // multi-word handled by AI
  return long === short + 's' || long === short + 'es' ||
    (short.endsWith('y') && long === short.slice(0, -1) + 'ies');
}

export const DETERMINISTIC = { MATCH: 'MATCH', MISMATCH: 'MISMATCH', UNCERTAIN: 'UNCERTAIN' };

/**
 * Deterministic evaluation tier (Phase 5 hybrid architecture).
 * Returns { result: MATCH|MISMATCH|UNCERTAIN, matchedAnswer? }.
 * UNCERTAIN routes the item to batched AI verification — never auto-accept.
 */
export function evaluateDeterministic(userAnswer, expectedAnswer) {
  if (userAnswer === undefined || userAnswer === null || String(userAnswer).trim() === '') {
    return { result: DETERMINISTIC.MISMATCH };
  }
  const variants = officialAnswerVariants(expectedAnswer);
  if (!variants.length) return { result: DETERMINISTIC.MISMATCH };
  const user = normalizeAnswer(userAnswer);
  if (!user) return { result: DETERMINISTIC.MISMATCH };

  for (const variant of variants) {
    const norm = normalizeAnswer(variant);
    if (!norm) continue;
    if (norm === user) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    // Article equivalence (e.g. user writes "bicycle" for "(a) bicycle" or key has "the garden" and user wrote "garden")
    if (differByArticle(user, norm)) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    // Safe numeric equivalence: "11" vs "11" (already equal) — word forms
    // only create UNCERTAIN, never a silent MATCH.
    if (canonicalizeNumbers(norm) === canonicalizeNumbers(user) && norm !== user) {
      return { result: DETERMINISTIC.UNCERTAIN, matchedAnswer: variant };
    }
    if (differByPlural(user, norm)) {
      return { result: DETERMINISTIC.UNCERTAIN, matchedAnswer: variant };
    }
  }
  return { result: DETERMINISTIC.MISMATCH };
}
