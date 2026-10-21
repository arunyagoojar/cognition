let owner = '';
const blocked = new Set();
export const getDraftScope = () => owner;
export function setDraftScope(userId) { const next=userId || ''; if(next!==owner) blocked.clear(); owner=next; }
function key(name) { return `cognition_draft_v2:${owner || 'guest'}:${name}`; }
export function readDraft(name) {
  try { const item = JSON.parse(localStorage.getItem(key(name)) || 'null'); return item?.version === 2 ? item.data : null; } catch { return null; }
}
export function writeDraft(name, data) {
  if ([...blocked].some(prefix=>name.startsWith(prefix))) return false;
  try { localStorage.setItem(key(name), JSON.stringify({ version: 2, savedAt: new Date().toISOString(), data })); return true; } catch { return false; }
}
export function removeDraft(name) { try { localStorage.removeItem(key(name)); } catch { /* storage unavailable */ } }

const SESSION_PREFIXES = {
 reading:['reading:','attempt:reading'], listening:['listening:','attempt:listening'],
 writing:['cognition_writing_active_session','attempt:writing'], speaking:['speaking:','attempt:speaking'],
 'spelling-bee':['spelling-bee'],
 'harper-writing':['harper'], drill:['active-drill','drill-session','speaking:drill:'],
 mock:['reading:','listening:','speaking:','cognition_writing_active_session'],
};
export const isPracticeScreen = view => Boolean(SESSION_PREFIXES[view]);
export function discardPracticeDrafts(view) {
 const prefixes=SESSION_PREFIXES[view] || [];
 for(const prefix of prefixes) blocked.add(prefix);
 try {
  const scope=key('');
  for(let i=localStorage.length-1;i>=0;i--) {
   const name=localStorage.key(i);
   if(name?.startsWith(scope) && prefixes.some(p=>name.slice(scope.length).startsWith(p))) localStorage.removeItem(name);
  }
  if(prefixes.includes('cognition_writing_active_session')) sessionStorage.removeItem('cognition_writing_active_session');
 } catch { /* unavailable storage */ }
}
export function beginPracticeSession(view) {
 discardPracticeDrafts(view);
 for(const prefix of SESSION_PREFIXES[view] || []) blocked.delete(prefix);
}

export function transitionPracticeSession(current, next, { finished = false, confirm } = {}) {
 if(current === next) return true;
 if(isPracticeScreen(current)) {
  if(!finished && !confirm?.('Leave this session? You will lose your current progress. Your next visit will start fresh.')) return false;
  discardPracticeDrafts(current);
 }
 if(isPracticeScreen(next)) beginPracticeSession(next);
 return true;
}
