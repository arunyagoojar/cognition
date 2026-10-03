import React from 'react';
import { subscribeLocalStt, needsLocalStt, MODEL_DOWNLOAD_MB } from '../../utils/speech/localStt';

/**
 * Status of the on-device speech model. `variant="card"` explains the one-time
 * download before the first session; `variant="pill"` is the compact in-exam
 * indicator. Renders nothing in browsers that use native recognition (Safari).
 */
export default function SpeechModelStatus({ variant = 'pill' }) {
  const [s, setS] = React.useState(null);
  React.useEffect(() => (needsLocalStt() ? subscribeLocalStt(setS) : undefined), []);
  if (!s || !needsLocalStt()) return null;
  const pct = Math.round((s.progress || 0) * 100);

  if (variant === 'card') {
    if (s.status === 'ready') {
      return (
        <div className="stt-card is-ready" role="status">
          <span className="stt-dot" aria-hidden="true" />
          <div><strong>Speech recognition is ready.</strong> Your answers are transcribed privately on this device.</div>
        </div>
      );
    }
    if (s.status === 'error') {
      return (
        <div className="stt-card is-error" role="status">
          <div><strong>The speech model could not be prepared.</strong> Check your connection and reopen Speaking. Your recordings are still saved.</div>
        </div>
      );
    }
    return (
      <div className="stt-card" role="status" aria-live="polite">
        <div>
          <strong>{s.cached ? 'Loading speech recognition…' : 'Preparing speech recognition (one-time)'}</strong>
          <p>
            {s.cached
              ? 'Loading the speech model from this browser.'
              : `Downloading a ${MODEL_DOWNLOAD_MB} MB speech model once. It stays in this browser, so next time it loads in seconds. Your voice never leaves your device for transcription.`}
          </p>
          <div className="stt-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <span className="stt-pct">{pct}%</span>
        </div>
      </div>
    );
  }

  const label = s.status === 'ready' ? 'Speech recognition ready'
    : s.status === 'error' ? 'Speech model unavailable'
      : s.cached ? `Loading speech model · ${pct}%` : `Downloading speech model · ${pct}%`;
  return (
    <span className={`stt-pill is-${s.status}`} role="status" aria-live="polite" title="Transcription runs on this device">
      <span className="stt-dot" aria-hidden="true" />{label}
    </span>
  );
}
