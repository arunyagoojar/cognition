import React from 'react';
import Icon from '../common/Icon';
import { deriveWeaknesses } from '../../utils/insights.js';
import { derivePerformanceSummary } from '../../utils/performanceStore.js';
import FocusAreas from './FocusAreas.jsx';
import ProgressTimeline from './ProgressTimeline.jsx';

/**
 * Dashboard intelligence (Phase 6): current performance vs target, the
 * target-band journey, deterministic focus areas with real content links,
 * and the progress timeline. Renders inside the existing dashboard —
 * no AI calls, no fabricated scores.
 */
export default function DashboardInsights({ targetBand, onOpenLesson, onOpenTips, onStartPractice }) {
  const derived = derivePerformanceSummary();
  const target = parseFloat(targetBand) || null;
  const current = derived.overallBand !== null ? parseFloat(derived.overallBand) : null;

  const { focusAreas, sufficientData } = deriveWeaknesses(storeAttempts(), targetBand);
  const gap = current !== null && target ? Math.round((target - current) * 10) / 10 : null;

  const latest = derived.latestScores || {};
  const skillRows = ['listening', 'reading', 'writing', 'speaking'].map(s => ({
    id: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
    band: latest[s]?.band ?? null,
  }));
  const hasAnySkill = skillRows.some(r => r.band !== null);

  // Next action: first focus area's strongest recommendation, else practice prompt
  const nextAction = focusAreas[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current performance + target journey */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: '16px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Current performance
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: 'var(--font-family)' }}>
              {current !== null ? current.toFixed(1) : '--'}
            </div>
          </div>
          {target && current !== null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>{current.toFixed(1)}</span>
              <Icon name="zap" size={12} style={{ color: 'var(--c-coral)' }} />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--c-coral)' }}>{target.toFixed(1)}</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>
          {current === null
            ? 'Complete a test to see your estimated overall band here.'
            : gap === null || gap <= 0
              ? 'You are at or above your target band. Keep practising to hold your level.'
              : `You're ${gap} band${Math.abs(gap) === 1 ? '' : 's'} away from your ${target.toFixed(1)} target.`}
        </div>

        {hasAnySkill && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 12 }}>
            {skillRows.map(r => (
              <div key={r.id} style={{ padding: '8px 12px', background: 'var(--surface-interactive)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {r.band !== null ? r.band.toFixed(1) : '--'}
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}> / 9.0</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Focus areas + next steps */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
          <Icon name="target" size={14} style={{ color: 'var(--c-coral)' }} />
          {sufficientData ? 'Focus areas' : 'Focus areas'}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {sufficientData ? 'based on your recent attempts' : 'more attempts needed for reliable analysis'}
          </span>
        </div>
        {focusAreas.length > 0 ? (
          <FocusAreas
            focusAreas={focusAreas}
            onOpenLesson={onOpenLesson}
            onOpenTips={onOpenTips}
            onStartPractice={onStartPractice}
          />
        ) : (
          <div style={{
            padding: '16px', fontSize: 13, color: 'var(--text-secondary)',
            background: 'var(--surface-interactive)', borderRadius: 12, border: '1px solid var(--border-subtle)',
          }}>
            {sufficientData
              ? 'Recent attempts show balanced performance across skills — keep practising to surface finer focus areas.'
              : 'Complete a couple more tests — this section highlights exactly what to work on once there is enough evidence.'}
          </div>
        )}
      </div>

      {/* Progress timeline */}
      <ProgressTimeline skillHistory={derived.skillHistory} completedCount={derived.completedCount} />
    </div>
  );
}

// Attempts come straight from the canonical performance store.
import { getPerformanceStore } from '../../utils/performanceStore.js';
function storeAttempts() {
  return getPerformanceStore().attempts || [];
}
