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
      // Gather all historical events across all skills chronologically
      const allEvents = [];
      for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
        for (const point of skillHistory[skill] || []) {
          allEvents.push({
            skill,
            band: point.band,
            at: point.completedAt || '',
            attemptId: point.attemptId,
          });
        }
      }

      allEvents.sort((a, b) => (a.at || '').localeCompare(b.at || ''));

      // Calculate rolling overall standing profile over history
      const standing = {
        listening: null,
        reading: null,
        writing: null,
        speaking: null,
      };

      const timeline = [];
      for (const ev of allEvents) {
        standing[ev.skill] = ev.band;
        const activeBands = Object.values(standing).filter(
          b => typeof b === 'number' && !isNaN(b)
        );
        if (activeBands.length === 0) continue;

        // IELTS official overall band calculation (.25 -> .5, .75 -> next whole)
        const avg = activeBands.reduce((s, b) => s + b, 0) / activeBands.length;
        const decimal = avg - Math.floor(avg);
        let rounded = Math.floor(avg);
        if (decimal < 0.25) {
          // rounds down
        } else if (decimal < 0.75) {
          rounded += 0.5;
        } else {
          rounded += 1.0;
        }

        timeline.push({
          at: ev.at,
          band: rounded,
          rawAvg: avg,
          skill: ev.skill,
        });
      }

      // If multiple skills were saved in the exact same attempt / timestamp (e.g. Full Mock),
      // collapse to the final standing state at that timestamp so points don't overlap
      const collapsed = [];
      for (const pt of timeline) {
        if (collapsed.length > 0 && collapsed[collapsed.length - 1].at === pt.at) {
          collapsed[collapsed.length - 1] = pt;
        } else {
          collapsed.push(pt);
        }
      }

      return collapsed;
    }

    return [...(skillHistory[selected] || [])]
      .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))
      .map(p => ({ at: p.completedAt, band: p.band, skill: selected }));
  }, [skillHistory, selected]);

  const hasData = series.length >= 1;
  const isSingle = series.length === 1;
  const W = 560, H = 190, PAD = { l: 34, r: 16, t: 16, b: 30 };
  const yMin = 0, yMax = 9;
  const clamp = (val) => Math.max(yMin, Math.min(yMax, typeof val === 'number' && !isNaN(val) ? val : 0));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, series.length - 1);
  const y = (band) => PAD.t + (1 - (clamp(band) - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const baselineY = y(yMin);

  const singleY = isSingle && series[0] ? y(series[0].band) : 0;
  const path = !hasData
    ? ''
    : isSingle
      ? `M${PAD.l},${singleY.toFixed(1)} L${(W - PAD.r).toFixed(1)},${singleY.toFixed(1)}`
      : series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.band).toFixed(1)}`).join(' ');

  const areaPath = !hasData
    ? ''
    : isSingle
      ? `M${PAD.l},${singleY.toFixed(1)} L${(W - PAD.r).toFixed(1)},${singleY.toFixed(1)} L${(W - PAD.r).toFixed(1)},${baselineY.toFixed(1)} L${PAD.l},${baselineY.toFixed(1)} Z`
      : `${path} L${x(series.length - 1).toFixed(1)},${baselineY.toFixed(1)} L${x(0).toFixed(1)},${baselineY.toFixed(1)} Z`;

  const pointCircles = !hasData
    ? []
    : isSingle
      ? [
          { cx: PAD.l, cy: singleY, band: series[0]?.band, title: `Baseline: Band ${series[0]?.band?.toFixed(1)}` },
          { cx: (PAD.l + W - PAD.r) / 2, cy: singleY, band: series[0]?.band, title: `Baseline: Band ${series[0]?.band?.toFixed(1)}` },
          { cx: W - PAD.r, cy: singleY, band: series[0]?.band, title: `Current: Band ${series[0]?.band?.toFixed(1)}` },
        ]
      : series.map((p, i) => ({
          cx: x(i),
          cy: y(p.band),
          band: p.band,
          title: `Attempt ${i + 1}: Band ${p.band.toFixed(1)}${p.skill ? ` (${p.skill})` : ''}`,
        }));

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
          {selected === 'overall'
            ? 'Complete a test to start your progress timeline.'
            : `Complete a ${selected} test to start your progress timeline.`}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${selected} band trend`}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(band => (
            <g key={band}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(band)}
                y2={y(band)}
                stroke="var(--border-subtle)"
                strokeWidth={band === 0 ? "1.5" : "1"}
                opacity={band === 0 ? 0.9 : 0.6}
              />
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
          {pointCircles.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill="var(--bg-card)" stroke="var(--c-coral)" strokeWidth="2">
              <title>{p.title || (p.band !== undefined ? `Band ${p.band.toFixed(1)}` : '')}</title>
            </circle>
          ))}
          {isSingle ? (
            <>
              <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--text-secondary)">Attempt 1</text>
              <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                Baseline (Band {series[0]?.band?.toFixed(1)})
              </text>
              <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="var(--text-secondary)">Current</text>
            </>
          ) : (
            <>
              <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--text-secondary)">first attempt</text>
              <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="var(--text-secondary)">latest</text>
            </>
          )}
        </svg>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
        {series.length === 0
          ? 'No completed attempts recorded yet.'
          : `${series.length} completed ${series.length === 1 ? 'attempt' : 'attempts'} · ${series.length === 1 ? 'baseline' : 'latest'} band ${series[series.length - 1]?.band?.toFixed(1)}`}
      </div>
    </div>
  );
}
