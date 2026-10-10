/**
 * Server-side AI evaluation for Cognition (Phase 4).
 * The Worker decrypts the user's credential in memory, calls Gemini,
 * validates the rubric JSON, and returns ONLY the evaluation.
 * The decrypted key exists transiently and is never logged or returned.
 *
 * Rubric prompts, validation and band arithmetic: src/utils/ieltsRubric.js (shared).
 */

export const AI_MODELS = {
  primary: 'gemini-3.8-flash',
  fallback: 'gemini-3.7-flash',
  chain: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'],
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS = {
  primary: 'openai/gpt-oss-120b',
  fallback: 'openai/gpt-oss-20b',
  chain: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'],
};

// Writing/Speaking rubric v2 lives in one module shared with the browser so
// server-side and local-key scoring can never drift apart.
export {
  WRITING_SYSTEM_PROMPT_V2 as IELTS_WRITING_SYSTEM_PROMPT,
  SPEAKING_SYSTEM_PROMPT_V2 as IELTS_SPEAKING_SYSTEM_PROMPT,
  ANSWER_VERIFIER_SYSTEM_PROMPT,
  buildWritingUserPrompt, buildSpeakingUserPrompt, buildAnswerVerifierUserPrompt,
  normalizeWritingEvaluation, normalizeSpeakingEvaluation, countWords,
} from '../../src/utils/ieltsRubric.js';
import { resolveModelChain } from '../../src/utils/ai/modelCatalog.js';
import {
  ANSWER_VERIFIER_SYSTEM_PROMPT,
  buildAnswerVerifierUserPrompt,
} from '../../src/utils/ieltsRubric.js';

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

async function callGemini(model, apiKey, systemPrompt, userPrompt) {
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (res.status === 503 && attempts < 2) {
      // Model overloaded upstream — short backoff before retry
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    // Never include the key or raw headers in errors.
    if (!res.ok) {
      const err = new Error(`Gemini request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }
}

async function callGroq(model, apiKey, systemPrompt, userPrompt) {
  let attempts = 0;
  let strictJson = true;
  while (attempts < 3) {
    attempts++;
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_completion_tokens: 16384,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'medium' } : {}),
        ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(55000),
    });

    if (res.status === 503 && attempts < 3) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    // Strict JSON mode rejects the whole reply over one bad character — retry without it.
    if (res.status === 400 && strictJson) {
      strictJson = false;
      continue;
    }

    if (!res.ok) {
      const err = new Error(`Groq request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  }
}

/**
 * Runs the evaluation chain: primary model → fallback models.
 * Supports both Google Gemini and Groq providers.
 * Returns { status, evaluation, model, provider } or { status, message }.
 */
export async function runEvaluationChain({ apiKey, systemPrompt, userPrompt, validator, provider = 'gemini' }) {
  let lastError = null;
  const isGroq = provider === 'groq';
  // Live list of models this key can use — never a stale hardcoded name.
  const models = await resolveModelChain(isGroq ? 'groq' : 'gemini', apiKey);

  for (const model of models) {
    try {
      const text = isGroq
        ? await callGroq(model, apiKey, systemPrompt, userPrompt)
        : await callGemini(model, apiKey, systemPrompt, userPrompt);
      const parsed = extractJsonFromText(text);
      const validated = validator(parsed);
      if (validated) {
        return { status: 'completed', evaluation: validated, model, provider: isGroq ? 'groq' : 'gemini' };
      }
    } catch (e) {
      lastError = e;
      if (e.status === 429) {
        return { status: 'failed', message: `AI rate limit reached (429) on ${isGroq ? 'Groq' : 'Gemini'}. Please wait a minute and retry.` };
      }
      console.error(`Model ${model} evaluation attempt failed:`, e.constructor?.name, e.message);
    }
  }
  const detail = lastError?.status === 400 || lastError?.status === 403
    ? `${isGroq ? 'Groq' : 'Gemini'} rejected the evaluation request. Check your API key permissions and quota.`
    : lastError?.status === 503
    ? `${isGroq ? 'Groq' : 'Gemini'} servers are temporarily overloaded (503 Service Unavailable). Please retry in a moment.`
    : 'AI evaluation failed to produce a valid IELTS rubric response. Check your API key configuration and try again.';
  return {
    status: 'failed',
    message: detail,
  };
}

export async function validateGroqKeyServer(apiKey) {
  try {
    const res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 429) return { valid: true };
    if (res.status === 401 || res.status === 403) {
      return { valid: false, code: 'invalid_key', message: 'Groq rejected this API key. Verify that you copied the complete key from console.groq.com and try again.' };
    }
    return { valid: false, code: 'provider_unreachable', message: 'Could not reach Groq to verify the key. Please try again shortly.' };
  } catch {
    return { valid: false, code: 'provider_unreachable', message: 'Could not reach Groq to verify the key. Please try again shortly.' };
  }
}

/**
 * Server-side credential validation (Part K): cheap models-list ping.
 * Returns { valid, code, message }. Never logs or echoes the key.
 *
 * `code` lets the client distinguish "this key is bad" (never stored anywhere)
 * from "the server can't reach/use Google" (the key may still be usable from
 * the user's own browser, so the client may offer on-device storage).
 */
export async function validateGeminiKeyServer(apiKey) {
  try {
    const res = await fetch(GEMINI_BASE, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 429) return { valid: true };

    let status = '';
    let reason = '';
    let providerMessage = '';
    try {
      const body = await res.json();
      status = body?.error?.status || '';
      providerMessage = body?.error?.message || '';
      reason = (body?.error?.details || []).map(d => d?.reason).find(Boolean) || '';
    } catch { /* non-JSON error body */ }

    if (reason === 'API_KEY_INVALID' || /api key not valid|api_key_invalid/i.test(providerMessage)) {
      return { valid: false, code: 'invalid_key', message: 'Gemini rejected this API key. Check that you copied the whole key and try again.' };
    }
    if (status === 'FAILED_PRECONDITION' || /location is not supported/i.test(providerMessage)) {
      return { valid: false, code: 'provider_region', message: 'Google’s Gemini API is not available from Cognition’s server region for this key.' };
    }
    if (res.status === 403 || status === 'PERMISSION_DENIED') {
      return { valid: false, code: 'key_restricted', message: 'This key is restricted (API or referrer limits) and cannot be used by Cognition. Create an unrestricted Gemini key in Google AI Studio.' };
    }
    if (res.status === 400) {
      return { valid: false, code: 'invalid_key', message: 'Gemini rejected this API key. Check that you copied the whole key and try again.' };
    }
    return { valid: false, code: 'provider_unreachable', message: 'Could not verify the key with Google right now. Please try again shortly.' };
  } catch {
    return { valid: false, code: 'provider_unreachable', message: 'Could not reach Google to verify the key. Please try again shortly.' };
  }
}

/**
 * Batched answer verification: one Gemini/Groq request for all uncertain items.
 * Returns { results: [{id, decision, matchedAnswer, reason}] } or { results: [] }.
 */
export async function runAnswerVerification(items, apiKey, provider = 'gemini') {
  const userPrompt = buildAnswerVerifierUserPrompt(items);

  try {
    const [model] = await resolveModelChain(provider === 'groq' ? 'groq' : 'gemini', apiKey);
    const text = provider === 'groq'
      ? await callGroq(model, apiKey, ANSWER_VERIFIER_SYSTEM_PROMPT, userPrompt)
      : await callGemini(model, apiKey, ANSWER_VERIFIER_SYSTEM_PROMPT, userPrompt);
    const parsed = extractJsonFromText(text);
    if (parsed && Array.isArray(parsed.results)) {
      const valid = parsed.results.filter(r => r && r.id && ['CORRECT', 'INCORRECT', 'UNCERTAIN'].includes(r.decision));
      return { results: valid };
    }
  } catch (e) {
    if (e.status === 429) {
      return { results: [], rateLimited: true };
    }
  }
  return { results: [] };
}
