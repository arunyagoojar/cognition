// Never change the submitted content or invent a score to make fallback work.
export async function withProviderFallback(primaryProvider, evaluate, available) {
  const first = await evaluate(primaryProvider);
  if (first?.status === 'completed') return first;
  const secondary = primaryProvider === 'gemini' ? 'groq' : 'gemini';
  if (!await available(secondary)) return first;
  const fallback = await evaluate(secondary);
  if (fallback?.status === 'completed') return { ...fallback, fallbackFrom: primaryProvider };
  return { ...first, provider: primaryProvider, providerFailures: [
    { provider: primaryProvider, reason: first?.reason || 'evaluation_failed' },
    { provider: secondary, reason: fallback?.reason || 'evaluation_failed' },
  ], message: [first?.message, `${secondary === 'groq' ? 'Groq' : 'Gemini'} fallback: ${fallback?.message || 'Evaluation could not be completed.'}`].filter(Boolean).join(' ') };
}
