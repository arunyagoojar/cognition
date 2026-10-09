// Unified AI Provider Service for Cognition IELTS — Phase 4 secure architecture.
// All AI requests run SERVER-SIDE via the Cloudflare Worker, which decrypts the
// user's encrypted Gemini credential in memory. The browser never holds a raw
// API key and there is no client-side provider fallback chain.
//
// Reading & Listening scoring is deterministic against official answer keys and
// requires ZERO AI — the batch verifiers below are intentional no-ops.

import { evaluateWritingServer, evaluateSpeakingServer } from '../api.js';
import { validateWritingEvaluationJson, validateSpeakingEvaluationJson } from '../geminiEvaluator.js';
import { countWords } from '../ieltsRubric.js';

export { logDiagnostic } from './diagnostics.js';

export class AIProvider {
  /**
   * Evaluate Writing (Task 1 + Task 2) in one session-level server request.
   */
  static async evaluateWriting({ task1Text = '', task2Text = '', prompts = {}, attemptId = 'anon' }) {
    const t1Clean = (task1Text || '').trim();
    const t2Clean = (task2Text || '').trim();

    if (!t1Clean && !t2Clean) {
      return {
        status: 'failed',
        band: null,
        overallBand: null,
        task1Band: null,
        task2Band: null,
        criteria: null,
        message: 'No essay content submitted for evaluation.'
      };
    }

    const t1Words = countWords(t1Clean);
    const t2Words = countWords(t2Clean);

    const res = await evaluateWritingServer({ task1Text: t1Clean, task2Text: t2Clean, prompts, task1Words: t1Words, task2Words: t2Words });
    const validated = res?.status === 'completed'
      ? validateWritingEvaluationJson(res.evaluation, { task1Words: t1Words, task2Words: t2Words }) : null;

    if (validated) {
      return {
        status: 'completed',
        band: validated.overallBand,
        overallBand: validated.overallBand,
        task1Band: validated.task1Band,
        task2Band: validated.task2Band,
        task1Words: t1Words,
        task2Words: t2Words,
        criteria: validated.criteria,
        taskCriteria: validated.taskCriteria || null,
        scoringNotes: validated.scoringNotes || [],
        scoringMethod: validated.scoringMethod || null,
        rubricVersion: validated.rubricVersion || null,
        task1Feedback: validated.task1Feedback,
        task2Feedback: validated.task2Feedback,
        overallSummary: validated.overallSummary,
        strengths: validated.strengths,
        areasForImprovement: validated.areasForImprovement,
        provider: { name: 'gemini', model: res.model, tier: 'server' }
      };
    }

    return {
      status: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: res?.message || 'Writing AI evaluation failed.'
    };
  }

  /**
   * Evaluate Speaking (Part 1 + Part 2 + Part 3) in one session-level server request.
   */
  static async evaluateSpeaking({ transcripts = {}, testMeta = {}, audioRecordings = {}, attemptId = 'anon' }) {
    const combinedSpeech = Object.values(transcripts || {}).filter(Boolean).join(' ').trim();
    const wordCount = combinedSpeech ? combinedSpeech.split(/\s+/).length : 0;

    if (wordCount < 10) {
      return {
        status: 'failed',
        band: null,
        overallBand: null,
        criteria: null,
        message: 'Insufficient audio/transcript content recorded (minimum 10 words required).'
      };
    }

    const res = await evaluateSpeakingServer({ transcripts, testMeta });
    const validated = res?.status === 'completed' ? validateSpeakingEvaluationJson(res.evaluation) : null;

    if (validated) {
      return {
        status: 'completed',
        band: validated.overallBand,
        overallBand: validated.overallBand,
        criteria: validated.criteria,
        provisional: Boolean(validated.provisional),
        scoringMethod: validated.scoringMethod || null,
        partFeedback: validated.partFeedback || {},
        rubricVersion: validated.rubricVersion || null,
        overallSummary: validated.overallSummary,
        strengths: validated.strengths,
        areasForImprovement: validated.areasForImprovement,
        provider: { name: 'gemini', model: res.model, tier: 'server' }
      };
    }

    return {
      status: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: res?.message || 'Speaking AI evaluation failed.'
    };
  }

  /**
   * Reading is scored deterministically against the official answer key.
   * AI verification is intentionally disabled (zero-AI requirement).
   */
  static async evaluateReadingBatch() {
    return { status: 'skipped', verificationMap: {}, sectionSummary: '' };
  }

  /**
   * Listening is scored deterministically against the official answer key.
   * AI verification is intentionally disabled (zero-AI requirement).
   */
  static async evaluateListeningBatch() {
    return { status: 'skipped', verificationMap: {}, sectionSummary: '' };
  }
}
