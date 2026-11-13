import readingIdentities from './readingIdentities.json' with { type: 'json' };
import { getAuditedListeningIdentity } from './listeningAvailability.js';

// Source matches from the provenance audits, not a claim that every key is verified.
export function isPreferredPracticeTest(skill, record) {
  const baseSkill = skill.replace(/-drill$/, '');
  if (baseSkill === 'listening') return Boolean(getAuditedListeningIdentity(record));
  if (baseSkill !== 'reading') return false;
  const identity = readingIdentities[String(record?.testId)];
  return Boolean(identity && (!record?.source?.sha256 || identity.sha256 === record.source.sha256));
}

// Apply source preference before repeat avoidance. A recent Cambridge test still
// takes priority over other retained material. Callers supply an eligible pool.
export function getPreferredPracticePool(skill, pool) {
  const preferred = pool.filter(record => isPreferredPracticeTest(skill, record));
  return preferred.length ? preferred : pool;
}
