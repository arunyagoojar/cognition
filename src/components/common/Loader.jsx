import React from 'react';

// ─── Branded loader ──────────────────────────────────────────────────────────
// Used for the initial app load and any long-running phase transition.
// `delay` hides the loader entirely for quick operations (no flashing).

export default function Loader({ label = 'Loading', size = 'medium', delay = 0 }) {
  const [visible, setVisible] = React.useState(delay <= 0);

  React.useEffect(() => {
    if (delay <= 0) return undefined;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      className={`cognition-loader cognition-loader-${size}`}
      role="status"
      aria-live="polite"
    >
      <span className="cognition-loader-ring" aria-hidden="true">
        <img src="/favicon.svg" alt="" className="cognition-loader-mark" />
      </span>
      <span className="cognition-loader-label">
        {label}
        <span className="cognition-loader-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </span>
    </div>
  );
}
