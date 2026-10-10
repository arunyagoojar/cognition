import React, { useState } from 'react';
import Icon from '../common/Icon';
import { getRecheckableLastTest, recheckLastTest } from '../../utils/recheckLastTest';
import { getActiveAiProvider } from '../../utils/storage';
import { getPerformanceStore } from '../../utils/performanceStore';
import { syncAttempt } from '../../utils/api';

const SKILL_LABEL = { writing: 'Writing', speaking: 'Speaking' };

/**
 * Dashboard card to re-run the AI evaluation of the most recent test only
 * (Writing or Speaking) — e.g. after a provider outage, or with the other AI.
 */
export default function LastTestRecheck({ onRechecked, onOpenSettings }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, message }

  const target = getRecheckableLastTest();
  if (!target) return null;

  const { attempt, skill, record } = target;
  const band = typeof record.band === 'number' ? record.band : null;
  const graded = attempt.status === 'completed' && band !== null;
  const provider = getActiveAiProvider() === 'gemini' ? 'Gemini' : 'Groq';
  const when = attempt.completedAt ? new Date(attempt.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const handleRecheck = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await recheckLastTest();
      if (res.ok) {
        setStatus({ ok: true, message: `Rechecked — ${SKILL_LABEL[skill]} band ${Number(res.band).toFixed(1)}.` });
        const updated = (getPerformanceStore().attempts || [])[0];
        if (updated) {
          Promise.resolve(syncAttempt({ ...(updated[skill] || {}), id: updated.id, type: skill, testId: updated.testId, testLabel: updated.testLabel, status: updated.status, band: res.band })).catch(() => {});
        }
        onRechecked?.();
      } else {
        setStatus({ ok: false, message: res.message });
      }
    } catch (e) {
      setStatus({ ok: false, message: e?.message || 'Recheck failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="last-test-recheck" aria-label="Recheck your last test" style={{
      margin: '0 0 28px',
      background: graded ? 'var(--bg-card)' : 'rgba(255, 87, 52, 0.07)',
      border: '1.5px solid var(--border-strong, #151313)',
      borderRadius: 20,
      boxShadow: '0 3px 0 var(--border-strong, #151313)',
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 220, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Your last test
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
          {SKILL_LABEL[skill]} · {graded ? `Band ${band.toFixed(1)}` : 'Not graded yet'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {graded ? 'Want a second opinion? Re-grade it' : 'The AI examiner could not grade it. Retry'} with {provider}
          {onOpenSettings && (
            <> (<button type="button" onClick={onOpenSettings} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--c-coral, #FF5734)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>switch AI</button>)</>
          )}.
          {when && <span style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{when}</span>}
        </div>
        {status && (
          <div role="status" style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: status.ok ? 'var(--success-icon)' : 'var(--c-coral, #FF5734)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name={status.ok ? 'check' : 'alertCircle'} size={15} /> {status.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleRecheck}
        disabled={busy}
        style={{
          padding: '12px 22px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
          background: '#FCCC42', color: '#151313', border: '1.5px solid #151313', boxShadow: '0 3px 0 #151313',
          display: 'inline-flex', alignItems: 'center', gap: 8, opacity: busy ? 0.75 : 1,
        }}
      >
        {busy
          ? <><span className="eval-spinner" style={{ width: 15, height: 15, border: '2.5px solid #151313', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Rechecking…</>
          : <><Icon name="refresh" size={16} /> Recheck with AI</>}
      </button>
    </section>
  );
}
