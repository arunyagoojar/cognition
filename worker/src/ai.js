/**
 * Server-side AI evaluation for Cognition (Phase 4).
 * The Worker decrypts the user's credential in memory, calls Gemini,
 * validates the rubric JSON, and returns ONLY the evaluation.
 * The decrypted key exists transiently and is never logged or returned.
 *
 * Rubric prompts, validation and band arithmetic: src/utils/ieltsRubric.js (shared).
 */

export const AI_MODELS = {
  primary: 'gemini-2.5-flash',
  fallback: 'gemini-2.0-flash',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Writing/Speaking rubric v2 lives in one module shared with the browser so
// server-side and local-key scoring can never drift apart.
export {
  WRITING_SYSTEM_PROMPT_V2 as IELTS_WRITING_SYSTEM_PROMPT,
  SPEAKING_SYSTEM_PROMPT_V2 as IELTS_SPEAKING_SYSTEM_PROMPT,
  buildWritingUserPrompt, buildSpeakingUserPrompt,
  normalizeWritingEvaluation, normalizeSpeakingEvaluation, countWords,
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
  // Never include the key or raw headers in errors.
  if (!res.ok) {
    const err = new Error(`Gemini request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Runs the evaluation chain: primary model → fallback model.
 * Returns { status, evaluation, model } or { status, message }.
 */
export async function runEvaluationChain({ apiKey, systemPrompt, userPrompt, validator }) {
  let lastError = null;
  for (const model of [AI_MODELS.primary, AI_MODELS.fallback]) {
    try {
      const text = await callGemini(model, apiKey, systemPrompt, userPrompt);
      const parsed = extractJsonFromText(text);
      const validated = validator(parsed);
      if (validated) {
        return { status: 'completed', evaluation: validated, model };
      }
    } catch (e) {
      lastError = e;
      if (e.status === 429) {
        return { status: 'failed', message: 'AI rate limit reached (429). Please wait a minute and retry.' };
      }
      console.error(`Model ${model} evaluation attempt failed:`, e.constructor?.name, e.message);
    }
  }
  const detail = lastError?.status === 400 || lastError?.status === 403
    ? 'Gemini rejected the evaluation request. Check your API key permissions and quota in Google AI Studio.'
    : 'AI evaluation failed to produce a valid IELTS rubric response. Check your API key configuration and try again.';
  return {
    status: 'failed',
    message: detail,
  };
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

export const ANSWER_VERIFIER_SYSTEM_PROMPT = `You are an IELTS answer-key verifier.

For each item you receive, decide whether the student's answer is an acceptable representation of the OFFICIAL answer for that exact question, under the supplied constraints (word limits, singular/plural, numbers, dates, times, units, names, spelling requirements).

Rules:
- The official answer is the authority. Never invent or substitute an answer.
- Accept obvious representations: case differences, number format ("11" vs "eleven"), optional parenthetical parts, minor spelling that preserves the word, singular/plural when the question context makes it acceptable.
- Reject answers that change meaning: am/pm swaps, different quantities, related-but-different words ("university" is not "college"), wrong concepts.
- If you cannot confidently establish equivalence, decide UNCERTAIN.

Respond with structured JSON ONLY (no markdown, no commentary):
{
  "results": [
    { "id": "<echo the item id>",
      "decision": "CORRECT" | "INCORRECT" | "UNCERTAIN",
      "matchedAnswer": "<the official/accepted answer it corresponds to>",
      "reason": "<short factual explanation>" }
  ]
}
Include exactly one result per input item, echoing ids verbatim.`;

/**
 * Batched answer verification: one Gemini request for all uncertain items.
 * Returns { results: [{id, decision, matchedAnswer, reason}] } or { results: [] }.
 */
export async function runAnswerVerification(items, apiKey) {
  const userPrompt = `Verify the following ${items.length} student answer(s) against the official IELTS answer key.

${JSON.stringify(items.map(it => ({
  id: it.id,
  question: it.questionText || '',
  questionType: it.questionType || '',
  instruction: it.instruction || '',
  officialAnswer: it.officialAnswer || '',
  studentAnswer: it.studentAnswer || '',
  wordLimit: it.wordLimit || null,
})), null, 2)}`;

  try {
    const text = await callGemini(AI_MODELS.primary, apiKey, ANSWER_VERIFIER_SYSTEM_PROMPT, userPrompt);
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
