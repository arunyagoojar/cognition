import identities from './listeningIdentities.json' with { type: 'json' };

// Reversible policy from the 13 November 2026 four-section source audit.
// Excluded records stay in the content archive for historical review.
export function getAuditedListeningIdentity(record) {
  const identity = identities[String(record?.testId)];
  if (!identity || (record?.source?.sha256 && record.source.sha256 !== identity.sha256)) return null;
  return identity;
}
export const isListeningTestEnabled = record => Boolean(getAuditedListeningIdentity(record));
