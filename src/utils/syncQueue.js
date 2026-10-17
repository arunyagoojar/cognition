let account = '';
let sender;
let timer;
let flushing = false;
let storageError = false;
const listeners = new Set();
const key = () => `cognition_sync_outbox_v2:${account}`;
function read() { try { const rows=JSON.parse(localStorage.getItem(key()) || '[]'); return Array.isArray(rows) ? rows.filter(row=>row?.payload?.id && row.payload.data) : []; } catch { return []; } }
function write(rows) { localStorage.setItem(key(), JSON.stringify(rows)); emit(); }
function emit() { for (const fn of listeners) fn(); }
export function subscribeSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSyncStatus() {
  const rows = account ? read() : [];
  return { pending: rows.length, syncing: Boolean(account) && flushing, storageError, failed: storageError || rows.some(r => r.blocked), signedIn: Boolean(account) };
}
export function configureSync(userId, send) {
  if (account === (userId || '') && sender === send) return;
  account = userId || ''; sender = send; storageError=false;
  clearTimeout(timer);
  if (account) void flushSync();
  emit();
}
export async function queueAttempt(payload) {
  if (!account) return { local: true };
  const rows = read().filter(row => row.payload.id !== payload.id);
  try { write([...rows, { payload, tries: 0, next: 0, revision: crypto.randomUUID() }]); storageError=false; }
  catch { storageError=true; emit(); return { local: true, error: 'Could not save the sync queue on this device.' }; }
  void flushSync();
  return { queued: true };
}
export async function flushSync(force = false) {
  if (!account || !sender || flushing) return;
  const owner = account;
  flushing = true; emit(); clearTimeout(timer);
  try {
    for (const entry of read()) {
      if (owner !== account) break;
      if (!force && (entry.blocked || entry.next > Date.now())) continue;
      const result = await sender(entry.payload);
      if (owner !== account) break;
      // A newer edit may have replaced this entry while the request was in flight.
      const rows = read();
      const index = rows.findIndex(r => r.payload.id === entry.payload.id && r.revision === entry.revision);
      if (index < 0) continue;
      if (result.ok) rows.splice(index, 1);
      else {
        const tries = entry.tries + 1;
        rows[index] = { ...entry, tries, blocked: result.status >= 400 && result.status < 500 && ![401, 408, 409, 429].includes(result.status), next: Date.now() + Math.min(300000, 2000 * 2 ** Math.min(tries, 7)) };
      }
      write(rows);
      if (result.unauthenticated || result.status === 401) break;
    }
  } catch { /* durable queue remains for reconnect */ }
  finally {
    flushing = false; emit();
    if (account) {
      const due = read().filter(r => !r.blocked);
      if (due.length) { timer = setTimeout(() => void flushSync(), Math.max(1000, Math.min(...due.map(r => r.next)) - Date.now())); timer.unref?.(); }
    }
  }
}
if (typeof window !== 'undefined') window.addEventListener('online', () => void flushSync(true));
