// Shared by the browser and Worker. Keep result data, exclude secrets and raw media.
const PRIVATE_FIELDS = /^(?:key|apiKey|geminiKey|groqKey|token|authorization|encrypted_value|iv|blob|audio|audioData|url)$/i;
export function cleanResult(value, depth = 0) {
  if (depth > 18 || value === undefined || typeof value === 'function') return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(v => cleanResult(v, depth + 1));
  if (typeof value !== 'object' || (typeof Blob !== 'undefined' && value instanceof Blob)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_FIELDS.test(key)).map(([key, v]) => [key, cleanResult(v, depth + 1)]).filter(([, v]) => v !== undefined));
}
export function serializeAttempt(attempt) {
  const result = cleanResult(attempt);
  return {
    id: attempt.id, type: attempt.type, test_id: attempt.testId, test_label: attempt.testLabel || '',
    status: attempt.status || 'completed', band: attempt.band ?? attempt.overallBand ?? null,
    started_at: attempt.startedAt, completed_at: attempt.completedAt,
    data: { ...result, schemaVersion: 2, clientUpdatedAt: attempt.updatedAt || new Date().toISOString() },
  };
}
export function mergeAttemptData(previous, incoming) {
  if (!previous || typeof previous !== 'object') return incoming || {};
  if (!incoming || typeof incoming !== 'object') return previous;
  if (previous.clientUpdatedAt && incoming.clientUpdatedAt && previous.clientUpdatedAt > incoming.clientUpdatedAt) return previous;
  const result = { ...previous };
  for (const [key, value] of Object.entries(incoming)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeAttemptData(previous[key], value) : value;
  }
  return result;
}
