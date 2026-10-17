import { useEffect, useState } from 'react';
import { subscribeSync, getSyncStatus, flushSync } from '../../utils/syncQueue.js';
export default function SyncStatus() {
  const [state, setState] = useState(getSyncStatus);
  useEffect(() => subscribeSync(() => setState(getSyncStatus())), []);
  return <div className="sync-status" role="status" aria-live="polite">
    {state.storageError ? 'Device storage is full or unavailable · keep this page open and free space before retrying' : state.syncing ? 'Syncing…' : state.failed ? 'Saved locally · sync needs attention' : state.pending ? `Saved locally · ${state.pending} awaiting sync` : state.signedIn ? 'Synced' : 'Saved on this device'}
    {state.pending > 0 && <button type="button" onClick={() => void flushSync(true)}>Retry sync</button>}
  </div>;
}
