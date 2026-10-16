/**
 * Harper Practice Temporary Scoring & Summary Service
 * Calculates an instant diagnostic band score and habit-focused summary
 * for the Harper Writing Practice tool.
 *
 * NOTE: This is a diagnostic practice estimate and explicitly does NOT
 * overwrite official exam scores on the Cognition dashboard.
 */

export function calculateHarperPracticeScore({
  taskKind = 2,
  wordCount = 0,
  grammarIssues = [],
  repetitionData = {},
  errorFreeSentences = 0,
  totalSentences = 1,
}) {
  const targetWords = taskKind === 1 ? 150 : 250;
  const targetMin = targetWords;

  // 1. Length & Task Fulfillment Component (Max Band 9.0)
  let lengthBand = 9.0;
  if (wordCount < targetMin * 0.5) {
    lengthBand = 4.0;
  } else if (wordCount < targetMin * 0.75) {
    lengthBand = 5.0;
  } else if (wordCount < targetMin) {
    lengthBand = 6.0;
  } else if (wordCount >= targetMin) {
    lengthBand = 8.5;
  }

  // 2. Grammatical Accuracy Component (from Harper)
  const errorFreeRatio = totalSentences > 0 ? (errorFreeSentences / totalSentences) : 1;
  const errorRatePer100 = wordCount > 0 ? (grammarIssues.length / wordCount) * 100 : 0;

  let grammarBand = 7.0;
  if (errorRatePer100 === 0 && wordCount >= targetMin) {
    grammarBand = 8.5;
  } else if (errorRatePer100 <= 1.5 && errorFreeRatio >= 0.75) {
    grammarBand = 8.0;
  } else if (errorRatePer100 <= 3.0 && errorFreeRatio >= 0.60) {
    grammarBand = 7.0;
  } else if (errorRatePer100 <= 5.0 && errorFreeRatio >= 0.40) {
    grammarBand = 6.0;
  } else {
    grammarBand = 5.0;
  }

  // 3. Lexical Resource (Vocabulary & Repetition) Component
  const repetitiveCount = repetitionData?.repetitiveWords?.length || 0;
  const lexicalDiversity = repetitionData?.lexicalDiversity || 50;

  let lexicalBand = 7.0;
  if (repetitiveCount === 0 && lexicalDiversity >= 60) {
    lexicalBand = 8.5;
  } else if (repetitiveCount <= 1 && lexicalDiversity >= 55) {
    lexicalBand = 8.0;
  } else if (repetitiveCount <= 3 && lexicalDiversity >= 48) {
    lexicalBand = 7.0;
  } else if (repetitiveCount <= 5 || lexicalDiversity >= 40) {
    lexicalBand = 6.0;
  } else {
    lexicalBand = 5.0;
  }

  // Weighted average: 40% grammar, 35% lexical resource, 25% length fulfillment
  const rawBand = (grammarBand * 0.4) + (lexicalBand * 0.35) + (lengthBand * 0.25);

  // Round to nearest 0.5 IELTS band
  const estimatedBand = Math.max(3.5, Math.min(9.0, Math.round(rawBand * 2) / 2));

  // Determine strengths & habit focal points
  const strengths = [];
  const focusAreas = [];

  if (wordCount >= targetMin) {
    strengths.push(`Satisfied official length requirements (${wordCount}/${targetMin} words).`);
  } else {
    focusAreas.push(`Length deficit: wrote ${wordCount} words (minimum is ${targetMin}).`);
  }

  if (errorFreeRatio >= 0.70) {
    strengths.push(`High grammatical accuracy with ${Math.round(errorFreeRatio * 100)}% error-free sentences.`);
  } else if (grammarIssues.length > 0) {
    focusAreas.push(`${grammarIssues.length} grammatical/mechanical issue(s) flagged by Harper.`);
  }

  if (repetitiveCount === 0) {
    strengths.push('Demonstrated strong lexical variety with zero overused content words.');
  } else {
    focusAreas.push(`Detected ${repetitiveCount} repetitive word(s) used 3+ times.`);
  }

  return {
    estimatedBand,
    grammarBand,
    lexicalBand,
    lengthBand,
    errorFreeRatio: Math.round(errorFreeRatio * 100),
    totalErrors: grammarIssues.length,
    repetitiveCount,
    wordCount,
    targetMin,
    strengths,
    focusAreas,
    summaryTimestamp: new Date().toISOString(),
  };
}
