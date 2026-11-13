import { getPreferredPracticePool } from '../data/production/practicePriority.js';

export function chooseFreshTest(skill, pool, storage = globalThis.localStorage, random = Math.random) {
  const candidates = getPreferredPracticePool(skill, pool);
  const key = `cognition_recent_${skill}_v2`;
  const idFor = item => String(item.testId ?? item.id);
  let recent = [];
  try { recent = JSON.parse(storage?.getItem(key) || '[]'); if (!Array.isArray(recent)) recent = []; } catch { /* unavailable */ }
  const fresh = candidates.filter(item => !recent.includes(idFor(item)));
  const choices = fresh.length ? fresh : candidates;
  if (!choices.length) return null;
  const pick = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  const id = idFor(pick);
  try { storage?.setItem(key, JSON.stringify([id, ...recent.filter(value => value !== id)].slice(0, Math.min(8, Math.max(0, candidates.length - 1))))); } catch { /* optional history */ }
  return id;
}
