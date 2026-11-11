import assert from 'node:assert/strict';
import { getActiveAiProvider, setActiveAiProvider } from '../src/utils/storage.js';
import { pickModels } from '../src/utils/ai/modelCatalog.js';
import { withProviderFallback } from '../src/utils/ai/providerFallback.js';
import { prepareRequestBudget, planRequestBudget } from '../src/utils/ai/requestBudget.js';
import { WRITING_SYSTEM_PROMPT_COMPACT, WRITING_SYSTEM_PROMPT_V2 } from '../src/utils/ieltsRubric.js';
const items = new Map();
globalThis.localStorage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
assert.equal(getActiveAiProvider(), 'gemini');
setActiveAiProvider('groq'); assert.equal(getActiveAiProvider(), 'groq');
setActiveAiProvider('gemini'); assert.equal(getActiveAiProvider(), 'gemini');
assert.equal(pickModels('gemini', ['gemini-4.0-flash', 'gemini-3.8-flash'])[0], 'gemini-3.8-flash');
assert.deepEqual(pickModels('groq', ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']), ['openai/gpt-oss-120b','openai/gpt-oss-20b']);
const calls = [], submission = { text: 'Full candidate text. '.repeat(600), question: 'Discuss both views.' }, before = JSON.stringify(submission);
const result = await withProviderFallback('gemini', async provider => {
  calls.push({ provider, text: submission.text, question: submission.question });
  return provider === 'gemini' ? { status: 'failed', reason: 'rate_limit', message: 'Gemini quota reached.' } : { status: 'completed', provider, evaluation: { valid: true } };
}, async () => true);
assert.deepEqual(calls.map(c => c.provider), ['gemini','groq']);
assert.equal(calls[0].text, calls[1].text); assert.equal(calls[0].question, calls[1].question);
assert.equal(JSON.stringify(submission), before);
assert.equal(result.fallbackFrom, 'gemini');
const failed = await withProviderFallback('gemini', async provider => ({ status: 'failed', reason: provider === 'gemini' ? 'rate_limit' : 'request_budget', message: provider }), async () => true);
assert.equal(failed.reason, 'rate_limit'); assert.equal(failed.providerFailures.length, 2); assert(!failed.evaluation);
for (const provider of ['gemini','groq']) {
  const system = provider === 'gemini' ? WRITING_SYSTEM_PROMPT_V2 : WRITING_SYSTEM_PROMPT_COMPACT;
  const budget = await prepareRequestBudget(provider, system, 'A complete essay. '.repeat(180), { model: provider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.8-flash' });
  assert(budget.ok); assert(budget.outputTokens >= 2000); assert(budget.inputTokens + budget.outputTokens <= budget.totalBudget);
  assert(!planRequestBudget(provider, system, 'long essay '.repeat(50000)).ok, 'oversized submissions are rejected, not truncated');
}
console.log('AI defaults: Gemini 3.8 first, Groq GPT-OSS secondary, saved choices, intact fallback input, failures and provider token budgets passed.');
