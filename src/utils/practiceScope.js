// Focused, coached, and incomplete work supplies diagnostics, never a full-skill band.
export function isBandEligible(attempt) {
  if (!attempt || attempt.type === 'drill' || attempt.type === 'writing_coach' || attempt.practiceMode === 'drill' || attempt.bandEligible === false) return false;
  const skill = attempt.type;
  const result = attempt[skill] || attempt.skills?.[skill] || attempt;
  return result.bandEligible !== false && result.practiceMode !== 'drill' && !result.lowCoverage;
}
