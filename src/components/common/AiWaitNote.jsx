import React from 'react';

/**
 * Shown on processing screens while the AI examiner is still working, so a
 * long assessment never looks frozen. Appears after a short delay; says so
 * plainly if it takes longer than usual.
 */
export default function AiWaitNote({ what = 'your answers' }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (elapsed < 3) return null;
  return (
    <div className="ai-wait-note" role="status" aria-live="polite">
      <span className="ai-wait-dot" aria-hidden="true" />
      <span>
        {elapsed < 45
          ? <>The AI examiner is still assessing {what}. This usually takes 10–30 seconds.</>
          : <>Taking a little longer than usual. Still working, please keep this page open.</>}
      </span>
    </div>
  );
}
