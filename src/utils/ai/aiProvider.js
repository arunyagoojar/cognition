// Unified AI Provider Service for Cognition IELTS
// Coordinates Google Gemini (Primary/Secondary) and Groq (Fallbacks & Whisper STT)
// Implements strict fallback chains, provider health tracking, exponential backoff, and JSON validation.

import { 
  AI_CONFIG, 
  IELTS_SPEAKING_EVALUATOR_V1, 
  IELTS_WRITING_EVALUATOR_V1, 
  IELTS_READING_VERIFIER_V1, 
  IELTS_LISTENING_VERIFIER_V1 
} from './aiConfig.js';
import { getApiKey } from '../storage.js';

// Provider health tracking state
const providerHealth = {
  gemini: {
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    lastLatencyMs: 0,
    cooldownUntil: 0,
    consecutiveErrors: 0,
  },
  groq: {
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    lastLatencyMs: 0,
    cooldownUntil: 0,
    consecutiveErrors: 0,
  }
};

/**
 * Diagnostic logger (development only, sanitized: never logs keys or raw audio).
 */
export function logDiagnostic(entry) {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;
  const sanitized = {
    timestamp: new Date().toISOString(),
    attemptId: entry.attemptId || 'anon',
    skill: entry.skill,
    provider: entry.provider,
    model: entry.model,
    latencyMs: entry.latencyMs,
    httpStatus: entry.httpStatus,
    retryCount: entry.retryCount || 0,
    fallbackCount: entry.fallbackCount || 0,
    status: entry.status,
    message: entry.message || ''
  };
  if (entry.status === 'failed') {
    console.warn('[AI_DIAGNOSTIC_FAILURE]', JSON.stringify(sanitized));
  } else {
    // Info log
    console.info('[AI_DIAGNOSTIC]', JSON.stringify(sanitized));
  }
}

/**
 * Extracts and parses JSON from model response text cleanly.
 */
export function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim();

  // 1. Direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 2. Fenced code block extraction (```json ... ``` or ``` ...)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  // 3. Substring between first '{' and last '}'
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
 * Helper to get user-configured Groq API key from localStorage or env.
 */
export function getGroqApiKey() {
  try {
    if (typeof window !== 'undefined') {
      const urlKey = new URLSearchParams(window.location.search).get('groqKey');
      if (urlKey) return urlKey.trim();
      const saved = localStorage.getItem('omniprep_groq_key');
      if (saved && saved.trim()) return saved.trim();
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GROQ_API_KEY) {
      return import.meta.env.VITE_GROQ_API_KEY.trim();
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Base delay helper for exponential backoff.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a Gemini generateContent request.
 */
async function callGemini({ apiKey, model, systemPrompt, contents, timeoutMs = 30000 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents,
        generationConfig: {
          temperature: AI_CONFIG.gemini.temperature,
          maxOutputTokens: AI_CONFIG.gemini.maxOutputTokens
        }
      }),
      signal: controller?.signal
    });

    if (timeoutId) clearTimeout(timeoutId);
    return res;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Executes a Groq Chat Completion request (OpenAI-compatible).
 */
async function callGroq({ apiKey, model, systemPrompt, prompt, expectJson = true, timeoutMs = 30000 }) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model,
    messages,
    temperature: AI_CONFIG.groq.temperature,
    max_tokens: AI_CONFIG.groq.maxOutputTokens
  };

  if (expectJson) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload),
      signal: controller?.signal
    });

    if (timeoutId) clearTimeout(timeoutId);
    return res;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Unified AI Provider Engine
 */
export class AIProvider {
  /**
   * Health check for a provider
   */
  static async healthCheck(providerName, key) {
    if (!key || !key.trim()) return { success: false, message: `${providerName} API key missing` };

    if (providerName === 'gemini') {
      try {
        // Fast key validation via Gemini models list endpoint
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`);
        if (res.ok) return { success: true, message: '✓ Gemini connected' };
        if (res.status === 429) return { success: true, message: '✓ Gemini connected (Rate limited)' };
        const data = await res.json().catch(() => null);
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        return { success: false, message: `Gemini: ${errMsg}` };
      } catch (e) {
        return { success: false, message: e.message || 'Gemini connection failed' };
      }
    }

    if (providerName === 'groq') {
      try {
        // Fast key validation via Groq models list endpoint
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            'Authorization': `Bearer ${key.trim()}`
          }
        });
        if (res.ok) return { success: true, message: '✓ Groq connected' };
        if (res.status === 429) return { success: true, message: '✓ Groq connected (Rate limited)' };
        const data = await res.json().catch(() => null);
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        return { success: false, message: `Groq: ${errMsg}` };
      } catch (e) {
        return { success: false, message: e.message || 'Groq connection failed' };
      }
    }

    return { success: false, message: 'Unknown provider' };
  }

  /**
   * Authoritative execution pipeline adhering to Section 35 Fallback Chain:
   * PRIMARY: Gemini Flash
   * ↓ failure
   * SECONDARY: Gemini Flash-Lite
   * ↓ failure
   * FALLBACK 1: Groq GPT-OSS 120B
   * ↓ failure
   * FALLBACK 2: Groq Qwen 3.8 27B
   * ↓ failure
   * FAILED
   */
  static async executeWithFallbackChain({
    skill,
    systemPrompt,
    userPrompt,
    contentsOverride = null,
    attemptId = 'anon',
  }) {
    const geminiKey = getApiKey();
    const groqKey = getGroqApiKey();
    const startTime = Date.now();

    const plan = [
      {
        provider: 'gemini',
        model: AI_CONFIG.gemini.primaryModel,
        type: 'primary',
        key: geminiKey
      },
      {
        provider: 'gemini',
        model: AI_CONFIG.gemini.secondaryModel,
        type: 'secondary',
        key: geminiKey
      },
      {
        provider: 'groq',
        model: AI_CONFIG.groq.fallbackModel1,
        type: 'fallback_1',
        key: groqKey
      },
      {
        provider: 'groq',
        model: AI_CONFIG.groq.fallbackModel2,
        type: 'fallback_2',
        key: groqKey
      }
    ];

    let fallbackCount = 0;

    for (const step of plan) {
      if (!step.key) {
        continue;
      }

      // Check provider cooldown
      const pHealth = providerHealth[step.provider];
      if (Date.now() < pHealth.cooldownUntil) {
        continue;
      }

      // Retry attempts for transient errors
      for (let retry = 0; retry <= AI_CONFIG.execution.maxRetries; retry++) {
        if (retry > 0) {
          const delay = AI_CONFIG.execution.baseRetryDelayMs * Math.pow(2, retry - 1);
          await sleep(delay);
        }

        const callStart = Date.now();
        try {
          let resText = null;
          let httpStatus = 0;

          if (step.provider === 'gemini') {
            const contents = contentsOverride || [{ parts: [{ text: userPrompt }] }];
            const res = await callGemini({
              apiKey: step.key,
              model: step.model,
              systemPrompt,
              contents,
              timeoutMs: AI_CONFIG.execution.timeoutMs
            });
            httpStatus = res.status;

            if (res.status === 429) {
              pHealth.rateLimitCount++;
              pHealth.cooldownUntil = Date.now() + AI_CONFIG.gemini.rateLimitCooldownMs;
              logDiagnostic({
                attemptId,
                skill,
                provider: step.provider,
                model: step.model,
                latencyMs: Date.now() - callStart,
                httpStatus: 429,
                retryCount: retry,
                fallbackCount,
                status: 'rate_limited'
              });
              break; // move to next fallback
            }

            if (res.ok) {
              const data = await res.json();
              resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            }
          } else if (step.provider === 'groq') {
            const res = await callGroq({
              apiKey: step.key,
              model: step.model,
              systemPrompt,
              prompt: userPrompt,
              timeoutMs: AI_CONFIG.execution.timeoutMs
            });
            httpStatus = res.status;

            if (res.status === 429) {
              pHealth.rateLimitCount++;
              pHealth.cooldownUntil = Date.now() + AI_CONFIG.groq.rateLimitCooldownMs;
              break;
            }

            if (res.ok) {
              const data = await res.json();
              resText = data.choices?.[0]?.message?.content;
            }
          }

          if (resText) {
            const parsed = extractJsonFromText(resText);
            if (parsed) {
              // Record success
              pHealth.successCount++;
              pHealth.consecutiveErrors = 0;
              pHealth.lastLatencyMs = Date.now() - callStart;

              logDiagnostic({
                attemptId,
                skill,
                provider: step.provider,
                model: step.model,
                latencyMs: pHealth.lastLatencyMs,
                httpStatus: 200,
                retryCount: retry,
                fallbackCount,
                status: 'completed'
              });

              return {
                status: 'completed',
                provider: { name: step.provider, model: step.model, tier: step.type },
                data: parsed,
                latencyMs: Date.now() - startTime
              };
            }
          }
        } catch (err) {
          pHealth.failureCount++;
          pHealth.consecutiveErrors++;
          logDiagnostic({
            attemptId,
            skill,
            provider: step.provider,
            model: step.model,
            latencyMs: Date.now() - callStart,
            httpStatus: 0,
            retryCount: retry,
            fallbackCount,
            status: 'error',
            message: err.message
          });
        }
      }

      fallbackCount++;
    }

    // ALL PROVIDERS FAILED — Return clean FAILED state, NEVER fake scores
    logDiagnostic({
      attemptId,
      skill,
      provider: 'none',
      model: 'none',
      latencyMs: Date.now() - startTime,
      httpStatus: 503,
      fallbackCount,
      status: 'failed',
      message: 'All configured AI evaluation providers exhausted or failed.'
    });

    return {
      status: 'failed',
      provider: null,
      data: null,
      error: 'AI evaluation could not be completed. Check API configuration and connectivity.',
      latencyMs: Date.now() - startTime
    };
  }

  /**
   * Transcribe Audio:
   * Uses Groq Whisper if available, or records browser-provided transcript.
   */
  static async transcribeAudio(audioBlob) {
    const groqKey = getGroqApiKey();
    if (!groqKey || !audioBlob) {
      return {
        status: 'skipped',
        transcript: '',
        provider: 'none',
        model: 'none'
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'speaking.webm');
      formData.append('model', AI_CONFIG.groq.whisperModel);
      formData.append('language', 'en');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey.trim()}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        return {
          status: 'completed',
          transcript: data.text || '',
          provider: 'groq',
          model: AI_CONFIG.groq.whisperModel
        };
      }
    } catch (e) {
      console.warn('Groq Whisper transcription failed', e);
    }

    return {
      status: 'failed',
      transcript: '',
      provider: 'groq',
      model: AI_CONFIG.groq.whisperModel
    };
  }

  /**
   * Evaluate Speaking:
   * Evaluates transcripts and audio metadata against IELTS criteria.
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

    const userPrompt = `Candidate Responses by Part:
${JSON.stringify(transcripts, null, 2)}

Test Topic Context: ${testMeta?.title || 'IELTS Speaking Academic Interview'}
Audio Evidence Available: ${Object.keys(audioRecordings || {}).length > 0 ? 'Yes (audio samples captured)' : 'No (text transcripts only)'}`;

    const res = await this.executeWithFallbackChain({
      skill: 'speaking',
      systemPrompt: IELTS_SPEAKING_EVALUATOR_V1,
      userPrompt,
      attemptId
    });

    if (res.status === 'completed' && res.data) {
      const data = res.data;
      const band = typeof data.overallBand === 'number' ? Math.round(data.overallBand * 2) / 2 : null;
      return {
        status: 'completed',
        band,
        overallBand: band,
        criteria: data.criteria || null,
        overallSummary: data.overallSummary || '',
        strengths: data.strengths || '',
        areasForImprovement: data.areasForImprovement || '',
        provider: res.provider
      };
    }

    return {
      status: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: res.error || 'Speaking AI evaluation failed.'
    };
  }

  /**
   * Evaluate Writing:
   * Evaluates Task 1 and Task 2 against official IELTS criteria.
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

    const t1Words = t1Clean ? t1Clean.split(/\s+/).length : 0;
    const t2Words = t2Clean ? t2Clean.split(/\s+/).length : 0;

    const userPrompt = `Evaluate the candidate's IELTS Academic Writing submission:
Task 1 Prompt: ${prompts.task1 || 'Academic visual/data report (150 words minimum)'}
Task 1 Candidate Response (${t1Words} words):
${t1Clean || '(No response submitted)'}

Task 2 Prompt: ${prompts.task2 || 'Academic discursive essay (250 words minimum)'}
Task 2 Candidate Response (${t2Words} words):
${t2Clean || '(No response submitted)'}`;

    const res = await this.executeWithFallbackChain({
      skill: 'writing',
      systemPrompt: IELTS_WRITING_EVALUATOR_V1,
      userPrompt,
      attemptId
    });

    if (res.status === 'completed' && res.data) {
      const data = res.data;
      const overallBand = typeof data.overallBand === 'number' ? Math.round(data.overallBand * 2) / 2 : null;
      const task1Band = typeof data.task1Band === 'number' ? Math.round(data.task1Band * 2) / 2 : overallBand;
      const task2Band = typeof data.task2Band === 'number' ? Math.round(data.task2Band * 2) / 2 : overallBand;

      return {
        status: 'completed',
        band: overallBand,
        overallBand,
        task1Band,
        task2Band,
        task1Words: t1Words,
        task2Words: t2Words,
        criteria: data.criteria || null,
        task1Feedback: data.task1Feedback || '',
        task2Feedback: data.task2Feedback || '',
        overallSummary: data.overallSummary || '',
        strengths: data.strengths || '',
        areasForImprovement: data.areasForImprovement || '',
        provider: res.provider
      };
    }

    return {
      status: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: res.error || 'Writing AI evaluation failed.'
    };
  }

  /**
   * Evaluate Reading Batch:
   * Batches passage questions (10-20 questions) for contextual verification.
   */
  static async evaluateReadingBatch({ passageTitle, passageText, questions = [], answers = {}, attemptId = 'anon' }) {
    if (!questions || questions.length === 0) {
      return { status: 'completed', results: {} };
    }

    const questionItems = questions.map(q => ({
      questionId: q.id,
      number: q.number,
      questionText: q.question,
      options: q.options || null,
      officialAnswer: q.answer,
      candidateAnswer: answers[q.id] || '(Unanswered)'
    }));

    const userPrompt = `Passage: ${passageTitle}
Passage Text: ${passageText ? passageText.slice(0, 3500) : '(Passage facts)'}

Questions to Verify:
${JSON.stringify(questionItems, null, 2)}`;

    const res = await this.executeWithFallbackChain({
      skill: 'reading',
      systemPrompt: IELTS_READING_VERIFIER_V1,
      userPrompt,
      attemptId
    });

    const verificationMap = {};
    if (res.status === 'completed' && res.data?.questions) {
      for (const item of res.data.questions) {
        if (item.questionId) {
          verificationMap[item.questionId] = {
            isCorrect: Boolean(item.isCorrect),
            isAmbiguous: Boolean(item.isAmbiguous),
            confidence: item.confidence || 'medium',
            reason: item.reason || '',
          };
        }
      }
    }

    return {
      status: res.status,
      verificationMap,
      sectionSummary: res.data?.sectionSummary || ''
    };
  }

  /**
   * Evaluate Listening Batch:
   * Batches section questions against audio transcript.
   */
  static async evaluateListeningBatch({ sectionNumber, transcript = '', questions = [], answers = {}, attemptId = 'anon' }) {
    if (!questions || questions.length === 0) {
      return { status: 'completed', results: {} };
    }

    const questionItems = questions.map(q => ({
      questionId: q.id,
      number: q.number,
      questionText: q.question,
      options: q.options || null,
      officialAnswer: q.answer,
      candidateAnswer: answers[q.id] || '(Unanswered)'
    }));

    const userPrompt = `Listening Section: ${sectionNumber}
Transcript: ${transcript ? transcript.slice(0, 3500) : '(Audio detail context)'}

Questions to Verify:
${JSON.stringify(questionItems, null, 2)}`;

    const res = await this.executeWithFallbackChain({
      skill: 'listening',
      systemPrompt: IELTS_LISTENING_VERIFIER_V1,
      userPrompt,
      attemptId
    });

    const verificationMap = {};
    if (res.status === 'completed' && res.data?.questions) {
      for (const item of res.data.questions) {
        if (item.questionId) {
          verificationMap[item.questionId] = {
            isCorrect: Boolean(item.isCorrect),
            isAmbiguous: Boolean(item.isAmbiguous),
            confidence: item.confidence || 'medium',
            reason: item.reason || '',
          };
        }
      }
    }

    return {
      status: res.status,
      verificationMap,
      sectionSummary: res.data?.sectionSummary || ''
    };
  }
}
