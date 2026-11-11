import assert from 'node:assert/strict';
import { evaluateSpeakingWithAI, evaluateWritingWithAI } from '../src/utils/geminiEvaluator.js';
import { saveLocalGeminiKey, saveLocalGroqKey, setActiveAiProvider } from '../src/utils/storage.js';
import { prepareRequestBudget, planRequestBudget } from '../src/utils/ai/requestBudget.js';
import { buildSpeakingUserPrompt, SPEAKING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_COMPACT } from '../src/utils/ieltsRubric.js';

const storage = new Map();
globalThis.localStorage = {
  get length() { return storage.size; },
  key: index => [...storage.keys()][index],
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const realFetch = globalThis.fetch;
const secret = 'private-key-and-provider-response-must-never-appear';
const shortPayload = {
  transcripts: { '0_0': 'Um, I enjoy travelling on local buses because they connect my neighbourhood to useful places.' },
  testMeta: { questions: { '0_0': 'What do you enjoy about travelling in your city?' } },
  durations: { '0_0': 12 },
};
const validEvaluation = {
  criteria: Object.fromEntries(['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map(key => [key, {
    band: 6, personalizedAssessment: 'Your reason for using local buses is clear.', corrections: [], nextBandAdvice: 'Develop the example of a useful place.',
  }])),
  overallSummary: 'The answer expresses a clear preference and gives a relevant reason.',
  priorityWeaknesses: ['Develop an example.'], strengths: 'Clear explanation.', areasForImprovement: 'More detail.',
};

function setup({ active = 'gemini', gemini = 429, groq = 429, evaluation = validEvaluation } = {}) {
  storage.clear();
  saveLocalGeminiKey(`gemini-${secret}`);
  saveLocalGroqKey(`groq-${secret}`);
  setActiveAiProvider(active);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const address = String(url);
    if (address.includes('pageSize=')) return Response.json({ models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }] });
    if (address.endsWith('/models')) return Response.json({ data: [{ id: 'openai/gpt-oss-120b' }] });
    const provider = address.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
    calls.push({ provider, request: JSON.parse(options.body) });
    const outcome = provider === 'gemini' ? gemini : groq;
    if (outcome === 'network') throw new Error(secret);
    if (outcome === 'timeout') throw new DOMException(secret, 'TimeoutError');
    if (outcome === 'success') return Response.json(provider === 'gemini'
      ? { candidates: [{ content: { parts: [{ text: JSON.stringify(evaluation) }] } }] }
      : { choices: [{ message: { content: JSON.stringify(evaluation) } }] });
    if (outcome === 'truncated') return Response.json(provider === 'gemini'
      ? { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(evaluation) }] } }] }
      : { choices: [{ finish_reason: 'length', message: { content: JSON.stringify(evaluation) } }] });
    if (outcome === 'invalid') return Response.json(provider === 'gemini'
      ? { candidates: [{ content: { parts: [{ text: 'not a valid rubric' }] } }] }
      : { choices: [{ message: { content: 'not a valid rubric' } }] });
    return new Response(JSON.stringify({ error: { message: secret } }), { status: outcome });
  };
  return calls;
}

let checks = 0;
async function test(name, run) {
  try {
    await run();
    checks++;
    console.log(`✓ ${name}`);
  } finally {
    globalThis.fetch = realFetch;
    storage.clear();
  }
}

await test('Gemini rate-limit failure stays primary when Groq cannot fit the request', async () => {
  let payload;
  for (let repeats = 100; repeats <= 2000; repeats += 100) {
    const candidate = { ...shortPayload, transcripts: { '0_0': 'I explain how shared transport makes journeys more accessible. '.repeat(repeats) } };
    const prompt = buildSpeakingUserPrompt(candidate);
    const groq = await prepareRequestBudget('groq', SPEAKING_SYSTEM_PROMPT_COMPACT, prompt, { model: 'openai/gpt-oss-120b' });
    if (!groq.ok && planRequestBudget('gemini', SPEAKING_SYSTEM_PROMPT_V2, prompt).ok) { payload = candidate; break; }
  }
  assert(payload, 'Fixture must fit Gemini while exceeding the Groq request budget.');
  const calls = setup();
  const result = await evaluateSpeakingWithAI(payload);
  assert.equal(result.evaluationStatus, 'failed');
  assert.equal(result.provider, 'gemini');
  assert.equal(result.reason, 'rate_limit');
  assert.equal(result.httpStatus, 429);
  assert(result.message.startsWith('Gemini rate limit reached.'));
  assert(result.message.includes('Groq fallback:'));
  assert.deepEqual(result.providerFailures.map(failure => [failure.provider, failure.reason]), [['gemini', 'rate_limit'], ['groq', 'request_budget']]);
  assert(calls.some(call => call.provider === 'gemini'));
  assert(!calls.some(call => call.provider === 'groq'));
  assert(!JSON.stringify(result).includes(secret));
});

await test('Gemini authentication, network and timeout errors survive a later fallback failure', async () => {
  for (const [outcome, reason] of [[403, 'authentication'], ['network', 'network'], ['timeout', 'timeout']]) {
    setup({ gemini: outcome, groq: 429 });
    const result = await evaluateSpeakingWithAI(shortPayload);
    assert.equal(result.evaluationStatus, 'failed');
    assert.equal(result.provider, 'gemini');
    assert.equal(result.reason, reason);
    assert.equal(result.providerFailures[1].reason, 'rate_limit');
    assert(result.message.startsWith(result.providerFailures[0].message));
    assert(result.message.includes('Groq fallback:'));
    assert(!JSON.stringify(result).includes(secret));
  }
});

await test('the same priority rule applies when Groq is selected first', async () => {
  setup({ active: 'groq', groq: 429, gemini: 403 });
  const result = await evaluateSpeakingWithAI(shortPayload);
  assert.equal(result.provider, 'groq');
  assert.equal(result.reason, 'rate_limit');
  assert(result.message.startsWith('Groq rate limit reached.'));
  assert(result.message.includes('Gemini fallback:'));
  assert.deepEqual(result.providerFailures.map(failure => failure.provider), ['groq', 'gemini']);
});

await test('invalid provider output has a stable reason and no fabricated score', async () => {
  setup({ gemini: 'invalid', groq: 429 });
  const result = await evaluateSpeakingWithAI(shortPayload);
  assert.equal(result.reason, 'invalid_response');
  assert.equal(result.band, null);
  assert.equal(result.criteria, null);
});

await test('a successful fallback still returns its validated evaluation', async () => {
  const calls = setup({ gemini: 429, groq: 'success' });
  const result = await evaluateSpeakingWithAI(shortPayload);
  assert.equal(result.evaluationStatus, 'completed');
  assert.equal(result.providerUsed, 'groq');
  assert.equal(result.overallBand, 6);
  assert.equal(result.reason, undefined);
  assert.equal(result.providerFailures, undefined);
  assert.deepEqual(calls.map(call => call.provider), ['gemini', 'groq']);
});

await test('truncated replies never become scores even when their JSON parses', async () => {
  for (const provider of ['gemini', 'groq']) {
    setup({ active: provider, gemini: provider === 'gemini' ? 'truncated' : 429, groq: provider === 'groq' ? 'truncated' : 429 });
    const result = await evaluateSpeakingWithAI(shortPayload);
    assert.equal(result.evaluationStatus, 'failed');
    assert.equal(result.reason, 'response_budget');
    assert.equal(result.band, null);
    assert(result.message.includes('No score was accepted'));
  }
});

await test('switching providers evaluates Writing and Speaking with the selected provider instead of returning the other provider cache', async () => {
  const criterion = { band: 6, evidence: 'A relevant example', personalizedAssessment: 'The response communicates its meaning.', corrections: [], nextBandAdvice: 'Develop the example.' };
  const writing = {
    task1: { criteria: Object.fromEntries(['taskAchievement','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map(key => [key, criterion])), overviewStatus: 'clear_and_relevant' },
    task2: { criteria: Object.fromEntries(['taskResponse','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map(key => [key, criterion])) },
  };
  for (const [evaluate, payload, evaluation] of [
    [evaluateSpeakingWithAI, shortPayload, validEvaluation],
    [evaluateWritingWithAI, { task1Text: 'A relevant example of a change in transport. '.repeat(22), task2Text: 'A relevant example helps explain why transport matters to people. '.repeat(28), prompts: { task1: 'Describe the chart.', task2: 'Discuss transport.' } }, writing],
  ]) {
    const calls = setup({ gemini: 'success', groq: 'success', evaluation });
    assert.equal((await evaluate(payload)).providerUsed, 'gemini');
    setActiveAiProvider('groq');
    assert.equal((await evaluate(payload)).providerUsed, 'groq');
    setActiveAiProvider('gemini');
    assert.equal((await evaluate(payload)).isCached, true);
    assert.deepEqual(calls.map(call => call.provider), ['gemini','groq']);
  }
});

console.log(`\n${checks} direct provider failure checks passed.`);
