import React from 'react';

/**
 * Shown on processing screens with a round refreshing circle spinner and brief status text.
 */
export default function AiWaitNote() {
  return (
    <div
      className="ai-wait-note"
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)'
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '2px solid var(--border-subtle)',
          borderTopColor: 'var(--coral)',
          display: 'inline-block',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0
        }}
        aria-hidden="true"
      />
      <span>giving the final answers to AI to get a final report.</span>
    </div>
  );
}
