// Lightweight catalog is available at startup; question banks load at skill entry.
import catalog from './catalog.json' with { type: 'json' };
export const CONTENT_CATALOG = catalog;
export let PRODUCTION_LISTENING = [];
export let PRODUCTION_READING = [];
export let PRODUCTION_WRITING = [];
export let PRODUCTION_SPEAKING = [];
const loaders = {
  listening: () => import('./banks/listening.json', { with: { type: 'json' } }),
  reading: () => import('./banks/reading.json', { with: { type: 'json' } }),
  writing: () => import('./banks/writing.json', { with: { type: 'json' } }),
  speaking: () => import('./banks/speaking.json', { with: { type: 'json' } }),
};
const pending = new Map();
export function loadSkillContent(skill) {
  if (!loaders[skill]) return Promise.reject(new Error('Unknown practice skill'));
  if (!pending.has(skill)) {
    const job = loaders[skill]().then(({ default: records }) => {
      if (skill === 'listening') PRODUCTION_LISTENING = records;
      if (skill === 'reading') PRODUCTION_READING = records;
      if (skill === 'writing') PRODUCTION_WRITING = records;
      if (skill === 'speaking') PRODUCTION_SPEAKING = records;
      return records;
    }).catch(error => { pending.delete(skill); throw error; });
    pending.set(skill, job);
  }
  return pending.get(skill);
}
export const loadAllContent = () => Promise.all(Object.keys(loaders).map(loadSkillContent));
// Deterministic Node validators continue to see complete synchronous datasets.
if (typeof window === 'undefined') await loadAllContent();
