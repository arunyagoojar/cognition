import assert from 'node:assert/strict';
import { countTokens, decode, encode } from 'gpt-tokenizer/encoding/o200k_harmony';
import { planRequestBudget, prepareRequestBudget } from '../src/utils/ai/requestBudget.js';
import {
  buildSpeakingUserPrompt,
  SPEAKING_SYSTEM_PROMPT_V2,
  SPEAKING_SYSTEM_PROMPT_COMPACT,
} from '../src/utils/ieltsRubric.js';
import { runEvaluationChain } from '../worker/src/ai.js';
import { evaluateSpeakingWithAI } from '../src/utils/geminiEvaluator.js';
import { saveLocalGeminiKey, saveLocalGroqKey, setActiveAiProvider } from '../src/utils/storage.js';

let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`✓ ${name}`);
}

const literalOptions = { disallowedSpecial: new Set() };
const bytes = value => Buffer.byteLength(value, 'utf8');
const keys = Array.from({ length: 19 }, (_, i) => i < 9 ? `0_${i}` : i === 9 ? '1_0' : `2_${i - 10}`);
const answer = 'Um I think that public transport is important because it connects people to work and education. You know, when I was growing up my family used the bus every day, and this helped us save money. We sometimes walked when the weather was pleasant. I prefer travelling with a friend because we can talk about what we see outside. Although buses can be crowded in the evening, reliable services make life easier for families in my town. In the future I would like the council to provide more frequent services and safer routes so that more people can travel together.';
const interview = {
  transcripts: Object.fromEntries(keys.map((key, i) => [key, `Answer number ${i + 1}. ${key === '1_0' ? `${answer} ${answer}` : answer}`])),
  testMeta: {
    title: 'A complete travel interview',
    cueCard: 'Describe a journey you remember. You should say where you went, who travelled with you, what happened, and explain why it was memorable.',
    questions: Object.fromEntries(keys.map((key, i) => [key, `Question ${i + 1}: How do transport choices affect daily life in your community, and what changes would you like to see in future?`])),
  },
  durations: Object.fromEntries(keys.map(key => [key, key === '1_0' ? 120 : 35])),
};
const interviewBefore = structuredClone(interview);
const interviewPrompt = buildSpeakingUserPrompt(interview);

function assertCompleteInterview(prompt) {
  for (const key of keys) {
    assert(prompt.includes(interview.transcripts[key]), `Missing the full original answer ${key}.`);
    assert(prompt.includes(interview.testMeta.questions[key]), `Missing the original question ${key}.`);
  }
  assert(prompt.includes(interview.testMeta.cueCard));
  assert.deepEqual(interview, interviewBefore);
}

function assertBounded(budget, cap = 7600) {
  assert.equal(budget.ok, true);
  assert(budget.inputTokens + budget.outputTokens <= cap);
  assert(budget.outputTokens >= 2000);
}

await check('complete 19-question interviews fit Groq without omitting questions or speech', async () => {
  const wordCount = Object.values(interview.transcripts).join(' ').split(/\s+/).length;
  assert(wordCount >= 2000 && wordCount <= 2200);
  assertCompleteInterview(interviewPrompt);
  // The former byte estimate rejected this ordinary interview before calling AI.
  assert.equal(planRequestBudget('groq', SPEAKING_SYSTEM_PROMPT_COMPACT, interviewPrompt).ok, false);
  const budget = await prepareRequestBudget('groq', SPEAKING_SYSTEM_PROMPT_COMPACT, interviewPrompt, { model: 'openai/gpt-oss-120b' });
  assertBounded(budget);
  assert.equal(budget.tokenCountSource, 'o200k_harmony');
  assert.equal(budget.inputTokens, countTokens(SPEAKING_SYSTEM_PROMPT_COMPACT, literalOptions) + countTokens(interviewPrompt, literalOptions) + 128);
  assertCompleteInterview(interviewPrompt);
});

await check('both supported GPT-OSS models count text locally and retain framing headroom', async () => {
  for (const model of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
    const budget = await prepareRequestBudget('groq', 'Assess this answer.', 'I enjoy taking the train.', { model });
    assertBounded(budget);
    assert.equal(budget.inputTokens, countTokens('Assess this answer.', literalOptions) + countTokens('I enjoy taking the train.', literalOptions) + 128);
  }
  const boundary = planRequestBudget('groq', '', '', { textTokenCount: 5472 });
  assertBounded(boundary);
  assert.equal(boundary.outputTokens, 2000);
  assert.equal(planRequestBudget('groq', '', '', { textTokenCount: 5473 }).ok, false);
});

await check('UTF-8 and multilingual candidate text use the tokenizer without changing wording', async () => {
  const system = 'Assess the language used by the candidate.';
  const prompt = 'Café naïve — 日本語の例です。 मैं अपने परिवार के साथ रहता हूँ। العربية مفيدة. 😀🚆';
  const budget = await prepareRequestBudget('groq', system, prompt, { model: 'openai/gpt-oss-120b' });
  assertBounded(budget);
  assert.equal(budget.inputTokens, countTokens(system, literalOptions) + countTokens(prompt, literalOptions) + 128);
  assert.equal(decode(encode(prompt, literalOptions)), prompt);
  assert.equal(budget.tokenCountSource, 'o200k_harmony');
  // This identifies the text tokenizer, not a claim that the server's chat
  // template or the remaining shared rate quota has been measured exactly.
  assert(bytes(prompt) > prompt.length);
});

await check('literal model-marker-looking text cannot crash token preparation', async () => {
  const prompt = 'I saw the symbols <|endoftext|>, <|start|> and <|im_end|> in a document.';
  const budget = await prepareRequestBudget('groq', 'Assess the quoted answer.', prompt, { model: 'openai/gpt-oss-120b' });
  assertBounded(budget);
  assert.equal(budget.tokenCountSource, 'o200k_harmony');
  assert.equal(budget.inputTokens, countTokens('Assess the quoted answer.', literalOptions) + countTokens(prompt, literalOptions) + 128);
  assert.equal(decode(encode(prompt, literalOptions)), prompt);
});

await check('oversized requests remain blocked and media allowances cannot disappear', async () => {
  const prompt = 'An extended spoken answer. '.repeat(3000);
  const before = prompt;
  const oversized = await prepareRequestBudget('groq', SPEAKING_SYSTEM_PROMPT_COMPACT, prompt, { model: 'openai/gpt-oss-120b' });
  assert.equal(oversized.ok, false);
  assert.match(oversized.message, /not been truncated/);
  assert.equal(prompt, before);
  assert.equal(planRequestBudget('gemini', SPEAKING_SYSTEM_PROMPT_V2, 'x'.repeat(100000)).ok, false);
  const plain = await prepareRequestBudget('groq', 'Assess.', 'The bus is useful.', { model: 'openai/gpt-oss-120b' });
  const media = await prepareRequestBudget('groq', 'Assess.', 'The bus is useful.', { model: 'openai/gpt-oss-120b', mediaTokens: 2048 });
  assertBounded(media);
  assert.equal(media.inputTokens - plain.inputTokens, 2048);
  assert.equal((await prepareRequestBudget('groq', 'Assess.', 'The bus is useful.', { model: 'openai/gpt-oss-120b', mediaTokens: 7600 })).ok, false);
});

await check('coaching keeps its byte upper bound and providers do not borrow another tokenizer', async () => {
  const system = 'SINGLE_TASK_COACH: Evaluate this writing task.';
  const prompt = 'The café provides a quiet place to study.';
  for (const provider of ['groq', 'gemini']) {
    const options = { model: 'openai/gpt-oss-120b', coaching: true };
    const budget = await prepareRequestBudget(provider, system, prompt, options);
    assert.equal(budget.inputTokens, bytes(system) + bytes(prompt) + 128);
    assert.equal(budget.outputTokens, 2000);
    assert.deepEqual(budget, planRequestBudget(provider, system, prompt, options));
  }
  assert.equal((await prepareRequestBudget('groq', system, 'x'.repeat(8000), { coaching: true, model: 'openai/gpt-oss-120b' })).ok, false);
  const gemini = await prepareRequestBudget('gemini', SPEAKING_SYSTEM_PROMPT_V2, interviewPrompt, { model: 'gemini-3.8-flash' });
  assertBounded(gemini, 30000);
  assert.deepEqual(gemini, planRequestBudget('gemini', SPEAKING_SYSTEM_PROMPT_V2, interviewPrompt));
  const otherGroq = await prepareRequestBudget('groq', system, prompt, { model: 'qwen/qwen3.6-27b' });
  assert.deepEqual(otherGroq, planRequestBudget('groq', system, prompt));
});

await check('Worker sends all 19 answers and questions through each provider within its reply budget', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const provider of ['groq', 'gemini']) {
      const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.8-flash';
      const requests = [];
      globalThis.fetch = async (url, options) => {
        const endpoint = String(url);
        if (endpoint === 'https://api.groq.com/openai/v1/models') {
          assert.equal(provider, 'groq');
          return Response.json({ data: [{ id: model, active: true }] });
        }
        if (endpoint === 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200') {
          assert.equal(provider, 'gemini');
          return Response.json({ models: [{ name: `models/${model}`, supportedGenerationMethods: ['generateContent'] }] });
        }
        assert.equal(endpoint, provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
        requests.push(JSON.parse(options.body));
        return Response.json(provider === 'groq'
          ? { choices: [{ message: { content: '{"valid":true}' } }] }
          : { candidates: [{ content: { parts: [{ text: '{"valid":true}' }] } }] });
      };
      const result = await runEvaluationChain({
        apiKey: `fixture-budget-${provider}`,
        provider,
        systemPrompt: SPEAKING_SYSTEM_PROMPT_V2,
        userPrompt: interviewPrompt,
        validator: parsed => parsed?.valid === true ? parsed : null,
      });
      assert.equal(result.status, 'completed');
      assert.equal(result.provider, provider);
      assert.equal(requests.length, 1, 'The first valid full interview request should pass without retries.');
      const request = requests[0];
      const sentPrompt = provider === 'groq' ? request.messages[1].content : request.contents[0].parts[0].text;
      const sentSystem = provider === 'groq' ? request.messages[0].content : request.system_instruction.parts[0].text;
      assertCompleteInterview(sentPrompt);
      assert.equal(sentPrompt, interviewPrompt);
      assert.equal(sentSystem, provider === 'groq' ? SPEAKING_SYSTEM_PROMPT_COMPACT : SPEAKING_SYSTEM_PROMPT_V2);
      const budget = await prepareRequestBudget(provider, sentSystem, sentPrompt, { model });
      const requestedOutput = provider === 'groq' ? request.max_completion_tokens : request.generationConfig.maxOutputTokens;
      assert.equal(requestedOutput, budget.outputTokens);
      assertBounded(budget, provider === 'groq' ? 7600 : 30000);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check('direct browser evaluation validates a complete interview with either selected provider', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  const evaluation = {
    criteria: Object.fromEntries(['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map(key => [key, {
      band: 6,
      personalizedAssessment: 'The candidate explains transport choices with clear supporting examples. Develop comparisons more precisely.',
      corrections: [],
      nextBandAdvice: 'Explain one contrast between present and future transport choices.',
    }])),
    overallSummary: 'The interview addresses the travel questions with relevant personal examples. Develop comparisons with more precise language.',
    priorityWeaknesses: ['Develop more precise comparisons.'],
    partFeedback: { part1: 'Relevant personal responses.', part2: 'The journey has a clear sequence.', part3: 'Develop the explanation of future changes.' },
    strengths: 'Relevant examples of travelling with family.',
    areasForImprovement: 'Use more precise comparisons.',
    confidence: 'high',
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    get length() { return storage.size; },
    key: i => [...storage.keys()][i] ?? null,
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  } });
  try {
    for (const provider of ['gemini', 'groq']) {
      storage.clear();
      saveLocalGeminiKey('fixture-direct-budget-gemini');
      saveLocalGroqKey('fixture-direct-budget-groq');
      setActiveAiProvider(provider);
      const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.8-flash';
      const requests = [];
      globalThis.fetch = async (url, options) => {
        const endpoint = String(url);
        if (endpoint === 'https://api.groq.com/openai/v1/models') {
          assert.equal(provider, 'groq');
          return Response.json({ data: [{ id: model, active: true }] });
        }
        if (endpoint === 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200') {
          assert.equal(provider, 'gemini');
          return Response.json({ models: [{ name: `models/${model}`, supportedGenerationMethods: ['generateContent'] }] });
        }
        assert.equal(endpoint, provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
        requests.push(JSON.parse(options.body));
        return Response.json(provider === 'groq'
          ? { choices: [{ message: { content: JSON.stringify(evaluation) } }] }
          : { candidates: [{ content: { parts: [{ text: JSON.stringify(evaluation) }] } }] });
      };
      const result = await evaluateSpeakingWithAI(interview);
      assert.equal(result.evaluationStatus, 'completed');
      assert.equal(result.providerUsed, provider);
      assert.equal(result.evaluationTier, 'client_local_key');
      assert.equal(result.overallBand, 6);
      assert.equal(result.criteria.fluencyAndCoherence.band, 6);
      assert.equal(result.criteria.pronunciation.status, 'not_assessed');
      assert.equal(result.isCached, undefined, 'Both provider paths must actually run instead of reusing the first result.');
      assert.equal(requests.length, 1);
      const request = requests[0];
      const sentPrompt = provider === 'groq' ? request.messages[1].content : request.contents[0].parts[0].text;
      const sentSystem = provider === 'groq' ? request.messages[0].content : request.system_instruction.parts[0].text;
      assertCompleteInterview(sentPrompt);
      assert.equal(sentPrompt, interviewPrompt);
      assert.equal(sentSystem, provider === 'groq' ? SPEAKING_SYSTEM_PROMPT_COMPACT : SPEAKING_SYSTEM_PROMPT_V2);
      const budget = await prepareRequestBudget(provider, sentSystem, sentPrompt, { model });
      const requestedOutput = provider === 'groq' ? request.max_completion_tokens : request.generationConfig.maxOutputTokens;
      assert.equal(requestedOutput, budget.outputTokens);
      assertBounded(budget, provider === 'groq' ? 7600 : 30000);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', originalStorage);
  }
});

console.log(`\n${checks} AI request budget checks passed.`);
