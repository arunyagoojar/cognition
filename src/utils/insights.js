/**
 * Deterministic insight & weakness engine (Phase 6).
 * Aggregates EXISTING attempt data — no AI calls, no fabrication.
 * Where evidence is thin, it says so instead of overstating.
 */

export const QUESTION_TYPE_LABELS = {
  // reading
  tfng: 'True / False / Not Given',
  ynng: 'Yes / No / Not Given',
  matching_headings: 'Matching Headings',
  matching_information: 'Matching Information',
  matching_features: 'Matching Features',
  matching_box: 'Matching',
  mcq_single: 'Multiple Choice',
  mcq_multi: 'Multiple Choice (multiple answers)',
  completion: 'Completion',
  short_answer: 'Short Answer',
  // listening
  fill_in_blank: 'Note / Form Completion',
  map_labeling: 'Map Labelling',
  diagram_labeling: 'Diagram Labelling',
};

export const typeLabel = (t) => QUESTION_TYPE_LABELS[t] || (t ? String(t).replace(/_/g, ' ') : 'Unknown');

const WRITING_CRITERIA = [
  { key: 'taskAchievement', alt: 'taskResponse', label: 'Task Achievement / Response' },
  { key: 'coherenceAndCohesion', label: 'Coherence & Cohesion' },
  { key: 'lexicalResource', label: 'Lexical Resource' },
  { key: 'grammaticalRangeAndAccuracy', alt: 'grammaticalRange', label: 'Grammatical Range & Accuracy' },
];

const SPEAKING_CRITERIA = [
  { key: 'fluencyAndCoherence', label: 'Fluency & Coherence' },
  { key: 'lexicalResource', label: 'Lexical Resource' },
  { key: 'grammaticalRangeAndAccuracy', alt: 'grammaticalRange', label: 'Grammatical Range & Accuracy' },
];

const MIN_QUESTIONS_FOR_TYPE_VERDICT = 6;
const MIN_ATTEMPTS_FOR_TYPE_VERDICT = 2;
const WEAK_ACCURACY_THRESHOLD = 0.6;

function getBand(skillRecord) {
  const b = typeof skillRecord?.band === 'number' ? skillRecord.band : parseFloat(skillRecord?.band);
  return Number.isFinite(b) ? b : null;
}

/**
 * Aggregates per-question-type accuracy across recent attempts of a skill.
 * attempts: performanceStore attempts (newest first), filtered by skill.
 * itemResults: { [qid]: { questionType?, finalResult/deterministicCorrect, candidateAnswer } }
 */
export function aggregateQuestionTypeAccuracy(attempts, skill) {
  const byType = {};
  let attemptsWithData = 0;

  for (const attempt of attempts) {
    const rec = attempt[skill];
    if (!rec?.itemResults) continue;
    let countedThisAttempt = 0;
    for (const r of Object.values(rec.itemResults)) {
      const type = r.questionType || null;
      if (!type) continue;
      const answered = r.candidateAnswer !== undefined && r.candidateAnswer !== null && String(r.candidateAnswer).trim() !== '';
      if (!answered) continue;
      const correct = r.finalResult === 'CORRECT' || r.deterministicCorrect === true;
      if (r.finalResult === undefined && r.deterministicCorrect === undefined) continue;
      byType[type] = byType[type] || { correct: 0, total: 0 };
      byType[type].total++;
      if (correct) byType[type].correct++;
      countedThisAttempt++;
    }
    if (countedThisAttempt >= 4) attemptsWithData++;
  }

  const perType = Object.entries(byType)
    .map(([type, { correct, total }]) => ({
      type,
      label: typeLabel(type),
      correct,
      total,
      accuracy: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);

  return { perType, attemptsWithData };
}

function writingCriteriaFrom(record) {
  const criteria = record?.criteria;
  if (!criteria || typeof criteria !== 'object') return [];
  return WRITING_CRITERIA
    .map(({ key, alt, label }) => {
      const c = criteria[key] || (alt ? criteria[alt] : null);
      const band = typeof c?.band === 'number' ? c.band : parseFloat(c?.band);
      return Number.isFinite(band) ? { key, label, band, evidence: c.evidence || '', improvementFocus: c.improvementFocus || '' } : null;
    })
    .filter(Boolean);
}

function speakingCriteriaFrom(record) {
  const criteria = record?.criteria;
  if (!criteria || typeof criteria !== 'object') return [];
  return SPEAKING_CRITERIA
    .map(({ key, alt, label }) => {
      const c = criteria[key] || (alt ? criteria[alt] : null);
      const band = typeof c?.band === 'number' ? c.band : parseFloat(c?.band);
      return Number.isFinite(band) ? {
        key,
        label,
        band,
        evidence: c.evidence || '',
        improvementFocus: c.improvementFocus || c.nextBandAdvice || '',
        personalizedAssessment: c.personalizedAssessment || c.rationale || '',
        nextBandAdvice: c.nextBandAdvice || c.improvementFocus || '',
        corrections: Array.isArray(c.corrections) ? c.corrections : [],
      } : null;
    })
    .filter(Boolean);
}

/**
 * Derives up to 3 focus areas from recent attempts.
 * Returns { focusAreas: [{key, skill, label, detail, severity}], sufficientData }
 * Language is evidence-based ("Recent attempts suggest…") — never judgemental.
 */
export function deriveWeaknesses(attempts, targetBand) {
  const target = parseFloat(targetBand) || null;
  // Full mocks keep their four skills under `skills`; lift them up so mock
  // evidence counts alongside practice attempts.
  const completed = (attempts || [])
    .filter(a => a.status === 'completed')
    .map(a => (a.skills ? { ...a, ...Object.fromEntries(Object.entries(a.skills).filter(([, v]) => v)) } : a));
  const candidates = [];

  // 1. Question-type accuracy (reading / listening) — repeated evidence only
  for (const skill of ['reading', 'listening']) {
    const skillAttempts = completed.filter(a => a[skill]);
    const { perType, attemptsWithData } = aggregateQuestionTypeAccuracy(skillAttempts, skill);
    if (attemptsWithData < MIN_ATTEMPTS_FOR_TYPE_VERDICT) continue;
    const weak = perType.filter(t => t.total >= MIN_QUESTIONS_FOR_TYPE_VERDICT && t.accuracy < WEAK_ACCURACY_THRESHOLD);
    for (const w of weak.slice(0, 1)) {
      candidates.push({
        key: `${skill}.${w.type}`,
        skill,
        label: w.label,
        severity: WEAK_ACCURACY_THRESHOLD - w.accuracy,
        detail: `Recent attempts suggest lower accuracy on ${w.label} questions (${w.correct}/${w.total} correct).`,
      });
    }
  }

  // 2. Writing / Speaking criteria from the most recent completed evaluation
  for (const [skill, criteriaFn, criteriaLabelPrefix] of [
    ['writing', writingCriteriaFrom, 'Writing'],
    ['speaking', speakingCriteriaFrom, 'Speaking'],
  ]) {
    const latest = completed.find(a => a[skill] && getBand(a[skill]) !== null && criteriaFn(a[skill]).length >= 3);
    if (!latest) continue;
    const rec = latest[skill];
    const band = getBand(rec);
    const crits = criteriaFn(rec).filter(c => c.key !== 'pronunciation');
    if (crits.length < 3) continue;
    const lowest = [...crits].sort((a, b) => a.band - b.band)[0];
    const skillAvg = crits.reduce((s, c) => s + c.band, 0) / crits.length;
    if (lowest.band <= skillAvg - 0.5 || lowest.band < band) {
      candidates.push({
        key: `${skill}.${lowest.key}`,
        skill,
        label: lowest.label,
        severity: Math.max(0, skillAvg - lowest.band),
        detail: `Your latest ${criteriaLabelPrefix} evaluation scored ${lowest.label} at ${lowest.band} — below your other criteria.`,
        evidence: latest.id,
      });
    }
  }

  // 3. Skill-level gap vs target (weakest band first)
  if (target) {
    const skillBands = [];
    for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
      const latest = completed.find(a => a[skill] && getBand(a[skill]) !== null);
      if (latest) skillBands.push({ skill, band: getBand(latest[skill]) });
    }
    if (skillBands.length >= 2) {
      const weakest = [...skillBands].sort((a, b) => a.band - b.band)[0];
      if (weakest.band < target) {
        candidates.push({
          key: `${weakest.skill}.overall`,
          skill: weakest.skill,
          label: `Overall ${weakest.skill.charAt(0).toUpperCase() + weakest.skill.slice(1)} band`,
          severity: target - weakest.band,
          detail: `Your latest ${weakest.skill} band is ${weakest.band} — ${Math.round((target - weakest.band) * 10) / 10} bands below your ${target} target.`,
        });
      }
    }
  }

  // Deduplicate by skill+type, keep the most evidenced, cap at 3
  const seen = new Set();
  const focusAreas = candidates
    .sort((a, b) => b.severity - a.severity)
    .filter(c => {
      const k = `${c.skill}:${c.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3);

  const sufficientData = completed.length >= 2;
  return { focusAreas, sufficientData, completedCount: completed.length };
}

/**
 * Per-skill result analysis for the post-test screens.
 * Returns evidence-based strong/focus lists — only what the attempt supports.
 */
export function deriveResultAnalysis(skill, attemptRecord) {
  const rec = attemptRecord?.[skill] || attemptRecord || null;
  if (!rec) return null;

  const analysis = { skill, band: getBand(rec), strong: [], focus: [], perType: [], criteria: [] };

  if (skill === 'reading' || skill === 'listening') {
    const items = rec.itemResults || {};
    const byType = {};
    for (const r of Object.values(items)) {
      const type = r.questionType;
      if (!type) continue;
      const answered = r.candidateAnswer !== undefined && r.candidateAnswer !== null && String(r.candidateAnswer).trim() !== '';
      if (!answered) continue;
      const correct = r.finalResult === 'CORRECT' || r.deterministicCorrect === true;
      if (r.finalResult === undefined && r.deterministicCorrect === undefined) continue;
      byType[type] = byType[type] || { correct: 0, total: 0 };
      byType[type].total++;
      if (correct) byType[type].correct++;
    }
    analysis.perType = Object.entries(byType)
      .map(([type, { correct, total }]) => ({ type, label: typeLabel(type), correct, total, accuracy: total ? correct / total : 0 }))
      .sort((a, b) => b.accuracy - a.accuracy);
    const strong = analysis.perType.filter(t => t.total >= 3 && t.accuracy >= 0.75).slice(0, 2);
    const focus = analysis.perType.filter(t => t.total >= 3 && t.accuracy < 0.6).slice(0, 2);
    analysis.strong = strong.map(t => `${t.label} (${t.correct}/${t.total})`);
    analysis.focus = focus.map(t => `${t.label} (${t.correct}/${t.total})`);
    analysis.raw = rec.raw;
    analysis.total = rec.total;
  }

  if (skill === 'writing') {
    analysis.criteria = writingCriteriaFrom(rec);
    analysis.task1Band = typeof rec.task1Band === 'number' ? rec.task1Band : null;
    analysis.task2Band = typeof rec.task2Band === 'number' ? rec.task2Band : null;
    analysis.sentenceImprovements = Array.isArray(rec.sentenceImprovements) ? rec.sentenceImprovements.slice(0, 4) : [];
    analysis.overallSummary = rec.overallSummary || '';
  }

  if (skill === 'speaking') {
    analysis.criteria = speakingCriteriaFrom(rec);
    analysis.pronunciation = rec.criteria?.pronunciation || null;
    analysis.priorityWeaknesses = Array.isArray(rec.priorityWeaknesses) ? rec.priorityWeaknesses : [];
    analysis.overallSummary = rec.overallSummary || '';
  }

  return analysis;
}
