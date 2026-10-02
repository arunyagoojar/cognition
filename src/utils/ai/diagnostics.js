/**
 * Sanitized AI diagnostic logger (development only). Never logs keys,
 * credentials, or raw audio — only attempt metadata.
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
    console.info('[AI_DIAGNOSTIC]', JSON.stringify(sanitized));
  }
}
