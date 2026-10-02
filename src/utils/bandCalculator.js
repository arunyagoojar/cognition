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
