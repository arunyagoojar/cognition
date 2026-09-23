import React from 'react';
import { Award, CheckCircle2, XCircle, RotateCcw, ArrowRight, X } from 'lucide-react';

export default function ScoreModal({
  isOpen,
  onClose,
  title = "Test Results",
  moduleName = "Listening",
  rawScore = 0,
  totalQuestions = 40,
  bandScore = 0.0,
  breakdown = [],
  onReview,
  onRetake
}) {
  if (!isOpen) return null;

  const percentage = Math.round((rawScore / totalQuestions) * 100);

  const getCEFR = (band) => {
    if (band >= 8.5) return 'C2 Mastery';
    if (band >= 7.0) return 'C1 Effective Operational Proficiency';
    if (band >= 5.5) return 'B2 Vantage';
    if (band >= 4.0) return 'B1 Threshold';
    return 'A2 / Waystage';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <span className="badge badge-blue" style={{ marginBottom: 6 }}>Official IELTS Scale</span>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(82, 156, 202, 0.12), rgba(144, 101, 176, 0.08))',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          textAlign: 'center',
          marginBottom: 24
        }}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Estimated {moduleName} Score
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1, color: 'var(--accent-blue)', lineHeight: 1.1 }}>
            Band {bandScore.toFixed(1)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
            {getCEFR(bandScore)}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 28,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Raw Score</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{rawScore} / {totalQuestions}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Accuracy</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{percentage}%</div>
            </div>
          </div>
        </div>

        {breakdown && breakdown.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
              Section Performance Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {breakdown.map((sec, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <span style={{ fontSize: 13.5 }}>{sec.name}</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {sec.score} / {sec.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {onRetake && (
            <button className="btn btn-secondary" onClick={onRetake}>
              <RotateCcw size={15} />
              <span>Retake Test</span>
            </button>
          )}
          {onReview && (
            <button className="btn btn-secondary" onClick={onReview}>
              <CheckCircle2 size={15} />
              <span>Review Answers</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Done & Exit to Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
