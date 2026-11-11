// A provider cut-off is a failed assessment, even if the JSON happens to parse.
export function isTruncatedResponse(provider, data) {
  return provider === 'groq'
    ? data?.choices?.[0]?.finish_reason === 'length'
    : data?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
}
