/**
 * Re-runs the AI evaluation of the user's most recent test from the dashboard.
 * Only the latest attempt is eligible, and only AI-graded skills (Writing,
 * Speaking). The same attempt record is updated in place — never duplicated.
 */
import { getPerformanceStore } from './performanceStore.js';
import { saveSkillScore } from './storage.js';
import { evaluateWritingWithAI } from './geminiEvaluator.js';
import { evaluateSpeakingResponses } from './evaluation/evaluationEngine.js';
import { getWritingTest } from '../data/writing/index.js';
import { getSpeakingTest } from '../data/speaking/index.js';

const RECHECKABLE = new Set(['writing', 'speaking']);

/** The latest attempt if it can be rechecked: { attempt, skill, record } or null. */
export function getRecheckableLastTest() {
  const latest = (getPerformanceStore().attempts || [])[0];
  if (!latest || !RECHECKABLE.has(latest.type)) return null;
  const record = latest[latest.type];
  if (!record) return null;
  if (latest.type === 'writing' && !(String(record.t1 || '').trim() || String(record.t2 || '').trim())) return null;
  if (latest.type === 'speaking' && !Object.values(record.transcripts || {}).some(t => String(t || '').trim())) return null;
  return { attempt: latest, skill: latest.type, record };
}

/** Re-evaluates the latest test. Returns { ok, band, message }. */
export async function recheckLastTest() {
  const target = getRecheckableLastTest();
  if (!target) return { ok: false, message: 'Your latest test cannot be rechecked.' };
  const { attempt, skill, record } = target;

  if (skill === 'writing') {
    const test = getWritingTest(attempt.testId);
    const t1 = record.t1 || '';
    const t2 = record.t2 || '';
    const res = await evaluateWritingWithAI({
      task1Text: t1,
      task2Text: t2,
      prompts: {
        task1: test?.task1?.prompt || '',
        task2: test?.task2?.prompt || '',
        task1Data: test?.task1 ? { visualType: test.task1.visualType, table: test.task1.table, image: test.task1.image?.file } : null,
      },
    });
    const completed = res?.evaluationStatus === 'completed' && typeof res.band === 'number';
    if (!completed) return { ok: false, message: res?.message || 'The AI examiner could not evaluate this attempt.' };
    saveSkillScore('writing', {
      ...record,
      attemptId: attempt.id,
      testId: attempt.testId,
      testLabel: attempt.testLabel,
      status: 'completed',
      band: res.band,
      task1Band: res.task1Band ?? null,
      task2Band: res.task2Band ?? null,
      evaluationStatus: 'completed',
      criteria: res.criteria || null,
      taskCriteria: res.taskCriteria || null,
      priorityWeaknesses: res.priorityWeaknesses || [],
      overallSummary: res.overallSummary || '',
      task1Feedback: res.task1Feedback || '',
      task2Feedback: res.task2Feedback || '',
      strengths: res.strengths || '',
      areasForImprovement: res.areasForImprovement || '',
      t1,
      t2,
    });
    return { ok: true, band: res.band, skill };
  }

  // speaking
  const test = getSpeakingTest(attempt.testId);
  const cue = test?.parts?.[1]?.cueCard;
  const cueCard = cue?.topic ? `${cue.topic}${cue.bulletPrompts?.length ? ` (Prompts: ${cue.bulletPrompts.join(', ')})` : ''}` : undefined;
  const res = await evaluateSpeakingResponses({
    transcripts: record.transcripts || {},
    testMeta: { title: attempt.testLabel || test?.title || 'IELTS Speaking Practice', cueCard },
    expectedQuestions: (test?.parts || []).reduce((n, p) => n + (p.questions?.length || 0), 0) || null,
  });
  const completed = res?.evaluationState === 'COMPLETED' && typeof res.overallSpeakingBand === 'number';
  if (!completed) return { ok: false, message: res?.message || 'The AI examiner could not evaluate this attempt.' };
  saveSkillScore('speaking', {
    ...record,
    attemptId: attempt.id,
    testId: attempt.testId,
    testLabel: attempt.testLabel,
    status: 'completed',
    band: res.overallSpeakingBand,
    overallBand: res.overallSpeakingBand,
    evaluationState: res.evaluationState,
    evaluationStatus: 'completed',
    provisional: Boolean(res.provisional),
    scoringMethod: res.scoringMethod || '',
    criteria: res.criteria || null,
    overallSummary: res.overallSummary || '',
    priorityWeaknesses: res.priorityWeaknesses || [],
    strengths: res.strengths || '',
    areasForImprovement: res.areasForImprovement || '',
    partFeedback: res.partFeedback || {},
  });
  return { ok: true, band: res.overallSpeakingBand, skill };
}
