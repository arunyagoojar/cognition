let owner = '';
export function setDraftScope(userId) { owner = userId || ''; }
function key(name) { return `cognition_draft_v2:${owner || 'guest'}:${name}`; }
export function readDraft(name) {
  try { const item = JSON.parse(localStorage.getItem(key(name)) || 'null'); return item?.version === 2 ? item.data : null; } catch { return null; }
}
export function writeDraft(name, data) {
  try { localStorage.setItem(key(name), JSON.stringify({ version: 2, savedAt: new Date().toISOString(), data })); return true; } catch { return false; }
}
export function removeDraft(name) { try { localStorage.removeItem(key(name)); } catch { /* storage unavailable */ } }
