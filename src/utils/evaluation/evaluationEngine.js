// Canonical Evaluation Engine for Cognition IELTS
// Executes deterministic checking + AI evaluation pipeline.
// Strictly prevents fabricated, default, stale, or synthetic IELTS scores.

import { evaluateWritingWithAI, evaluateSpeakingWithAI, directVerifyAnswers } from '../geminiEvaluator.js';
import { calculateReadingBand, calculateListeningBand, calculateOverallBand, evaluateDeterministic, DETERMINISTIC, officialAnswerVariants, differByArticle } from '../bandCalculator.js';
import { verifyAnswersViaWorker } from '../api.js';
import { normalizeAnswer } from '../normalizeAnswer.js';
import { recordAttempt } from '../performanceStore.js';
import { getAiConfigState } from '../storage.js';

/**
 * Checks whether candidate answer matches official answer using deterministic
 * normalizer. Accepted variants follow the key's own notation ("/" alternatives,
 * parenthesised optional words) — see officialAnswerVariants.
 * Also accounts for optional leading articles in IELTS answers, strictly respecting word limits.
 */
export function isCandidateAnswerCorrect(candidateAns, officialAns, { wordLimit = null } = {}) {
  if (candidateAns === undefined || candidateAns === null || candidateAns === '') return false;
  if (!officialAns || (Array.isArray(officialAns) && officialAns.length === 0)) return false;
  if (evaluateDeterministic(candidateAns, officialAns, { wordLimit }).result === DETERMINISTIC.MATCH) return true;
  const normCandidate = normalizeAnswer(String(candidateAns));
  if (!normCandidate) return false;

  return officialAnswerVariants(officialAns).some(v => {
    const normV = normalizeAnswer(v);
    if (normV === normCandidate) return true;
    if (differByArticle(normCandidate, normV, wordLimit)) return true;
    return false;
  });
}

const VERIFY_TIMEOUT_MS = 25000;

/** The answer a question is matched against: the structured accepted list when present. */
function officialFor(q) {
  return Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers : q.answer;
}

/**
 * "Choose TWO/THREE letters" groups are marked order-independently in IELTS:
 * each correct letter earns one mark, whichever answer box it was written in.
 * The candidate's letters for an unordered group are re-seated onto the slots
 * whose official letter they match before per-question scoring. Deterministic.
 */
export function alignUnorderedAnswers(questions, answers) {
  const groups = new Map();
  for (const q of questions) {
    if (!q.unorderedGroup) continue;
    if (!groups.has(q.unorderedGroup)) groups.set(q.unorderedGroup, []);
    groups.get(q.unorderedGroup).push(q);
  }
  if (!groups.size) return answers;
  const out = { ...answers };
  for (const slots of groups.values()) {
    const picked = [...new Set(slots.map(q => answers[q.id]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .map(v => String(v).trim().toUpperCase()))];
    const free = new Set(picked);
    const seat = {};
    for (const q of slots) {
      const key = String(q.answer ?? '').trim().toUpperCase();
      if (key && free.has(key)) { seat[q.id] = key; free.delete(key); }
    }
    const rest = [...free];
    for (const q of slots) {
      if (!seat[q.id] && rest.length) seat[q.id] = rest.shift();
      out[q.id] = seat[q.id] ?? '';
    }
  }
  return out;
}

/**
 * Hybrid objective-answer pipeline (Phase 5).
 * 1. Deterministic tier: normalization + official variants (slash alternatives,
 *    optional parentheticals). MATCH/MISMATCH are final.
 * 2. UNCERTAIN items (plural morphology, word-vs-digit numbers, key formatting)
 *    are batched into ONE AI verification request. The official key stays
 *    authoritative — AI only judges representational equivalence.
 * UNCERTAIN that AI cannot confidently accept scores as INCORRECT.
 */
async function resolveWithHybridVerification(allQuestions, answers, itemResults) {
  const uncertain = [];
  for (const q of allQuestions) {
    const student = answers[q.id];
    if (student === undefined || student === null || String(student).trim() === '') continue;
    const official = officialFor(q);
    if (!official || (Array.isArray(official) && !official.length)) continue;
    // MCQ/matching/TFNG selections are unambiguously comparable — deterministic only.
    const selectionTypes = ['mcq_single', 'mcq_multi', 'single_select', 'multi_select', 'pool_select',
      'matching_headings', 'matching_information', 'matching_features', 'matching_box', 'sentence_endings',
      'tfng', 'ynng', 'true_false_not_given', 'yes_no_not_given'];
    const det = evaluateDeterministic(student, official, { wordLimit: q.wordLimit || q.instruction || q.groupInstruction });
    const rec = itemResults[q.id];
    if (det.result === DETERMINISTIC.MATCH) {
      rec.deterministicResult = 'MATCH';
      rec.finalResult = 'CORRECT';
      rec.evaluationMethod = 'DETERMINISTIC';
      rec.matchedAnswer = det.matchedAnswer || official;
    } else if (det.result === DETERMINISTIC.MISMATCH) {
      rec.deterministicResult = 'MISMATCH';
      rec.finalResult = 'INCORRECT';
      rec.evaluationMethod = 'DETERMINISTIC';
      if (selectionTypes.includes(q.questionType) || selectionTypes.includes(q.inputType)) {
        // wrong option identity is never sent to AI
      } else {
        // free-text mismatch may still be an accepted representation the
        // deterministic tier cannot see — verify, but only when a key exists
        uncertain.push({
          id: q.id,
          questionText: q.context || q.questionText || q.question || '',
          questionType: q.questionType || q.inputType || '',
          instruction: q.instruction || q.groupInstruction || '',
          officialAnswer: Array.isArray(official) ? official.join(' / ') : String(official),
          studentAnswer: String(student),
          wordLimit: q.wordLimit || null,
        });
      }
    } else {
      rec.deterministicResult = 'UNCERTAIN';
      rec.finalResult = 'INCORRECT';
      rec.evaluationMethod = 'DETERMINISTIC';
      uncertain.push({
        id: q.id,
        questionText: q.context || q.questionText || q.question || '',
        questionType: q.questionType || q.inputType || '',
        instruction: q.instruction || q.groupInstruction || '',
        officialAnswer: Array.isArray(official) ? official.join(' / ') : String(official),
        studentAnswer: String(student),
        wordLimit: q.wordLimit || null,
      });
    }
  }

  if (uncertain.length === 0) return;
  try {
    // Grading must never hang on the network: past the deadline the
    // deterministic results stand and the candidate gets their score.
    const verify = async () => {
      let r = await verifyAnswersViaWorker(uncertain);
      if (!r || !r.results || r.results.length === 0) {
        // Local fallback if worker couldn't verify (e.g. unauthenticated, offline, or local key mode)
        r = await directVerifyAnswers(uncertain);
      }
      return r;
    };
    const res = await Promise.race([
      verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('verification timeout')), VERIFY_TIMEOUT_MS)),
    ]);
    const byId = new Map((res.results || []).map(r => [r.id, r]));
    for (const item of uncertain) {
      const rec = itemResults[item.id];
      const decision = byId.get(item.id);
      if (decision && decision.decision === 'CORRECT') {
        rec.finalResult = 'CORRECT';
        rec.evaluationMethod = 'AI_VERIFIED';
        rec.aiReason = decision.reason || '';
        rec.matchedAnswer = decision.matchedAnswer || item.officialAnswer;
        rec.acceptedVariant = true;
      } else if (decision && decision.decision === 'INCORRECT') {
        rec.finalResult = 'INCORRECT';
        rec.evaluationMethod = 'AI_VERIFIED';
        rec.aiReason = decision.reason || '';
      } else if (decision && decision.decision === 'UNCERTAIN') {
        rec.finalResult = 'UNCERTAIN';
        rec.evaluationMethod = 'AI_VERIFIED';
        rec.aiDecision = 'UNCERTAIN';
        rec.unresolved = true;
        rec.aiReason = decision.reason || 'Equivalence to official answer could not be confidently established.';
      } else {
        // Missing decision or unresolved: stays UNCERTAIN for unresolved calculation
        if (rec.deterministicResult === 'UNCERTAIN') {
          rec.finalResult = 'UNCERTAIN';
          rec.unresolved = true;
          rec.aiReason = 'Equivalence could not be verified automatically.';
        }
      }
    }
  } catch {
    // Offline / unauthenticated / no credential: deterministic results stand.
    for (const item of uncertain) {
      const rec = itemResults[item.id];
      if (rec && rec.deterministicResult === 'UNCERTAIN') {
        rec.finalResult = 'UNCERTAIN';
        rec.unresolved = true;
        rec.aiReason = 'Verifier unavailable; answer remains unresolved.';
      }
    }
  }
}

/**
 * Evaluates Reading section responses:
 * 1. Authoritative deterministic scoring against official answer key.
 * 2. Independent AI evaluation & verification.
 * 3. Reconciliation with disagreement recording.
 */
export async function evaluateReadingResponses({ passages = [], answers: rawAnswers = {}, attemptId = 'anon' }) {
  const answeredCount = Object.values(rawAnswers || {}).filter(a => a !== undefined && a !== null && String(a).trim() !== '').length;
  const allQuestions = passages.flatMap(p => p.questions || []);
  const answers = alignUnorderedAnswers(allQuestions, rawAnswers || {});

  if (answeredCount === 0) {
    return {
      status: 'not_attempted',
      band: null,
      raw: 0,
      total: allQuestions.length,
      answers: {},
    };
  }

  // 1. Authoritative Deterministic Scoring
  let correct = 0;
  const itemResults = {};

  if (allQuestions.length === 0 && answeredCount > 0) {
    // If we don't have structured questions but user answered, mark as completed without band
    return {
      status: 'completed',
      band: null,
      raw: answeredCount, // Use answered count as dummy raw
      total: 40,
      percentage: 0,
      answers,
      itemResults: {},
    };
  }

  for (const q of allQuestions) {
    const candidate = answers[q.id];
    const isCorrect = isCandidateAnswerCorrect(candidate, officialFor(q), { wordLimit: q.wordLimit || q.instruction || q.groupInstruction });
    if (isCorrect) correct++;
    itemResults[q.id] = {
      deterministicCorrect: isCorrect,
      officialAnswer: q.answer,
      candidateAnswer: candidate || null,
      questionType: q.questionType || null,
      questionNumber: q.questionNumber ?? null,
    };
  }

  // Hybrid tier: deterministic-UNCERTAIN free-text goes to one batched AI
  // verification; final tallies use the resolved results.
  await resolveWithHybridVerification(allQuestions, answers, itemResults);

  // Guarantee that every question has a finalResult (deterministic correct answers are always credited)
  for (const q of allQuestions) {
    const rec = itemResults[q.id];
    if (rec && !rec.finalResult) {
      rec.finalResult = rec.deterministicCorrect ? 'CORRECT' : 'INCORRECT';
    }
  }

  const confirmedCorrect = Object.values(itemResults).filter(r => r.finalResult === 'CORRECT').length;
  const unresolvedCount = Object.values(itemResults).filter(r => r.unresolved || r.finalResult === 'UNCERTAIN').length;

  const rawMin = confirmedCorrect;
  const rawMax = confirmedCorrect + unresolvedCount;
  const bandMin = calculateReadingBand(rawMin);
  const bandMax = calculateReadingBand(rawMax);
  const band = bandMin; // Authoritative confirmed band: do not invent final credit
  const hasUnresolved = unresolvedCount > 0;
  const scoreRange = hasUnresolved ? { rawMin, rawMax, bandMin, bandMax, unresolvedCount } : null;

  return {
    status: 'completed',
    band,
    raw: confirmedCorrect,
    rawMin,
    rawMax,
    bandMin,
    bandMax,
    hasUnresolved,
    unresolvedCount,
    scoreRange,
    isProvisional: hasUnresolved,
    total: allQuestions.length,
    percentage: allQuestions.length > 0 ? Math.round((confirmedCorrect / allQuestions.length) * 100) : 0,
    answers,
    itemResults,
  };
}

/**
 * Evaluates Listening section responses:
 * 1. Authoritative deterministic scoring against official answer key.
 * 2. Independent AI evaluation & verification.
 * 3. Reconciliation with disagreement recording.
 */
export async function evaluateListeningResponses({ sections = [], answers: rawAnswers = {}, attemptId = 'anon' }) {
  const answeredCount = Object.values(rawAnswers || {}).filter(a => a !== undefined && a !== null && String(a).trim() !== '').length;
  const allQuestions = sections.flatMap(s => s.questions || []);
  const answers = alignUnorderedAnswers(allQuestions, rawAnswers || {});

  if (answeredCount === 0) {
    return {
      status: 'not_attempted',
      band: null,
      raw: 0,
      total: allQuestions.length,
      answers: {},
    };
  }

  // 1. Authoritative Deterministic Scoring
  let correct = 0;
  const itemResults = {};

  for (const q of allQuestions) {
    const candidate = answers[q.id];
    const isCorrect = isCandidateAnswerCorrect(candidate, officialFor(q), { wordLimit: q.wordLimit || q.instruction || q.groupInstruction });
    if (isCorrect) correct++;
    itemResults[q.id] = {
      deterministicCorrect: isCorrect,
      officialAnswer: q.answer,
      candidateAnswer: candidate || null,
      questionType: q.type || q.questionType || null,
      questionNumber: q.questionNumber ?? null,
    };
  }

  // Hybrid tier (Phase 5): plural/number/format variants verified in ONE
  // batched AI request; official key remains authoritative.
  await resolveWithHybridVerification(allQuestions, answers, itemResults);

  // Guarantee that every question has a finalResult (deterministic correct answers are always credited)
  for (const q of allQuestions) {
    const rec = itemResults[q.id];
    if (rec && !rec.finalResult) {
      rec.finalResult = rec.deterministicCorrect ? 'CORRECT' : 'INCORRECT';
    }
  }

  const confirmedCorrect = Object.values(itemResults).filter(r => r.finalResult === 'CORRECT').length;
  const unresolvedCount = Object.values(itemResults).filter(r => r.unresolved || r.finalResult === 'UNCERTAIN').length;

  const rawMin = confirmedCorrect;
  const rawMax = confirmedCorrect + unresolvedCount;
  const bandMin = calculateListeningBand(rawMin);
  const bandMax = calculateListeningBand(rawMax);
  const band = bandMin; // Authoritative confirmed band: do not invent final credit
  const hasUnresolved = unresolvedCount > 0;
  const scoreRange = hasUnresolved ? { rawMin, rawMax, bandMin, bandMax, unresolvedCount } : null;

  return {
    status: 'completed',
    band,
    raw: confirmedCorrect,
    rawMin,
    rawMax,
    bandMin,
    bandMax,
    hasUnresolved,
    unresolvedCount,
    scoreRange,
    isProvisional: hasUnresolved,
    total: allQuestions.length,
    percentage: allQuestions.length > 0 ? Math.round((confirmedCorrect / allQuestions.length) * 100) : 0,
    answers,
    itemResults,
  };
}

/**
 * Evaluates Writing task responses via AI examiner:
 */
export async function evaluateWritingResponses({ task1Text = '', task2Text = '', prompts = {}, attemptId = 'anon' }) {
  const t1Clean = (task1Text || '').trim();
  const t2Clean = (task2Text || '').trim();

  if (!t1Clean && !t2Clean) {
    return {
      status: 'not_attempted',
      band: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'No essay content submitted.'
    };
  }

  // Same evaluator as practice Writing: server first, then the local-key
  // fallback, with the shared result cache.
  const res = await evaluateWritingWithAI({ task1Text: t1Clean, task2Text: t2Clean, prompts });
  const completed = res?.evaluationStatus === 'completed' && typeof res.band === 'number';
  return {
    ...res,
    status: completed ? 'completed' : (res?.evaluationStatus === 'partial' ? 'partial' : 'failed'),
    band: completed ? res.band : null,
    overallBand: completed ? res.band : null,
  };
}

/**
 * Evaluates Speaking interview responses via AI examiner:
 */
/**
 * Speaking evaluation with explicit, mutually consistent states.
 *
 * evaluationState ∈ NOT_ASSESSED | NOT_CONFIGURED | COMPLETED | FAILED | PARTIAL
 * - transcript alone can never produce a pronunciation score (no audio-capable
 *   evaluator exists) — pronunciation is always reported as Not assessed.
 * - criterion scores and "unavailable" banners can never appear together:
 *   criteria are null unless evaluationState === COMPLETED (or PARTIAL with an
 *   explicit availableCriteria list).
 * - notes are planning material and are never sent to the evaluator.
 */
export async function evaluateSpeakingResponses({ transcripts = {}, testMeta = {}, audioRecordings = {}, notes = {}, durations = {}, attemptId = 'anon', expectedQuestions = null }) {
  const spokenWords = Object.values(transcripts || {}).filter(Boolean).join(' ').trim();

  const partsAttempted = new Set();
  let questionsAnswered = 0;
  Object.keys(transcripts).forEach(k => {
    if (transcripts[k] && transcripts[k].split(/\s+/).length >= 5) {
      questionsAnswered++;
      // keys are `${partIdx}_${questionIdx}` (e.g. "0_2"); also tolerate "part0_q0"
      const m = k.match(/^(\d+)_/) || k.match(/part(\d+)/i);
      if (m) partsAttempted.add(String(parseInt(m[1], 10) + (k.startsWith('part') ? 0 : 1)));
    }
  });
  const expected = typeof expectedQuestions === 'number' && expectedQuestions > 0
    ? expectedQuestions
    : Math.max(questionsAnswered, 14);
  // Full interview = every part attempted AND at least 3/4 of the questions answered
  const isCoverageComplete = partsAttempted.size >= 3 && questionsAnswered >= Math.ceil(expected * 0.75);
  const coverage = { partsAttempted: Array.from(partsAttempted), questionsAnswered,
                      questionsExpected: expected, partsExpected: 3, isComplete: isCoverageComplete,
                      statement: `You answered ${questionsAnswered} of ${expected} questions across ${partsAttempted.size} of 3 parts.` };

  const pronunciationNotAssessed = {
    assessed: false,
    status: 'not_assessed',
    band: null,
    reason: 'Audio pronunciation analysis is not currently available. Pronunciation is never inferred from transcription accuracy.',
    personalizedAssessment: 'Pronunciation requires acoustic audio analysis (intelligibility, individual sounds, word stress, connected speech, rhythm, and intonation) and cannot be assessed from transcripts.',
    improvementFocus: 'Record your answers aloud to practice word stress, rhythm, and sentence intonation.',
    nextBandAdvice: 'Record your answers aloud to practice word stress, rhythm, and sentence intonation.',
    corrections: [],
  };

  // Partial coverage never produces band scores — qualitative feedback only.
  const stripBands = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = {
        assessed: true,
        band: null,
        feedback: (v && typeof v === 'object' ? (v.notes || v.feedback || v.personalizedAssessment || v.rationale || v.description || '') : String(v ?? '')),
        personalizedAssessment: (v && typeof v === 'object' ? (v.personalizedAssessment || v.rationale || '') : ''),
        corrections: Array.isArray(v?.corrections) ? v.corrections : [],
        nextBandAdvice: (v && typeof v === 'object' ? (v.nextBandAdvice || v.improvementFocus || '') : ''),
        improvementFocus: (v && typeof v === 'object' ? (v.nextBandAdvice || v.improvementFocus || '') : ''),
      };
    }
    out.pronunciation = pronunciationNotAssessed;
    return out;
  };

  if (!spokenWords || spokenWords.split(/\s+/).length < 5) {
    return {
      evaluationState: 'NOT_ASSESSED',
      status: 'not_attempted',
      band: null,
      overallSpeakingBand: null,
      criteria: { pronunciation: pronunciationNotAssessed },
      coverage,
      message: `No audio or spoken transcript recorded. ${coverage.statement}`
    };
  }

  // Evaluation configuration must gate the display of criterion scores.
  // Only a definite "no key" skips the evaluator. If the check could not be
  // completed, the server decides (it reports a missing key itself).
  const aiState = await getAiConfigState();
  if (aiState === 'not_configured') {
    return {
      evaluationState: 'NOT_CONFIGURED',
      status: isCoverageComplete ? 'completed' : 'partial',
      band: null,
      overallSpeakingBand: null,
      criteria: { pronunciation: pronunciationNotAssessed },
      coverage,
      message: `AI evaluation is unavailable. Add an API key in Settings to receive criterion-level feedback. ${coverage.statement}`,
    };
  }

  // Server first, then the local-key fallback, with the shared result cache.
  const ai = await evaluateSpeakingWithAI({ transcripts, testMeta, durations });
  const res = ai?.evaluationStatus === 'completed'
    ? { ...ai, status: 'completed', provider: { name: ai.providerUsed || 'gemini', model: ai.modelUsed, tier: ai.evaluationTier } }
    : { status: 'failed', message: ai?.message };

  if (!res || res.status !== 'completed' || !res.criteria) {
    return {
      evaluationState: 'FAILED',
      status: isCoverageComplete ? 'completed' : 'partial',
      band: null,
      overallSpeakingBand: null,
      criteria: { pronunciation: pronunciationNotAssessed },
      coverage,
      message: `${res?.message || 'The evaluation service could not score this attempt. You can retry.'} ${coverage.statement}`,
      retryable: true,
    };
  }

  // Hard honesty rule: strip any model-returned pronunciation score.
  if (!isCoverageComplete) {
    // Partial coverage: response-level QUALITATIVE feedback only — no band numbers,
    // no overall band. A score from a fraction of the interview is not an assessment.
    return {
      evaluationState: 'PARTIAL',
      status: 'partial',
      band: null,
      overallSpeakingBand: null,
      criteria: stripBands(res.criteria),
      overallSummary: res.overallSummary || '',
      priorityWeaknesses: res.priorityWeaknesses || [],
      strengths: res.strengths || '',
      areasForImprovement: res.areasForImprovement || '',
      partFeedback: res.partFeedback || {},
      provider: res.provider,
      coverage,
      message: `${coverage.statement} Criterion band scores require the full interview; this is response-level feedback only.`,
    };
  }

  return {
    evaluationState: 'COMPLETED',
    status: 'completed',
    band: res.band ?? null,
    overallSpeakingBand: res.overallBand ?? null,
    provisional: res.provisional ?? true,
    scoringMethod: res.scoringMethod || 'Provisional transcript-based estimate: Mean of 3 criteria (Pronunciation unassessed).',
    criteria: {
      ...res.criteria,
      pronunciation: res.criteria?.pronunciation?.status === 'assessed' ? res.criteria.pronunciation : pronunciationNotAssessed,
    },
    overallSummary: res.overallSummary || '',
    priorityWeaknesses: res.priorityWeaknesses || [],
    strengths: res.strengths || '',
    areasForImprovement: res.areasForImprovement || '',
    partFeedback: res.partFeedback || {},
    provider: res.provider,
    coverage,
  };
}

/**
 * Derives genuine diagnostic strengths, priority areas, and recommendations from actual evaluation records.
 * NEVER returns hardcoded, placeholder, or synthetic advice.
 */
export function deriveInsightsFromEvaluation(skills) {
  const strengths = [];
  const priorityAreas = [];
  const recommendations = [];

  // Writing Insights
  if (skills.writing?.status === 'completed' && skills.writing.criteria) {
    const c = skills.writing.criteria;
    if (skills.writing.strengths) {
      strengths.push({
        title: 'Writing Competence',
        detail: skills.writing.strengths,
        skill: 'writing'
      });
    }
    if (skills.writing.areasForImprovement) {
      priorityAreas.push({
        title: 'Writing Focus Area',
        detail: skills.writing.areasForImprovement,
        skill: 'writing'
      });
      recommendations.push({
        title: 'Writing Structure Drill',
        detail: c.taskAchievement?.improvementFocus || c.coherenceAndCohesion?.improvementFocus || 'Focus on paragraph cohesion and clear progression.'
      });
    }
  }

  // Speaking Insights
  if (skills.speaking?.status === 'completed' && skills.speaking.criteria) {
    const c = skills.speaking.criteria;
    if (skills.speaking.strengths) {
      strengths.push({
        title: 'Spoken Fluency',
        detail: skills.speaking.strengths,
        skill: 'speaking'
      });
    }
    if (skills.speaking.areasForImprovement) {
      priorityAreas.push({
        title: 'Speaking Focus Area',
        detail: skills.speaking.areasForImprovement,
        skill: 'speaking'
      });
      recommendations.push({
        title: 'Speaking Expansion Drill',
        detail: c.fluencyAndCoherence?.improvementFocus || c.lexicalResource?.improvementFocus || 'Practice sustained multi-sentence responses.'
      });
    }
  }

  // Reading Insights
  if (skills.reading?.status === 'completed' && typeof skills.reading.band === 'number') {
    if (skills.reading.band >= 7.0) {
      strengths.push({
        title: 'Reading Comprehension',
        detail: `Demonstrated strong accuracy (${skills.reading.raw}/${skills.reading.total} raw score, Band ${skills.reading.band}).`,
        skill: 'reading'
      });
    } else {
      priorityAreas.push({
        title: 'Reading Detail & Inference',
        detail: `Achieved ${skills.reading.raw}/${skills.reading.total} correct. Review question types with highest error density.`,
        skill: 'reading'
      });
      recommendations.push({
        title: 'Reading Skim & Scan Drill',
        detail: 'Practice locating targeted keywords and evaluating True/False/Not Given qualifiers.'
      });
    }
  }

  // Listening Insights
  if (skills.listening?.status === 'completed' && typeof skills.listening.band === 'number') {
    if (skills.listening.band >= 7.0) {
      strengths.push({
        title: 'Listening Detail Recognition',
        detail: `High factual accuracy (${skills.listening.raw}/${skills.listening.total} raw score, Band ${skills.listening.band}).`,
        skill: 'listening'
      });
    } else {
      priorityAreas.push({
        title: 'Listening Note & Number Accuracy',
        detail: `Achieved ${skills.listening.raw}/${skills.listening.total} correct. Focus on distracted numbers and spelling variants.`,
        skill: 'listening'
      });
      recommendations.push({
        title: 'Listening Note Completion Drill',
        detail: 'Practice predicting word types before audio plays and watching for speaker self-corrections.'
      });
    }
  }

  return { strengths, priorityAreas, recommendations };
}

/**
 * Full Mock Examination Evaluator:
 * Executes the complete evaluation pipeline across all 4 skills.
 * Produces ONE canonical evaluation record.
 */
export async function evaluateFullMockExam({
  testId,
  testLabel,
  rawExamPackage = null,
  sectionAnswers = {},
  onProgress = null
}) {
  const attemptId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  if (onProgress) onProgress({ status: 'evaluating', stage: 'listening', message: 'Evaluating Listening answers...' });
  const listening = await evaluateListeningResponses({
    sections: rawExamPackage?.listening?.parts || [],
    answers: sectionAnswers.listening?.answers || sectionAnswers.listening || {},
    attemptId
  });

  if (onProgress) onProgress({ status: 'evaluating', stage: 'reading', message: 'Evaluating Reading answers...' });
  const reading = await evaluateReadingResponses({
    passages: rawExamPackage?.reading?.passages || [],
    answers: sectionAnswers.reading?.answers || sectionAnswers.reading || {},
    attemptId
  });

  if (onProgress) onProgress({ status: 'evaluating', stage: 'writing', message: 'Evaluating Writing essays with AI examiner...' });
  const writingData = sectionAnswers.writing || {};
  const writing = await evaluateWritingResponses({
    task1Text: writingData.t1 || writingData.task1Text || '',
    task2Text: writingData.t2 || writingData.task2Text || '',
    prompts: {
      task1: rawExamPackage?.writing?.task1?.prompt || '',
      task2: rawExamPackage?.writing?.task2?.prompt || '',
      task1Data: rawExamPackage?.writing?.task1 ? {
        visualType: rawExamPackage.writing.task1.visualType,
        table: rawExamPackage.writing.task1.table,
        image: rawExamPackage.writing.task1.image?.file,
      } : null,
    },
    attemptId
  });

  if (onProgress) onProgress({ status: 'evaluating', stage: 'speaking', message: 'Evaluating Speaking interview with AI examiner...' });
  const speakingData = sectionAnswers.speaking || {};
  const speaking = await evaluateSpeakingResponses({
    transcripts: speakingData.transcripts || {},
    testMeta: { title: testLabel || testId },
    audioRecordings: speakingData.recordings || {},
    attemptId
  });

  // Calculate Overall Band ONLY if all 4 skills are completed
  const L = listening.status === 'completed' && typeof listening.band === 'number' ? listening.band : null;
  const R = reading.status === 'completed' && typeof reading.band === 'number' ? reading.band : null;
  const W = writing.status === 'completed' && typeof writing.band === 'number' ? writing.band : null;
  const S = speaking.status === 'completed' && typeof speaking.band === 'number' ? speaking.band : null;

  const overallBand = calculateOverallBand(L, R, W, S);

  // Determine overall attempt status:
  // - If all skills failed or unattempted: 'failed' or 'not_attempted'
  // - If at least one skill was evaluated: 'completed' (with overallBand null if partial)
  const skills = { listening, reading, writing, speaking };
  const hasCompletedAny = Object.values(skills).some(s => s.status === 'completed');
  const hasFailedAny = Object.values(skills).some(s => s.status === 'failed');

  let overallStatus = 'completed';
  if (!hasCompletedAny) {
    overallStatus = hasFailedAny ? 'failed' : 'not_attempted';
  }

  const isProvisional = Boolean(
    speaking?.provisional || listening?.isProvisional || reading?.isProvisional
  );

  const { strengths, priorityAreas, recommendations } = deriveInsightsFromEvaluation(skills);

  const canonicalRecord = {
    id: attemptId,
    attemptId,
    testId,
    testLabel: testLabel || testId,
    type: 'full_mock',
    status: overallStatus,
    overallBand,
    isProvisional,
    skills,
    strengths,
    priorityAreas,
    recommendations,
    evaluationVersion: '1.0.0',
    promptVersion: '1.0.0',
    startedAt: sectionAnswers.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString()
  };

  // Authoritative Persistence in Canonical Store
  recordAttempt(canonicalRecord);

  return canonicalRecord;
}
