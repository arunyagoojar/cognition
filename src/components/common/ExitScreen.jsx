import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, RotateCcw, CheckCircle2 } from 'lucide-react';

export default function ExitScreen({
  sectionTitle = "Practice Session",
  onReturnToDashboard,
  onReturnHome,
  onRestart
}) {
  const handleReturn = onReturnToDashboard || onReturnHome;
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (handleReturn) handleReturn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleReturn]);

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      padding: '24px 16px'
    }}>
      <div className="card" style={{
        maxWidth: 580,
        width: '100%',
        padding: '36px 32px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #1d1d1f 0%, #151516 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated ambient backdrop halo */}
        <div style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 220,
          height: 140,
          background: 'radial-gradient(ellipse at center, rgba(35, 131, 226, 0.15), transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Shield Icon */}
        <div style={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'rgba(35, 131, 226, 0.12)',
          border: '1px solid rgba(35, 131, 226, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: 'var(--accent-blue)',
          boxShadow: '0 0 24px rgba(35, 131, 226, 0.2)'
        }}>
          <ShieldCheck size={36} />
        </div>

        <span className="badge badge-neutral" style={{ fontSize: 11, letterSpacing: 0.5, marginBottom: 12 }}>
          {sectionTitle} Terminated
        </span>

        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text-primary)', marginBottom: 8 }}>
          Progression Stopped & Discarded
        </h2>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px auto' }}>
          Your attempt has been discarded safely. In accordance with strict examination integrity, unsubmitted sessions are never counted toward your IELTS band scorecard or skill history.
        </p>

        {/* Status Reassurance Card */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 28,
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="var(--accent-green)" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scorecard Impact</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>None (Preserved)</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RotateCcw size={18} color="var(--accent-blue)" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Question Rotation</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>Restored to Pool</div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={handleReturn}
            style={{
              justifyContent: 'center',
              padding: '12px 24px',
              fontSize: 14,
              borderRadius: 'var(--radius-pill)',
              width: '100%'
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard {secondsRemaining > 0 ? `(${secondsRemaining}s)` : ''}</span>
          </button>

          {onRestart && (
            <button
              className="btn btn-ghost"
              onClick={onRestart}
              style={{
                justifyContent: 'center',
                padding: '10px 20px',
                fontSize: 13,
                borderRadius: 'var(--radius-pill)',
                width: '100%',
                color: 'var(--text-secondary)'
              }}
            >
              <RotateCcw size={14} />
              <span>Start Fresh Practice Attempt</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
