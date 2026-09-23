import React from 'react';
import { AlertCircle, ArrowLeft, Play, X } from 'lucide-react';

export default function ExitConfirmationModal({ isOpen, onCancel, onConfirm, sectionTitle = "Practice Session" }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay-animated" onClick={onCancel}>
      <div className="modal-content-animated" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(235, 87, 87, 0.12)',
            border: '1px solid rgba(235, 87, 87, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)',
            flexShrink: 0
          }}>
            <AlertCircle size={22} />
          </div>

          <div style={{ flex: 1 }}>
            <span className="badge badge-neutral" style={{ fontSize: 11, marginBottom: 6 }}>
              {sectionTitle}
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: 'var(--text-primary)' }}>
              Are you sure you want to stop the current progression?
            </h3>
          </div>

          <button className="btn btn-ghost" onClick={onCancel} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          background: 'var(--bg-card)',
          padding: '14px 16px',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--accent-amber)',
          marginBottom: 24
        }}>
          Any unsaved answers, essays, or speech recordings from this session will be discarded. 
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginTop: 4 }}>
            This attempt will NOT be calculated in your overall scorecard or analytics.
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ borderRadius: 'var(--radius-pill)', padding: '8px 18px' }}
          >
            <Play size={14} />
            <span>Continue Practice</span>
          </button>

          <button
            className="btn"
            onClick={onConfirm}
            style={{
              borderRadius: 'var(--radius-pill)',
              padding: '8px 20px',
              background: 'linear-gradient(135deg, #e03e3e, #b91c1c)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 13,
              border: 'none',
              boxShadow: '0 4px 14px rgba(224, 62, 62, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} color="#ffffff" />
            <span>Discard & Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
