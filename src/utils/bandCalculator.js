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
 * Canonical answer form used for deterministic equivalence. Only the
 * representation is normalised — never the meaning:
 *   "eleven" / "11", "twenty-five" / "25", "three million" / "3,000,000",
 *   "third" / "3rd", "8th June" / "June 8" / "the 8th of June",
 *   "£25" / "25", "40 per cent" / "40%" / "40", "11am" / "11 am".
 */
const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };
const ORD_UNITS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 };
const ORD_TEENS = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19 };
const ORD_TENS = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 };
const MONTHS = {
  january: 'january', jan: 'january', february: 'february', feb: 'february', march: 'march', mar: 'march',
  april: 'april', apr: 'april', may: 'may', june: 'june', jun: 'june', july: 'july', jul: 'july',
  august: 'august', aug: 'august', september: 'september', sep: 'september', sept: 'september',
  october: 'october', oct: 'october', november: 'november', nov: 'november', december: 'december', dec: 'december',
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ordinalSuffix = (n) => {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
};

/** Reads one spelled-out number phrase starting at tokens[i]; null when there is none. */
function readNumberRun(tokens, i) {
  let total = 0, current = 0, last = null, j = i, words = 0, ordinal = false;
  const open = () => last === null || last === 'hundred' || last === 'scale';
  for (; j < tokens.length; j++) {
    const t = tokens[j];
    if (/^\d+$/.test(t) && last === null) { current = Number(t); last = 'digit'; continue; }
    if (has(UNITS, t) && (open() || last === 'tens')) { current += UNITS[t]; last = 'unit'; words++; continue; }
    if (has(TEENS, t) && open()) { current += TEENS[t]; last = 'teen'; words++; continue; }
    if (has(TENS, t) && open()) { current += TENS[t]; last = 'tens'; words++; continue; }
    if (t === 'hundred' && (last === null || last === 'unit' || last === 'digit') && current < 100) {
      current = (current || 1) * 100; last = 'hundred'; words++; continue;
    }
    if (has(SCALES, t) && last !== 'scale') { total += (current || 1) * SCALES[t]; current = 0; last = 'scale'; words++; continue; }
    if (t === 'and' && (last === 'hundred' || last === 'scale') && j + 1 < tokens.length
      && (has(UNITS, tokens[j + 1]) || has(TEENS, tokens[j + 1]) || has(TENS, tokens[j + 1]))) continue;
    const ord = has(ORD_UNITS, t) && (open() || last === 'tens') ? ORD_UNITS[t]
      : has(ORD_TEENS, t) && open() ? ORD_TEENS[t]
      : has(ORD_TENS, t) && open() ? ORD_TENS[t]
      : null;
    if (ord !== null) { current += ord; ordinal = true; words++; j++; break; }
    break;
  }
  if (words === 0) return null; // nothing read, or a bare digit (left as written)
  const value = total + current;
  return { text: ordinal ? `${value}${ordinalSuffix(value)}` : String(value), next: j };
}

function canonicalizeNumbers(s) {
  const tokens = s.split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length;) {
    const run = readNumberRun(tokens, i);
    if (run) { out.push(run.text); i = run.next; } else { out.push(tokens[i]); i++; }
  }
  return out.join(' ');
}

/** "8th june" / "june 8" / "the 8th of june" → "8 june". */
function canonicalizeDate(s) {
  const all = s.split(' ').filter(Boolean);
  const monthIdx = all.findIndex(t => has(MONTHS, t));
  if (monthIdx < 0) return s;
  const tokens = all.filter(t => t !== 'the' && t !== 'of');
  const mIdx = tokens.findIndex(t => has(MONTHS, t));
  const rest = tokens.filter((_, k) => k !== mIdx);
  const dayIdx = rest.findIndex(t => /^\d{1,2}(st|nd|rd|th)?$/.test(t) && Number(t.replace(/\D/g, '')) <= 31);
  if (dayIdx < 0) return s;
  const day = rest[dayIdx].replace(/(st|nd|rd|th)$/, '');
  return [day, MONTHS[tokens[mIdx]], ...rest.filter((_, k) => k !== dayIdx)].join(' ');
}

export function canonicalAnswer(ans) {
  if (ans === undefined || ans === null) return '';
  let s = String(ans).normalize('NFKC').toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\bper\s*cent\b/g, ' ')
    .replace(/[£€$%]/g, ' ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')        // 100,000 → 100000
    .replace(/(\d)\s*[:.]\s*(\d)/g, '$1·$2')    // 9:30 / 9.30 → 9·30 (kept through punctuation stripping)
    .replace(/-/g, ' ');
  s = normalizeAnswer(s).replace(/·/g, '.');
  s = s.replace(/(\d)\s*(am|pm)\b/g, '$1 $2');  // 11am → 11 am
  s = canonicalizeNumbers(s);
  s = canonicalizeDate(s);
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Strips leading grammatical articles ('a', 'an', 'the') from text.
 * In IELTS Listening & Reading, leading articles are generally optional in note/table completion.
 */
export function stripLeadingArticle(s, wordLimit = null) {
  if (s === null || s === undefined) return '';
  const str = String(s).trim();
  const maxWords = parseWordLimit(wordLimit);
  if (maxWords !== null) {
    const wordCount = str.split(/\s+/).filter(Boolean).length;
    if (wordCount > maxWords) {
      return str;
    }
  }
  return str.replace(/^(?:the|a|an)\s+/i, '').trim();
}

/**
 * Parses word limit instructions (e.g. 1, "ONE WORD ONLY", "NO MORE THAN TWO WORDS").
 */
export function parseWordLimit(limit) {
  if (typeof limit === 'number' && Number.isFinite(limit)) return limit;
  if (!limit || typeof limit !== 'string') return null;
  const s = limit.toLowerCase();
  if (s.includes('one word') || s.includes('1 word')) return 1;
  if (s.includes('two words') || s.includes('2 words')) return 2;
  if (s.includes('three words') || s.includes('3 words')) return 3;
  const m = s.match(/(?:no more than|maximum of|up to)\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function differByArticle(a, b, wordLimit = null) {
  if (!a || !b) return false;
  const maxWords = parseWordLimit(wordLimit);
  if (maxWords !== null) {
    const aWords = String(a).trim().split(/\s+/).filter(Boolean).length;
    if (aWords > maxWords) return false;
  }
  const sa = stripLeadingArticle(a, wordLimit);
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
    // "1/3" is a fraction, not two alternatives: split only where the slash is not between digits
    const parts = expected.split(/(?<!\d)\/|\/(?!\d)/).map(x => x.trim()).filter(Boolean);
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
export function evaluateDeterministic(userAnswer, expectedAnswer, { wordLimit = null } = {}) {
  if (userAnswer === undefined || userAnswer === null || String(userAnswer).trim() === '') {
    return { result: DETERMINISTIC.MISMATCH };
  }
  const user = normalizeAnswer(userAnswer);
  if (!user) return { result: DETERMINISTIC.MISMATCH };
  const variants = officialAnswerVariants(expectedAnswer);
  if (!variants.length) return { result: DETERMINISTIC.MISMATCH };

  for (const variant of variants) {
    const norm = normalizeAnswer(variant);
    if (!norm) continue;
    if (norm === user) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    // Article equivalence respecting word limit (e.g. user writes "bicycle" for "(a) bicycle" or key has "the garden" and user wrote "garden")
    if (differByArticle(user, norm, wordLimit)) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    // Representation-only equivalence: number words ↔ digits, ordinals,
    // date order, currency/percent signs, "11am" ↔ "11 am". Meaning never changes.
    const canonUser = canonicalAnswer(userAnswer);
    const canonKey = canonicalAnswer(variant);
    if (canonKey && (canonKey === canonUser || differByArticle(canonUser, canonKey, wordLimit))) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    // Digit strings written with different grouping (phone/reference numbers)
    if (/^[\d\s]+$/.test(canonKey) && /^[\d\s]+$/.test(canonUser) && canonKey.replace(/\s/g, '') === canonUser.replace(/\s/g, '')) {
      return { result: DETERMINISTIC.MATCH, matchedAnswer: variant };
    }
    if (differByPlural(user, norm)) {
      return { result: DETERMINISTIC.UNCERTAIN, matchedAnswer: variant };
    }
  }
  return { result: DETERMINISTIC.MISMATCH };
}
