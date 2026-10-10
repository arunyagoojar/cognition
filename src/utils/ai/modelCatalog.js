/**
 * Live model selection for Groq and Gemini, shared by the browser and the Worker.
 *
 * Providers retire models on short notice, so the evaluator never trusts a
 * hardcoded name alone: it asks the provider which models this key can use
 * (`listModels`) and orders them with `pickModels`. The preferred lists below
 * are only a ranking — anything not offered by the provider is skipped, and if
 * none of them exist the newest model of the right family is used instead.
 */

export const PREFERRED_MODELS = {
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'],
  gemini: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'],
};

const MAX_CHAIN = 4;

function geminiVersion(id) {
  const m = /^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/.exec(id);
  return m ? { v: Number(m[1]), lite: Boolean(m[2]) } : null;
}

/** Orders the models to try: preferred ones that exist, then the newest of the family. */
export function pickModels(provider, availableIds) {
  const preferred = PREFERRED_MODELS[provider] || [];
  if (!Array.isArray(availableIds) || availableIds.length === 0) return preferred.slice(0, MAX_CHAIN);
  const available = new Set(availableIds);

  if (provider === 'gemini') {
    // Stable "gemini-X.Y-flash" models the key can use: full Flash newest
    // first, then Flash-Lite newest first. A newer release is picked up
    // automatically; retired ones are simply absent from the list.
    const family = availableIds
      .map(id => ({ id, ver: geminiVersion(id) }))
      .filter(x => x.ver)
      .sort((a, b) => (a.ver.lite - b.ver.lite) || (b.ver.v - a.ver.v))
      .map(x => x.id);
    return (family.length ? family : preferred).slice(0, MAX_CHAIN);
  }

  const chain = preferred.filter(id => available.has(id));
  let family = [];
  if (provider === 'groq') {
    family = availableIds.filter(id => /gpt-oss-(120b|20b)$/.test(id) || /^qwen\/qwen[\d.]+-\d+b$/.test(id))
      .sort((a, b) => Number(/120b/.test(b)) - Number(/120b/.test(a)));
  }
  for (const id of family) if (!chain.includes(id)) chain.push(id);
  return (chain.length ? chain : preferred).slice(0, MAX_CHAIN);
}

/** Fetches the model ids this key can use; null when the provider can't be reached. */
export async function listModels(provider, key, { timeoutMs = 8000 } = {}) {
  try {
    if (provider === 'groq') {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return null;
      const data = await r.json();
      return (data.data || []).filter(m => m.active !== false).map(m => m.id);
    }
    if (provider === 'gemini') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return null;
      const data = await r.json();
      return (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => String(m.name || '').replace(/^models\//, ''));
    }
  } catch { /* unreachable — caller falls back to the preferred list */ }
  return null;
}

const cache = new Map(); // `${provider}:${keyTail}` → { at, chain }
const CACHE_MS = 6 * 60 * 60 * 1000;

/** The ordered model chain for this provider + key (cached for a few hours). */
export async function resolveModelChain(provider, key) {
  const cacheKey = `${provider}:${String(key).slice(-6)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.chain;
  const ids = await listModels(provider, key);
  const chain = pickModels(provider, ids);
  if (ids) cache.set(cacheKey, { at: Date.now(), chain });
  return chain;
}
