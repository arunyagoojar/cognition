import { calculateReadingBand, calculateListeningBand, calculateOverallBand } from './bandCalculator.js';
import { deriveInsightsFromEvaluation } from './evaluation/evaluationEngine.js';
const correct = item => item?.finalResult === 'CORRECT' || (!item?.finalResult && item?.deterministicCorrect === true);
const unresolved = item => Boolean(item?.unresolved || item?.finalResult === 'UNCERTAIN' || item?.aiDecision === 'UNCERTAIN');

export function correctReviewedAnswer(result, skill, id, items = result?.itemResults, undo = false) {
  if (!['reading','listening'].includes(skill) || !items?.[id]) return result;
  const before = items[id];
  if (!String(before.candidateAnswer ?? '').trim()) return result;
  if (undo ? !before.manualCorrection : before.manualCorrection || correct(before)) return result;
  const at = new Date().toISOString();
  const original = before.manualCorrection?.original;
  const after = undo ? {
    ...original, manualCorrection: null,
    finalResult: original.finalResult || (unresolved(original) ? 'UNCERTAIN' : correct(original) ? 'CORRECT' : 'INCORRECT'),
    aiDecision: original.aiDecision ?? null, aiReason: original.aiReason || '',
    matchedAnswer: original.matchedAnswer ?? null,
  } : {
    ...before, finalResult: 'CORRECT', unresolved: false, aiDecision: null, aiReason: '',
    evaluationMethod: 'MANUAL', acceptedVariant: false, matchedAnswer: before.candidateAnswer,
    manualCorrection: { at, original: before },
  };
  const itemResults = { ...items, [id]: after };
  const total = result.total ?? Object.keys(items).length;
  // Change only this mark. Never silently regrade other historical answers.
  const baseline = result.raw ?? result.correct ?? Object.values(items).filter(correct).length;
  const raw = Math.max(0, Math.min(total, baseline + Number(correct(after)) - Number(correct(before))));
  const pending = Math.max(0, (result.unresolvedCount ?? Object.values(items).filter(unresolved).length) + Number(unresolved(after)) - Number(unresolved(before)));
  const eligible = result.bandEligible !== false && result.practiceMode !== 'drill' && !('accuracy' in result && typeof result.band !== 'number');
  const toBand = skill === 'reading' ? calculateReadingBand : calculateListeningBand;
  const bandMin = eligible ? toBand(raw) : null, bandMax = eligible ? toBand(Math.min(total, raw + pending)) : null;
  return { ...result, itemResults, raw, correct: raw, total, percentage: total ? Math.round(raw / total * 100) : 0,
    ...('accuracy' in result ? { accuracy: total ? Math.round(raw / total * 100) : 0 } : {}),
    band: bandMin, rawMin: raw, rawMax: Math.min(total, raw + pending), bandMin, bandMax,
    unresolvedCount: pending, hasUnresolved: pending > 0, isProvisional: pending > 0,
    scoreRange: pending ? { rawMin: raw, rawMax: Math.min(total, raw + pending), bandMin, bandMax, unresolvedCount: pending } : null,
    manualCorrectionCount: Object.values(itemResults).filter(item => item.manualCorrection).length, manualReviewUpdatedAt: at,
  };
}

export function updateCorrectedAttempt(attempt, skill, result) {
  if (!attempt || !['reading','listening'].includes(skill)) return attempt;
  if (attempt.skills) {
    const skills = { ...attempt.skills, [skill]: result };
    const bands = ['listening','reading','writing','speaking'].map(key => skills[key]?.status === 'completed' ? skills[key].band : null);
    const overallBand = calculateOverallBand(...bands);
    return { ...attempt, skills, overallBand, band: overallBand,
      isProvisional: Object.values(skills).some(s => s.isProvisional || s.provisional),
      ...deriveInsightsFromEvaluation(skills), manualReviewUpdatedAt: result.manualReviewUpdatedAt };
  }
  return { ...attempt, [skill]: result, ...(attempt.type === 'drill' ? result : { band: result.band, overallBand: result.band }),
    id: attempt.id, type: attempt.type, completedAt: attempt.completedAt, manualReviewUpdatedAt: result.manualReviewUpdatedAt };
}
