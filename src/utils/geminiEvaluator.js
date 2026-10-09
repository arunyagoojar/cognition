// Central Gemini AI Evaluation Architecture for IELTS Writing & Speaking
// Adheres strictly to Official IELTS Band Descriptors, explicit lifecycle states, and JSON validation.
// Phase 4: Gemini requests run SERVER-SIDE (Cloudflare Worker) with the user's
// encrypted credential — the browser never holds a raw API key.
import { getAiCacheItem, setAiCacheItem } from './storage.js';
import {
  RUBRIC_VERSION, WRITING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_V2, buildWritingUserPrompt,
  buildSpeakingUserPrompt, normalizeWritingEvaluation, normalizeSpeakingEvaluation, countWords,
} from './ieltsRubric.js';
import { evaluateWritingServer, evaluateSpeakingServer } from './api.js';

export const AI_CONFIG = {
  primaryModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-flash-latest',
  temperature: 0.2,
  maxOutputTokens: 8192,
  rateLimitCooldownMs: 30000,
};

let lastRateLimitTime = 0;

// Rubric v2 (prompts, validation, band arithmetic) is shared with the Worker.
export {
  WRITING_SYSTEM_PROMPT_V2 as IELTS_WRITING_SYSTEM_PROMPT,
  SPEAKING_SYSTEM_PROMPT_V2 as IELTS_SPEAKING_SYSTEM_PROMPT,
} from './ieltsRubric.js';

export function hashContent(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extracts and parses JSON from model response text safely.
 */
function extractJsonFromText(text) {
  if (!text) return null;
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
  }

  return null;
}

/**
 * Direct browser→Gemini call — ONLY used in local-key privacy mode, where the
 * key lives on this device and never reaches any server.
 */
async function directGeminiCall(systemPrompt, userPrompt, localKey) {
  for (const mdl of [AI_CONFIG.primaryModel, AI_CONFIG.fallbackModel].filter(Boolean)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': localKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      });
      if (r.status === 429) { lastRateLimitTime = Date.now(); break; }
      if (r.ok) {
        const data = await r.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = extractJsonFromText(text);
        if (parsed) return { status: 'completed', evaluation: parsed, model: mdl };
      }
    } catch { /* try fallback model */ }
  }
  return { status: 'failed', message: 'AI evaluation failed to produce a valid IELTS rubric response. Please try again.' };
}

/**
 * Speaking evaluation: accepts a server result already normalized by the
 * shared rubric, or raw model JSON (local-key mode) which is normalized here.
 */
export function validateSpeakingEvaluationJson(data) {
  if (data && data.rubricVersion === RUBRIC_VERSION) {
    const b = Number(data.overallBand);
    return Number.isFinite(b) && b >= 0 && b <= 9 && data.criteria ? data : null;
  }
  return normalizeSpeakingEvaluation(data, { audioAssessed: false });
}

/**
 * Writing evaluation: same contract as Speaking. Raw JSON needs the word
 * counts (≤20 words → Band 1; absent task → Band 0).
 */
export function validateWritingEvaluationJson(data, { task1Words = 0, task2Words = 0 } = {}) {
  if (data && data.rubricVersion === RUBRIC_VERSION) {
    const b = Number(data.overallBand);
    return Number.isFinite(b) && b >= 0 && b <= 9 && data.criteria ? data : null;
  }
  return normalizeWritingEvaluation(data, { task1Words, task2Words });
}

/**
 * Authoritative AI Evaluation for IELTS Academic Writing.
 * Explicit states: 'not_started' | 'evaluating' | 'completed' | 'failed'.
 * When not completed, band remains strictly null.
 * Runs server-side via the Cloudflare Worker (encrypted credential).
 */
export async function evaluateWritingWithAI({ task1Text = '', task2Text = '', prompts = {} }) {
  const t1Clean = (task1Text || '').trim();
  const t2Clean = (task2Text || '').trim();

  if (!t1Clean && !t2Clean) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'No essay content submitted for evaluation.',
    };
  }

  // Deduplication cache check
  const contentHash = `writing_${hashContent(`${t1Clean}___${t2Clean}___${prompts.task1 || ''}`)}`;
  const cached = getAiCacheItem(contentHash);
  if (cached && cached.evaluationStatus === 'completed') {
    return { ...cached, isCached: true };
  }

  const now = Date.now();
  if (now - lastRateLimitTime < AI_CONFIG.rateLimitCooldownMs) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'AI rate limit cooldown active (429). Please wait 60 seconds.',
    };
  }

  const t1Words = countWords(t1Clean);
  const t2Words = countWords(t2Clean);

  let res = await evaluateWritingServer({ task1Text: t1Clean, task2Text: t2Clean, prompts });

  if (res?.message && res.message.includes('rate limit')) {
    lastRateLimitTime = Date.now();
  }

  let model = res?.model || 'gemini';
  // Local-key privacy mode or server fallback: if the server couldn't evaluate
  // and a local key exists on this device, run evaluation directly from the browser.
  if (res?.status === 'failed') {
    const { getLocalGeminiKey } = await import('./storage.js');
    const localKey = getLocalGeminiKey();
    if (localKey) {
      const userPrompt = buildWritingUserPrompt({ prompts, task1Text: t1Clean, task2Text: t2Clean });
      const direct = await directGeminiCall(WRITING_SYSTEM_PROMPT_V2, userPrompt, localKey);
      if (direct.status === 'completed') {
        res = { status: 'completed', evaluation: direct.evaluation, model: direct.model };
        model = direct.model || 'gemini';
      }
    }
  }

  const validated = res?.status === 'completed'
    ? validateWritingEvaluationJson(res.evaluation, { task1Words: t1Words, task2Words: t2Words }) : null;

  if (validated) {
    // Coverage honesty: a meaningful attempt is defined by word floors.
    // Task 1 <20 or Task 2 <40 words = not attempted (no evidence to score).
    // An overall band is issued ONLY when BOTH tasks have real attempts;
    // a single task yields response-level qualitative feedback with all
    // band numbers withheld (same rule as Speaking).
    const t1Attempted = t1Words >= 20;
    const t2Attempted = t2Words >= 40;
    const bothAttempted = t1Attempted && t2Attempted;

    if (bothAttempted) {
      const finalResult = {
        ...validated,
        band: validated.overallBand,
        evaluationStatus: 'completed',
        coverage: {
          task1: t1Attempted ? 'attempted' : 'not_attempted',
          task2: t2Attempted ? 'attempted' : 'not_attempted',
          complete: true,
          statement: `Task 1: ${t1Words} words · Task 2: ${t2Words} words.`,
        },
        modelUsed: model,
        task1Words: t1Words,
        task2Words: t2Words,
        evaluatedAt: new Date().toISOString()
      };
      setAiCacheItem(contentHash, finalResult);
      return finalResult;
    }

    const stripTaskBands = (criteria) => {
      if (!criteria) return null;
      const out = {};
      for (const [k, v] of Object.entries(criteria)) {
        out[k] = {
          assessed: true,
          band: null,
          feedback: [v.evidence, v.rationale, v.improvementFocus].filter(Boolean).join(' ') || '',
        };
      }
      return out;
    };
    const missing = [!t1Attempted && 'Task 1', !t2Attempted && 'Task 2'].filter(Boolean);
    const finalPartial = {
      evaluationStatus: 'partial',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: stripTaskBands(validated.criteria),
      overallSummary: validated.overallSummary || '',
      task1Feedback: t1Attempted ? validated.task1Feedback : '',
      task2Feedback: t2Attempted ? validated.task2Feedback : '',
      strengths: validated.strengths || '',
      areasForImprovement: validated.areasForImprovement || '',
      coverage: {
        task1: t1Attempted ? 'attempted' : 'not_attempted',
        task2: t2Attempted ? 'attempted' : 'not_attempted',
        complete: false,
        statement: `${missing.join(' and ')} ${missing.length > 1 ? 'were' : 'was'} not attempted. Overall band withheld — response-level feedback only.`,
      },
      message: `${missing.join(' and ')} ${missing.length > 1 ? 'were' : 'was'} not attempted, so no overall IELTS Writing band can be issued. Feedback covers only what you wrote.`,
      modelUsed: model,
      task1Words: t1Words,
      task2Words: t2Words,
      evaluatedAt: new Date().toISOString()
    };
    setAiCacheItem(contentHash, finalPartial);
    return finalPartial;
  }

  // Failure: do NOT invent scores. Band remains strictly null.
  return {
    evaluationStatus: 'failed',
    band: null,
    overallBand: null,
    task1Band: null,
    task2Band: null,
    criteria: null,
    message: res?.message || 'AI evaluation failed to produce a valid IELTS rubric response. Please try again.',
  };
}

/**
 * Authoritative AI Evaluation for IELTS Academic Speaking.
 * Explicit states: 'not_started' | 'evaluating' | 'completed' | 'failed'.
 * When not completed, band remains strictly null.
 * Runs server-side via the Cloudflare Worker (encrypted credential).
 */
export async function evaluateSpeakingWithAI({ transcripts = {}, testMeta = {}, durations = {} }) {
  const combinedSpeech = Object.values(transcripts || {}).filter(Boolean).join(' ').trim();
  const wordCount = combinedSpeech ? combinedSpeech.split(/\s+/).length : 0;

  if (wordCount < 10) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: 'Insufficient audio/transcript content recorded for evaluation (minimum 10 words required).',
    };
  }

  // Deduplication cache check
  const contentHash = `speaking_${hashContent(JSON.stringify(transcripts))}`;
  const cached = getAiCacheItem(contentHash);
  if (cached && cached.evaluationStatus === 'completed') {
    return { ...cached, isCached: true };
  }

  const now = Date.now();
  if (now - lastRateLimitTime < AI_CONFIG.rateLimitCooldownMs) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: 'AI rate limit cooldown active (429). Please wait 60 seconds.',
    };
  }

  let res = await evaluateSpeakingServer({ transcripts, testMeta });

  if (res?.message && res.message.includes('rate limit')) {
    lastRateLimitTime = Date.now();
  }

  let model = res?.model || 'gemini';
  if (res?.status === 'failed') {
    const { getLocalGeminiKey } = await import('./storage.js');
    const localKey = getLocalGeminiKey();
    if (localKey) {
      const userPrompt = buildSpeakingUserPrompt({ transcripts, testMeta, durations });
      const direct = await directGeminiCall(SPEAKING_SYSTEM_PROMPT_V2, userPrompt, localKey);
      if (direct.status === 'completed') {
        res = { status: 'completed', evaluation: direct.evaluation, model: direct.model };
        model = direct.model || 'gemini';
      }
    }
  }

  const validated = res?.status === 'completed' ? validateSpeakingEvaluationJson(res.evaluation) : null;

  if (validated) {
    const finalResult = {
      ...validated,
      band: validated.overallBand,
      evaluationStatus: 'completed',
      modelUsed: model,
      evaluatedAt: new Date().toISOString()
    };
    setAiCacheItem(contentHash, finalResult);
    return finalResult;
  }

  // Failure: do NOT invent scores. Band remains strictly null.
  return {
    evaluationStatus: 'failed',
    band: null,
    overallBand: null,
    criteria: null,
    message: res?.message || 'AI evaluation failed to produce a valid IELTS rubric response. Please try again.',
  };
}
