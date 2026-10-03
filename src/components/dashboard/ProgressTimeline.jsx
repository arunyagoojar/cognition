import React, { useState } from 'react';

/**
 * Progress timeline (Phase 6) — clean SVG line chart over completed attempts.
 * Overall + per-skill toggle. Honest empty state when data is thin.
 */
export default function ProgressTimeline({ skillHistory, completedCount }) {
  const skills = ['overall', 'listening', 'reading', 'writing', 'speaking'];
  const [selected, setSelected] = useState('overall');

  const series = React.useMemo(() => {
    if (selected === 'overall') {
      // overall = mean of the skills recorded on each attempt (chronological)
      const byAttempt = {};
      for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
        for (const point of skillHistory[skill] || []) {
          byAttempt[point.completedAt] = byAttempt[point.completedAt] || { bands: [], at: point.completedAt };
          byAttempt[point.completedAt].bands.push(point.band);
        }
      }
      return Object.values(byAttempt)
        .map(({ bands, at }) => ({ at, band: bands.reduce((s, b) => s + b, 0) / bands.length }))
        .sort((a, b) => a.at.localeCompare(b.at));
    }
    return [...(skillHistory[selected] || [])]
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
      .map(p => ({ at: p.completedAt, band: p.band }));
  }, [skillHistory, selected]);

  const hasData = series.length >= 2;
  const W = 560, H = 180, PAD = { l: 34, r: 12, t: 14, b: 26 };
  const yMin = 3.5, yMax = 9;
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, series.length - 1);
  const y = (band) => PAD.t + (1 - (band - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = hasData ? series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.band).toFixed(1)}`).join(' ') : '';
  const areaPath = hasData ? `${path} L${x(series.length - 1).toFixed(1)},${y(yMin)} L${x(0).toFixed(1)},${y(yMin)} Z` : '';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Progress timeline</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {skills.map(s => (
            <button key={s} type="button" onClick={() => setSelected(s)}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                borderRadius: 999, border: '1px solid ' + (selected === s ? 'var(--c-coral)' : 'var(--border-subtle)'),
                background: selected === s ? 'var(--c-peach)' : 'transparent',
                color: selected === s ? 'var(--c-coral)' : 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}>
              {s === 'overall' ? 'Overall' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{
          padding: '26px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)',
          background: 'var(--surface-interactive)', borderRadius: 12,
        }}>
          {completedCount === 0
            ? 'Complete a test to start your progress timeline.'
            : 'Complete a few more tests to see your progress here.'}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${selected} band trend`}>
          {[4, 5, 6, 7, 8, 9].map(band => (
            <g key={band}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(band)} y2={y(band)} stroke="var(--border-subtle)" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(band) + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">{band}</text>
            </g>
          ))}
          <defs>
            <linearGradient id={`ptg-${selected}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-coral)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--c-coral)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#ptg-${selected})`} />
          <path d={path} fill="none" stroke="var(--c-coral)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {series.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.band)} r="3.2" fill="var(--bg-card)" stroke="var(--c-coral)" strokeWidth="2" />
          ))}
          <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--text-secondary)">first attempt</text>
          <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="var(--text-secondary)">latest</text>
        </svg>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
        {series.length} completed {series.length === 1 ? 'attempt' : 'attempts'} · latest band {series[series.length - 1]?.band?.toFixed(1)}
      </div>
    </div>
  );
}
