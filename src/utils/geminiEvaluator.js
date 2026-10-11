// Central Gemini AI Evaluation Architecture for IELTS Writing & Speaking
// Adheres strictly to Official IELTS Band Descriptors, explicit lifecycle states, and JSON validation.
// Phase 4: Gemini requests run SERVER-SIDE (Cloudflare Worker) with the user's
// encrypted credential — the browser never holds a raw API key.
import { getAiCacheItem, setAiCacheItem } from './storage.js';
import {
  RUBRIC_VERSION, WRITING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_V2, buildWritingUserPrompt,
  buildSpeakingUserPrompt, normalizeWritingEvaluation, normalizeSpeakingEvaluation, countWords,
  ANSWER_VERIFIER_SYSTEM_PROMPT, buildAnswerVerifierUserPrompt,
  WRITING_SYSTEM_PROMPT_COMPACT, SPEAKING_SYSTEM_PROMPT_COMPACT,
} from './ieltsRubric.js';
import { evaluateWritingServer, evaluateSpeakingServer } from './api.js';
import { resolveModelChain } from './ai/modelCatalog.js';

export const AI_CONFIG = {
  // Current Gemini Flash line (gemini-2.x is retired/retiring)
  primaryModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-3.7-flash',
  temperature: 0.2,
  maxOutputTokens: 8192,
};

// One model attempt may take this long before we move on (essays need time to grade).
const DIRECT_TIMEOUT_MS = 60000;
// Hard cap on one whole evaluation (all models/providers) so it never "keeps loading".
const TOTAL_BUDGET_MS = 110000;
let deadline = 0;
const timeLeft = () => (deadline ? deadline - Date.now() : DIRECT_TIMEOUT_MS);
const attemptTimeout = () => Math.max(1000, Math.min(DIRECT_TIMEOUT_MS, timeLeft()));

// Groq's free tier allows ~8,000 tokens per minute (prompt + requested reply),
// so Groq gets the compact prompts and a reply budget that fits the limit.
const GROQ_TPM_BUDGET = 7600;
function groqPrompt(systemPrompt) {
  if (systemPrompt === WRITING_SYSTEM_PROMPT_V2) return WRITING_SYSTEM_PROMPT_COMPACT;
  if (systemPrompt === SPEAKING_SYSTEM_PROMPT_V2) return SPEAKING_SYSTEM_PROMPT_COMPACT;
  return systemPrompt;
}
const estimateTokens = (text) => Math.ceil(String(text || '').length / 3.5);

/**
 * A key saved on this device is used directly (fastest path); the Worker is
 * only the fallback when there is no device key or the direct call fails.
 */
/** Plain-language reason for a failed provider call. */
function failureMessage(name, status) {
  if (status === 401 || status === 403) return `${name} rejected the API key. Replace it in Settings, then press Recheck.`;
  if (status === 429) return `${name} rate limit reached. Wait a minute, then press Recheck.`;
  if (status === 503 || status === 500 || status === 502) return `${name} is overloaded right now. Press Recheck in a moment, or switch provider in Settings.`;
  if (status === 'timeout') return `${name} took too long to respond. Press Recheck, or switch provider in Settings.`;
  if (status === 'network') return `Could not reach ${name}. Check your connection, then press Recheck.`;
  return `${name} did not return a usable evaluation. Press Recheck, or switch provider in Settings.`;
}

async function directFirst(systemPrompt, userPrompt, serverCall, validate = null) {
  const { getLocalGroqKey, getLocalGeminiKey } = await import('./storage.js');
  if (getLocalGroqKey() || getLocalGeminiKey()) {
    const direct = await directAiCall(systemPrompt, userPrompt, validate);
    if (direct.status === 'completed') return { ...direct, tier: 'client_local_key' };
    // The server would call the same provider with the same key — don't make
    // the candidate wait twice; report the real reason instead.
    return { status: 'failed', message: direct.message, triedDirect: true };
  }
  return serverCall();
}

// Rubric v2 (prompts, validation, band arithmetic) is shared with the Worker.
export {
  WRITING_SYSTEM_PROMPT_V2 as IELTS_WRITING_SYSTEM_PROMPT,
  SPEAKING_SYSTEM_PROMPT_V2 as IELTS_SPEAKING_SYSTEM_PROMPT,
  ANSWER_VERIFIER_SYSTEM_PROMPT,
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
async function directGeminiCall(systemPrompt, userPrompt, localKey, validate = null) {
  // Live list of models this key can use — never a stale hardcoded name.
  const models = await resolveModelChain('gemini', localKey);
  let lastStatus = null;
  for (const mdl of models) {
    if (timeLeft() < 5000) { lastStatus = lastStatus || 'timeout'; break; }
    try {
      let attempts = 0;
      let r;
      while (attempts < 2) {
        attempts++;
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(attemptTimeout()),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': localKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
          }),
        });
        if (r.status === 503 && attempts < 2) {
          await new Promise(res => setTimeout(res, 1500));
          continue;
        }
        break;
      }
      lastStatus = r.status;
      if (r.status === 429) break;
      if (r.ok) {
        const data = await r.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = extractJsonFromText(text);
        // a reply that fails the rubric check moves on to the next model
        if (parsed && (!validate || validate(parsed))) return { status: 'completed', evaluation: parsed, model: mdl, provider: 'gemini' };
      }
    } catch (e) { lastStatus = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'network'; /* try next model */ }
  }
  const msg = failureMessage('Gemini', lastStatus);
  return { status: 'failed', message: msg };
}

async function directGroqCall(systemPrompt, userPrompt, localKey, validate = null) {
  // Live list of models this key can use — never a stale hardcoded name.
  const models = await resolveModelChain('groq', localKey);
  const groqSystem = groqPrompt(systemPrompt);
  const replyBudget = Math.max(2000, Math.min(6000, GROQ_TPM_BUDGET - estimateTokens(groqSystem) - estimateTokens(userPrompt)));
  let lastStatus = null;
  for (const mdl of models) {
    if (timeLeft() < 5000) { lastStatus = lastStatus || 'timeout'; break; }
    try {
      let attempts = 0;
      let strictJson = true;
      let waitedForLimit = false;
      let r;
      while (attempts < 4) {
        attempts++;
        r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: AbortSignal.timeout(attemptTimeout()),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localKey}`,
          },
          body: JSON.stringify({
            model: mdl,
            messages: [
              { role: 'system', content: groqSystem },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            max_completion_tokens: replyBudget,
            ...(mdl.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
            ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
          }),
        });
        if (r.status === 503 && attempts < 3) {
          await new Promise(res => setTimeout(res, 1500));
          continue;
        }
        // Strict JSON mode rejects the whole reply over one bad character —
        // ask again without it and extract the JSON ourselves.
        if (r.status === 400 && strictJson) {
          strictJson = false;
          continue;
        }
        // Per-minute limit: wait out a short retry-after once instead of failing.
        if (r.status === 429 && !waitedForLimit) {
          const wait = Number(r.headers.get('retry-after')) || 0;
          if (wait > 0 && wait <= 30 && timeLeft() > wait * 1000 + 20000) {
            waitedForLimit = true;
            await new Promise(res => setTimeout(res, wait * 1000));
            continue;
          }
        }
        break;
      }
      lastStatus = r.status;
      if (r.status === 429 || r.status === 413) break; // limits are per account — another model won't help
      if (r.ok) {
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content;
        const parsed = extractJsonFromText(text);
        // a reply that fails the rubric check moves on to the next model
        if (parsed && (!validate || validate(parsed))) return { status: 'completed', evaluation: parsed, model: mdl, provider: 'groq' };
      }
    } catch (e) { lastStatus = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'network'; /* try next model */ }
  }
  const msg = failureMessage('Groq', lastStatus);
  return { status: 'failed', message: msg };
}

async function directAiCall(systemPrompt, userPrompt, validate = null) {
  const { getActiveAiProvider, getLocalGroqKey, getLocalGeminiKey } = await import('./storage.js');
  const keys = { groq: getLocalGroqKey(), gemini: getLocalGeminiKey() };
  const active = getActiveAiProvider();
  // Active provider first; if it fails and the other provider has a key, use that.
  const order = [active, active === 'groq' ? 'gemini' : 'groq'].filter(p => keys[p]);
  if (!order.length) return { status: 'failed', message: 'No API key saved on this device. Add one in Settings.' };
  deadline = Date.now() + TOTAL_BUDGET_MS;
  let last = null;
  for (const p of order) {
    last = p === 'groq'
      ? await directGroqCall(systemPrompt, userPrompt, keys.groq, validate)
      : await directGeminiCall(systemPrompt, userPrompt, keys.gemini, validate);
    if (last.status === 'completed') { deadline = 0; return last; }
    if (timeLeft() < 5000) break;
  }
  deadline = 0;
  return last;
}

export async function directVerifyAnswers(items) {
  if (!items || items.length === 0) return { results: [] };
  const userPrompt = buildAnswerVerifierUserPrompt(items);
  const res = await directAiCall(ANSWER_VERIFIER_SYSTEM_PROMPT, userPrompt);
  if (res.status === 'completed' && Array.isArray(res.evaluation?.results)) {
    return res.evaluation;
  }
  return { results: [] };
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


  const t1Words = countWords(t1Clean);
  const t2Words = countWords(t2Clean);

  let res = await directFirst(
    WRITING_SYSTEM_PROMPT_V2,
    buildWritingUserPrompt({ prompts, task1Text: t1Clean, task2Text: t2Clean, task1Words: t1Words, task2Words: t2Words }),
    () => evaluateWritingServer({ task1Text: t1Clean, task2Text: t2Clean, prompts, task1Words: t1Words, task2Words: t2Words }),
    (json) => validateWritingEvaluationJson(json, { task1Words: t1Words, task2Words: t2Words }),
  );


  let model = res?.model || 'gemini';
  let provider = res?.provider || 'gemini';
  let tier = res?.status === 'completed' ? (res.tier || 'server') : 'unknown';

  // Local-key privacy mode or server fallback: if the server couldn't evaluate
  // and a local key exists on this device, run evaluation directly from the browser.
  if (res?.status === 'failed' && !res.triedDirect) {
    const userPrompt = buildWritingUserPrompt({ prompts, task1Text: t1Clean, task2Text: t2Clean, task1Words: t1Words, task2Words: t2Words });
    const direct = await directAiCall(WRITING_SYSTEM_PROMPT_V2, userPrompt);
    if (direct.status === 'completed') {
      res = { status: 'completed', evaluation: direct.evaluation, model: direct.model, provider: direct.provider };
      model = direct.model || 'ai';
      provider = direct.provider || 'gemini';
      tier = 'client_local_key';
    }
  }

  if (res?.status === 'completed') {
    console.info(`[AI Evaluation] Writing evaluated via ${provider} (${model}) [mode: ${tier}]`);
  }

  const validated = res?.status === 'completed'
    ? validateWritingEvaluationJson(res.evaluation, { task1Words: t1Words, task2Words: t2Words }) : null;

  if (validated) {
    // Official IELTS attempt rules:
    // - Unattempted: 0 words (Band 0)
    // - Attempted <= 20 words: awarded Band 1 on all criteria
    // - Attempted > 20 words: assessed against descriptors
    const t1Attempted = t1Words > 0;
    const t2Attempted = t2Words > 0;
    const bothAttempted = t1Attempted && t2Attempted;

    if (bothAttempted) {
      const finalResult = {
        ...validated,
        band: validated.overallBand,
        evaluationStatus: 'completed',
        coverage: {
          task1: 'attempted',
          task2: 'attempted',
          complete: true,
          statement: `Task 1: ${t1Words} words · Task 2: ${t2Words} words.`,
        },
        modelUsed: model,
        providerUsed: provider,
        evaluationTier: tier,
        task1Words: t1Words,
        task2Words: t2Words,
        evaluatedAt: new Date().toISOString()
      };
      setAiCacheItem(contentHash, finalResult);
      return finalResult;
    }

    const missing = [!t1Attempted && 'Task 1', !t2Attempted && 'Task 2'].filter(Boolean);
    const finalPartial = {
      evaluationStatus: 'partial',
      band: null,
      overallBand: null,
      task1Band: t1Attempted ? validated.task1Band : null,
      task2Band: t2Attempted ? validated.task2Band : null,
      criteria: validated.criteria,
      taskCriteria: validated.taskCriteria,
      priorityWeaknesses: validated.priorityWeaknesses || [],
      overallSummary: validated.overallSummary || '',
      task1Feedback: t1Attempted ? validated.task1Feedback : '',
      task2Feedback: t2Attempted ? validated.task2Feedback : '',
      strengths: validated.strengths || '',
      areasForImprovement: validated.areasForImprovement || '',
      coverage: {
        task1: t1Attempted ? 'attempted' : 'not_attempted',
        task2: t2Attempted ? 'attempted' : 'not_attempted',
        complete: false,
        statement: `${missing.join(' and ')} ${missing.length > 1 ? 'were' : 'was'} not attempted. Overall band withheld — task-level assessment provided.`,
      },
      message: `${missing.join(' and ')} ${missing.length > 1 ? 'were' : 'was'} not attempted, so no overall IELTS Writing band can be issued. Feedback and scores cover only what you wrote.`,
      modelUsed: model,
      providerUsed: provider,
      evaluationTier: tier,
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
export async function evaluateSpeakingWithAI({ transcripts = {}, testMeta = {}, durations = {}, speechMeta = {} }) {
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


  let res = await directFirst(
    SPEAKING_SYSTEM_PROMPT_V2,
    buildSpeakingUserPrompt({ transcripts, testMeta, durations, speechMeta }),
    () => evaluateSpeakingServer({ transcripts, testMeta, durations, speechMeta }),
    (json) => validateSpeakingEvaluationJson(json),
  );


  let model = res?.model || 'gemini';
  let provider = res?.provider || 'gemini';
  let tier = res?.status === 'completed' ? (res.tier || 'server') : 'unknown';

  if (res?.status === 'failed' && !res.triedDirect) {
    const userPrompt = buildSpeakingUserPrompt({ transcripts, testMeta, durations, speechMeta });
    const direct = await directAiCall(SPEAKING_SYSTEM_PROMPT_V2, userPrompt);
    if (direct.status === 'completed') {
      res = { status: 'completed', evaluation: direct.evaluation, model: direct.model, provider: direct.provider };
      model = direct.model || 'ai';
      provider = direct.provider || 'gemini';
      tier = 'client_local_key';
    }
  }

  if (res?.status === 'completed') {
    console.info(`[AI Evaluation] Speaking evaluated via ${provider} (${model}) [mode: ${tier}]`);
  }

  const validated = res?.status === 'completed' ? validateSpeakingEvaluationJson(res.evaluation) : null;

  if (validated) {
    const finalResult = {
      ...validated,
      band: validated.overallBand,
      evaluationStatus: 'completed',
      modelUsed: model,
      providerUsed: provider,
      evaluationTier: tier,
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
