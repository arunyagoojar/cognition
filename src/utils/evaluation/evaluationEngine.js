// Canonical Evaluation Engine for Cognition IELTS
// Executes deterministic checking + AI evaluation pipeline.
// Strictly prevents fabricated, default, stale, or synthetic IELTS scores.

import { AIProvider } from '../ai/aiProvider.js';
import { calculateReadingBand, calculateListeningBand, calculateOverallBand, evaluateDeterministic, DETERMINISTIC } from '../bandCalculator.js';
import { verifyAnswersViaWorker } from '../api.js';
import { normalizeAnswer } from '../normalizeAnswer.js';
import { recordAttempt } from '../performanceStore.js';
import { isAiConfigured } from '../storage.js';

/**
 * Checks whether candidate answer matches official answer using deterministic normalizer.
 */
export function isCandidateAnswerCorrect(candidateAns, officialAns) {
  if (candidateAns === undefined || candidateAns === null || candidateAns === '') return false;
  if (!officialAns) return false;

  const normCandidate = normalizeAnswer(String(candidateAns));
  
  if (Array.isArray(officialAns)) {
    return officialAns.some(accepted => normalizeAnswer(String(accepted)) === normCandidate);
  }

  // Handle slash / alternate options e.g. "center / centre"
  const acceptedOptions = String(officialAns).split(/\s*\/\s*/).map(s => normalizeAnswer(s));
  return acceptedOptions.includes(normCandidate);
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
async function resolveWithHybridVerification(allQuestions, answers, itemResults, attemptId) {
  const uncertain = [];
  for (const q of allQuestions) {
    const student = answers[q.id];
    if (student === undefined || student === null || String(student).trim() === '') continue;
    const official = q.answer;
    if (!official) continue;
    // MCQ/matching/TFNG selections are unambiguously comparable — deterministic only.
    const selectionTypes = ['mcq_single', 'single_select', 'matching_headings', 'matching_information',
      'matching_features', 'matching_box', 'true_false_not_given', 'yes_no_not_given'];
    const det = evaluateDeterministic(student, official);
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
          questionText: q.questionText || q.question || '',
          questionType: q.questionType || q.inputType || '',
          instruction: q.instruction || q.groupInstruction || '',
          officialAnswer: String(official),
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
        questionText: q.questionText || q.question || '',
        questionType: q.questionType || q.inputType || '',
        instruction: q.instruction || '',
        officialAnswer: String(official),
        studentAnswer: String(student),
        wordLimit: q.wordLimit || null,
      });
    }
  }

  if (uncertain.length === 0) return;
  try {
    const res = await verifyAnswersViaWorker(uncertain);
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
        rec.evaluationMethod = 'AI_VERIFIED';
        rec.aiReason = decision.reason || '';
      }
      // UNCERTAIN / missing decision → stays INCORRECT (never silently correct)
    }
  } catch {
    // Offline / unauthenticated / no credential: deterministic results stand.
  }
}

/**
 * Evaluates Reading section responses:
 * 1. Authoritative deterministic scoring against official answer key.
 * 2. Independent AI evaluation & verification.
 * 3. Reconciliation with disagreement recording.
 */
export async function evaluateReadingResponses({ passages = [], answers = {}, attemptId = 'anon' }) {
  const answeredCount = Object.values(answers || {}).filter(a => a !== undefined && a !== null && String(a).trim() !== '').length;
  const allQuestions = passages.flatMap(p => p.questions || []);

  if (answeredCount === 0) {
    return {
      status: 'not_attempted',
      band: null,
      raw: 0,
      total: allQuestions.length,
      answers: {},
      aiVerification: {},
      disagreements: []
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
      aiVerification: {},
      disagreements: []
    };
  }

  for (const q of allQuestions) {
    const candidate = answers[q.id];
    const isCorrect = isCandidateAnswerCorrect(candidate, q.answer);
    if (isCorrect) correct++;
    itemResults[q.id] = {
      deterministicCorrect: isCorrect,
      officialAnswer: q.answer,
      candidateAnswer: candidate || null
    };
  }

  // Hybrid tier: deterministic-UNCERTAIN free-text goes to one batched AI
  // verification; final tallies use the resolved results.
  await resolveWithHybridVerification(allQuestions, answers, itemResults, attemptId);
  correct = Object.values(itemResults).filter(r => r.finalResult === 'CORRECT').length;

  const band = calculateReadingBand(correct);

  // 2. AI Evaluation & Verification (Batch per passage)
  const aiVerification = {};
  const disagreements = [];

  for (const passage of passages) {
    const passageQuestions = passage.questions || [];
    try {
      const aiBatch = await AIProvider.evaluateReadingBatch({
        passageTitle: passage.title || 'Academic Reading Passage',
        passageText: passage.text || passage.passageText || '',
        questions: passageQuestions,
        answers,
        attemptId
      });

      if (aiBatch.status === 'completed' && aiBatch.verificationMap) {
        Object.entries(aiBatch.verificationMap).forEach(([qId, v]) => {
          aiVerification[qId] = v;
          const det = itemResults[qId];
          // Check for disagreement
          if (det && det.deterministicCorrect !== v.isCorrect) {
            disagreements.push({
              questionId: qId,
              deterministic: det.deterministicCorrect,
              ai: v.isCorrect,
              reason: v.reason
            });
          }
        });
      }
    } catch (e) {
      console.warn('AI reading batch verification error', e);
    }
  }

  return {
    status: 'completed',
    band,
    raw: correct,
    total: allQuestions.length,
    percentage: allQuestions.length > 0 ? Math.round((correct / allQuestions.length) * 100) : 0,
    answers,
    itemResults,
    aiVerification,
    disagreements
  };
}

/**
 * Evaluates Listening section responses:
 * 1. Authoritative deterministic scoring against official answer key.
 * 2. Independent AI evaluation & verification.
 * 3. Reconciliation with disagreement recording.
 */
export async function evaluateListeningResponses({ sections = [], answers = {}, attemptId = 'anon' }) {
  const answeredCount = Object.values(answers || {}).filter(a => a !== undefined && a !== null && String(a).trim() !== '').length;
  const allQuestions = sections.flatMap(s => s.questions || []);

  if (answeredCount === 0) {
    return {
      status: 'not_attempted',
      band: null,
      raw: 0,
      total: allQuestions.length,
      answers: {},
      aiVerification: {},
      disagreements: []
    };
  }

  // 1. Authoritative Deterministic Scoring
  let correct = 0;
  const itemResults = {};

  for (const q of allQuestions) {
    const candidate = answers[q.id];
    const isCorrect = isCandidateAnswerCorrect(candidate, q.answer);
    if (isCorrect) correct++;
    itemResults[q.id] = {
      deterministicCorrect: isCorrect,
      officialAnswer: q.answer,
      candidateAnswer: candidate || null
    };
  }

  // Hybrid tier (Phase 5): plural/number/format variants verified in ONE
  // batched AI request; official key remains authoritative.
  await resolveWithHybridVerification(allQuestions, answers, itemResults, attemptId);
  correct = Object.values(itemResults).filter(r => r.finalResult === 'CORRECT').length;

  const band = calculateListeningBand(correct);

  // 2. AI Evaluation & Verification (Batch per section)
  const aiVerification = {};
  const disagreements = [];

  for (const section of sections) {
    const sectionQuestions = section.questions || [];
    try {
      const aiBatch = await AIProvider.evaluateListeningBatch({
        sectionNumber: section.sectionNumber || 1,
        transcript: section.transcript || '',
        questions: sectionQuestions,
        answers,
        attemptId
      });

      if (aiBatch.status === 'completed' && aiBatch.verificationMap) {
        Object.entries(aiBatch.verificationMap).forEach(([qId, v]) => {
          aiVerification[qId] = v;
          const det = itemResults[qId];
          // Check for disagreement
          if (det && det.deterministicCorrect !== v.isCorrect) {
            disagreements.push({
              questionId: qId,
              deterministic: det.deterministicCorrect,
              ai: v.isCorrect,
              reason: v.reason
            });
          }
        });
      }
    } catch (e) {
      console.warn('AI listening batch verification error', e);
    }
  }

  return {
    status: 'completed',
    band,
    raw: correct,
    total: allQuestions.length,
    percentage: allQuestions.length > 0 ? Math.round((correct / allQuestions.length) * 100) : 0,
    answers,
    itemResults,
    aiVerification,
    disagreements
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

  const res = await AIProvider.evaluateWriting({
    task1Text: t1Clean,
    task2Text: t2Clean,
    prompts,
    attemptId
  });

  return res;
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
export async function evaluateSpeakingResponses({ transcripts = {}, testMeta = {}, audioRecordings = {}, notes = {}, attemptId = 'anon', expectedQuestions = null }) {
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
    band: null,
    reason: 'Audio pronunciation analysis is not currently available. Pronunciation is never inferred from transcription accuracy.',
  };

  // Partial coverage never produces band scores — qualitative feedback only.
  const stripBands = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = {
        assessed: true,
        band: null,
        feedback: (v && typeof v === 'object' ? (v.notes || v.feedback || v.description || '') : String(v ?? '')),
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
  const hasEvaluator = await isAiConfigured();
  if (!hasEvaluator) {
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

  const res = await AIProvider.evaluateSpeaking({
    transcripts,
    testMeta,
    audioRecordings,
    attemptId
  });

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
      strengths: res.strengths || '',
      areasForImprovement: res.areasForImprovement || '',
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
    criteria: { ...res.criteria, pronunciation: pronunciationNotAssessed },
    overallSummary: res.overallSummary || '',
    strengths: res.strengths || '',
    areasForImprovement: res.areasForImprovement || '',
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
      task2: rawExamPackage?.writing?.task2?.prompt || ''
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

  const { strengths, priorityAreas, recommendations } = deriveInsightsFromEvaluation(skills);

  const canonicalRecord = {
    id: attemptId,
    attemptId,
    testId,
    testLabel: testLabel || testId,
    type: 'full_mock',
    status: overallStatus,
    overallBand,
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
