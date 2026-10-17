export function chooseFreshTest(skill, pool, storage = globalThis.localStorage, random = Math.random) {
  const key = `cognition_recent_${skill}_v2`;
  const idFor = item => String(item.testId ?? item.id);
  let recent = [];
  try { recent = JSON.parse(storage?.getItem(key) || '[]'); if (!Array.isArray(recent)) recent = []; } catch { /* unavailable */ }
  const fresh = pool.filter(item => !recent.includes(idFor(item)));
  const choices = fresh.length ? fresh : pool;
  if (!choices.length) return null;
  const pick = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  const id = idFor(pick);
  try { storage?.setItem(key, JSON.stringify([id, ...recent.filter(value => value !== id)].slice(0, Math.min(8, Math.max(0, pool.length - 1))))); } catch { /* optional history */ }
  return id;
}
