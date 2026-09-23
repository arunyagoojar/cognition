import React, { useState } from 'react';
import { Headphones, BookOpen, PenTool, Mic, Award, Play, Clock, ArrowRight, TrendingUp, Zap } from 'lucide-react';
import { getSkillScores } from '../../utils/storage';
import { AnimatedCard } from '../../utils/animations';

// ── Compact pure line chart (no dots, no fills) ──────────────────────────────
function LineChart({ skillScores, completedHistory }) {
  const skills = [
    { key: 'listening', label: 'Listening', color: '#529cca' },
    { key: 'reading',   label: 'Reading',   color: '#4dab9a' },
    { key: 'writing',   label: 'Writing',   color: '#ffab4a' },
    { key: 'speaking',  label: 'Speaking',  color: '#9065b0' },
  ];

  const getSkillHistory = (key) => {
    const hist = (completedHistory || [])
      .filter(r => r[key])
      .map(r => {
        const s = r[key];
        return { band: s.bandScore ?? s.overallBand ?? 0, date: new Date(r.completedAt || Date.now()) };
      })
      .sort((a, b) => a.date - b.date);

    const cur = skillScores[key];
    if (cur) {
      const curBand = cur.bandScore ?? cur.overallBand ?? 0;
      const curDate = new Date(cur.updatedAt || Date.now());
      if (!hist.length || Math.abs(hist[hist.length - 1].date - curDate) > 1000) {
        hist.push({ band: curBand, date: curDate });
      }
    }
    return hist;
  };

  const mockAttempts = (completedHistory || []).filter(r => r.isMockExam);
  const allHistories = skills.map(s => ({ ...s, hist: getSkillHistory(s.key) }));
  const anyData = allHistories.some(s => s.hist.length > 0);

  const W = 460, H = 145;
  const PAD = { top: 12, right: 28, bottom: 26, left: 30 };
  const graphStartX = PAD.left + 22; // Invisible barrier after numbers 3, 5, 7, 9
  const graphEndX = W - PAD.right;
  const plotW = graphEndX - graphStartX;
  const plotH = H - PAD.top - PAD.bottom;

  // Collect all unique session timestamps across all tests
  const allTimestamps = Array.from(new Set(
    allHistories.flatMap(s => s.hist.map(p => p.date.getTime()))
  )).sort((a, b) => a - b);

  const toX = (ts) => {
    if (allTimestamps.length <= 1) {
      return graphStartX + 12;
    }
    const idx = allTimestamps.indexOf(ts);
    if (idx === -1) {
      const minT = allTimestamps[0];
      const maxT = allTimestamps[allTimestamps.length - 1];
      const frac = maxT > minT ? (ts - minT) / (maxT - minT) : 0;
      return graphStartX + Math.max(0, Math.min(1, frac)) * plotW;
    }
    return graphStartX + (idx / (allTimestamps.length - 1)) * plotW;
  };

  const toY = (band) => PAD.top + plotH - ((Math.min(9, Math.max(0, band)) / 9) * plotH);

  const makePath = (hist) => {
    if (hist.length === 0) return '';
    if (hist.length === 1) {
      // Single session: draw a clean horizontal segment with generous width (44px, double previous)
      // Clamped strictly to [graphStartX, graphEndX] so it NEVER touches the numbers or gets cut in half
      const segWidth = 44;
      const xCenter = toX(hist[0].date.getTime());
      const y = toY(hist[0].band);
      const x1 = Math.max(graphStartX, Math.min(graphEndX - segWidth, xCenter - segWidth / 2));
      const x2 = Math.min(graphEndX, x1 + segWidth);
      return `M${x1.toFixed(1)},${y.toFixed(1)} L${x2.toFixed(1)},${y.toFixed(1)}`;
    }
    return hist.map((p, i) => {
      const x = toX(p.date.getTime()).toFixed(1);
      const y = toY(p.band).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  };

  const yLines = [3, 5, 7, 9];

  if (!anyData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: H, gap: 6 }}>
        <TrendingUp size={22} color="var(--text-muted)" style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Complete a test to track your progress
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {skills.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            {s.label}
          </div>
        ))}
        {mockAttempts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 1, transform: 'rotate(45deg)', display: 'inline-block', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' }} />
            Mock
          </div>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'hidden' }}>
        <defs>
          {/* Clip group so lines never escape plot bounds */}
          <clipPath id="plot-clip">
            <rect
              x={graphStartX - 1}
              y={PAD.top - 2}
              width={plotW + 2}
              height={plotH + 4}
            />
          </clipPath>
        </defs>

        {/* Y-axis numbers (3, 5, 7, 9) — cleanly separated before the invisible line */}
        {yLines.map(b => (
          <text
            key={`label-${b}`}
            x={PAD.left - 6}
            y={toY(b) + 3.5}
            textAnchor="end"
            fontSize="9"
            fill="rgba(255,255,255,0.28)"
          >{b}</text>
        ))}

        {/* All chart content strictly clipped to bounds */}
        <g clipPath="url(#plot-clip)">
          {/* Horizontal grid lines starting from the invisible barrier (graphStartX) */}
          {yLines.map(b => (
            <line
              key={`grid-${b}`}
              x1={graphStartX} y1={toY(b)}
              x2={graphEndX} y2={toY(b)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
          ))}

          {/* Band 7.0 target dashed line */}
          <line
            x1={graphStartX} y1={toY(7)}
            x2={graphEndX} y2={toY(7)}
            stroke="rgba(255,171,74,0.35)" strokeWidth="1" strokeDasharray="4,3"
          />

          {/* Mock exam vertical markers */}
          {mockAttempts.map((m, i) => {
            const date = new Date(m.completedAt || Date.now()).getTime();
            const x = toX(date);
            return (
              <line key={i}
                x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH}
                stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3,3"
              />
            );
          })}

          {/* Lines — crisp 2px stroke, clean, never cut in half */}
          {allHistories.map(s => s.hist.length > 0 && (
            <path
              key={s.key}
              d={makePath(s.hist)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Band 7 label outside clip */}
        <text x={graphEndX + 4} y={toY(7) + 3} fontSize="8" fill="rgba(255,171,74,0.5)">7</text>

        {/* X-axis label */}
        <text x={graphStartX + plotW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.2)">
          Sessions over time
        </text>
      </svg>
    </div>
  );
}

// ── Practice skill card (Apple design) ───────────────────────────────────────
function SkillCard({ module: m, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const Icon = m.icon;
  const hasScore = m.scoreInfo.badgeClass !== 'badge-neutral';
  const bandNum = parseFloat(m.scoreInfo.text.replace(/[^0-9.]/g, '')) || null;
  const pct = bandNum ? (bandNum / 9) * 100 : 0;

  return (
    <div
      onClick={() => onSelect(m.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card practice-module-card"
      style={{
        cursor: 'pointer',
        background: hovered
          ? `linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)`
          : 'var(--bg-card)',
        border: hovered ? `1px solid ${m.rawColor}55` : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `0 10px 32px rgba(0,0,0,0.4), 0 0 0 1px ${m.rawColor}20`
          : '0 2px 8px rgba(0,0,0,0.18)',
      }}
    >
      {/* Ambient color tint */}
      <div style={{
        position: 'absolute', top: -28, right: -28, width: 88, height: 88,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${m.rawColor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Top content block */}
      <div className="practice-card-top">
        {/* Icon + Mascot + badge row */}
        <div className="practice-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: `linear-gradient(135deg, ${m.rawColor}28, ${m.rawColor}10)`,
              border: `1px solid ${m.rawColor}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: m.rawColor, flexShrink: 0,
            }}>
              <Icon size={20} />
            </div>
            <img
              src={m.crocsFrame}
              alt={`Mr. Crocs ${m.title}`}
              style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(112,197,110,0.3))' }}
              title={`Mr. Crocs — ${m.title} Literature Coach`}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 500, color: m.rawColor,
              background: `${m.rawColor}18`, padding: '2px 8px',
              borderRadius: 'var(--radius-pill)', border: `1px solid ${m.rawColor}28`,
            }}>{m.badge}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {m.duration}
            </span>
          </div>
        </div>

        {/* Title + description with uniform height */}
        <div className="practice-card-title-desc">
          <h3 className="practice-card-title">
            {m.title}
          </h3>
          <p className="practice-card-desc">
            {m.description}
          </p>
        </div>
      </div>

      {/* Bottom content block */}
      <div className="practice-card-bottom">
        {/* Score area with IDENTICAL 3-row layout and uniform height */}
        <div className="practice-card-score-box">
          {hasScore ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Last Score</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.rawColor, fontFamily: 'var(--font-mono)' }}>
                  {m.scoreInfo.text.replace('Current Score: ', '')}
                </span>
              </div>
              <div style={{ background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${m.rawColor}88, ${m.rawColor})`,
                  borderRadius: 'var(--radius-pill)',
                }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)', minHeight: 14 }}>
                {m.scoreInfo.subtext || 'Ready for evaluation'}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Skill Status</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  — / Band 9.0
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                <div style={{ width: '0%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, minHeight: 14 }}>
                <Zap size={11} color={m.rawColor} />
                <span>Not attempted yet · Take first session</span>
              </div>
            </>
          )}
        </div>

        {/* CTA pinned horizontally at identical bottom height */}
        <div className="practice-card-cta-row">
          <span style={{ fontSize: 12.5, fontWeight: 600, color: m.rawColor, display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasScore ? 'Practice Again' : 'Start Now'}
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ onSelectModule, onStartMockTest, completedHistory = [] }) {
  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  const savedScores = getSkillScores();
  const skillScores = isDemo ? {
    listening: savedScores.listening || { rawScore: 36, bandScore: 8.0, total: 40 },
    reading:   savedScores.reading   || { rawScore: 34, bandScore: 7.5, total: 40 },
    writing:   savedScores.writing   || { overallBand: 7.0, task1: { band: 7.0 }, task2: { band: 7.0 } },
    speaking:  savedScores.speaking  || { overallBand: 7.5, breakdown: { fluencyAndCoherence: 7.5, lexicalResource: 7.5 } },
  } : savedScores;

  const getScoreBadge = (key) => {
    const s = skillScores[key];
    if (!s) return { text: 'Not attempted yet', badgeClass: 'badge-neutral', subtext: '' };
    if (key === 'listening') return { text: `Current Score: Band ${s.bandScore.toFixed(1)}`, badgeClass: 'badge-blue',   subtext: `${s.rawScore} of 40 correct` };
    if (key === 'reading')   return { text: `Current Score: Band ${s.bandScore.toFixed(1)}`, badgeClass: 'badge-green',  subtext: `${s.rawScore} of 40 correct` };
    if (key === 'writing')   return { text: `Current Score: Band ${s.overallBand.toFixed(1)}`, badgeClass: 'badge-amber', subtext: `Task 1: B${s.task1?.band || 7.0}  Task 2: B${s.task2?.band || 7.0}` };
    if (key === 'speaking')  return { text: `Current Score: Band ${s.overallBand.toFixed(1)}`, badgeClass: 'badge-purple', subtext: `Fluency B${s.breakdown?.fluencyAndCoherence || 7.5}  Lexical B${s.breakdown?.lexicalResource || 7.5}` };
    return { text: 'In progress', badgeClass: 'badge-neutral', subtext: '' };
  };

  const modules = [
    {
      id: 'speaking',
      title: 'Speaking',
      icon: Mic,
      badge: 'Parts 1, 2 & 3',
      rawColor: '#9065b0',
      description: 'Interactive three-part interview evaluating conversational fluency, lexical resource, grammatical accuracy, and natural spoken pronunciation.',
      coachNote: 'Articulate thoughts with natural cadence and composure.',
      crocsFrame: '/images/mr_crocs_frame4_celebrating.png',
      duration: '14 min',
      scoreInfo: getScoreBadge('speaking')
    },
    {
      id: 'listening',
      title: 'Listening',
      icon: Headphones,
      badge: '4 Parts · 40 Qs',
      rawColor: '#529cca',
      description: 'Four recorded audio sections progressing from everyday social dialogues to complex academic university lectures and discussions.',
      coachNote: 'Attune your ear to subtle cues and transitional signposts.',
      crocsFrame: '/images/mr_crocs_frame2_thinking.png',
      duration: '32 min',
      scoreInfo: getScoreBadge('listening')
    },
    {
      id: 'writing',
      title: 'Writing',
      icon: PenTool,
      badge: 'Task 1 & Task 2',
      rawColor: '#ffab4a',
      description: 'Two rigorous writing tasks requiring visual graphic data analysis followed by a structured argumentative academic essay.',
      coachNote: 'Structure your arguments with clarity, cohesion, and elegance.',
      crocsFrame: '/images/mr_crocs_frame1_idle.png',
      duration: '60 min',
      scoreInfo: getScoreBadge('writing')
    },
    {
      id: 'reading',
      title: 'Reading',
      icon: BookOpen,
      badge: '3 Passages · 40 Qs',
      rawColor: '#4dab9a',
      description: 'Three comprehensive academic passages assessing skimming, detailed textual comprehension, inference, and thematic analysis.',
      coachNote: 'Examine the text attentively to discern underlying meaning.',
      crocsFrame: '/images/mr_crocs_frame3_reading.png',
      duration: '60 min',
      scoreInfo: getScoreBadge('reading')
    },
  ];

  const bands = [
    skillScores.listening?.bandScore,
    skillScores.reading?.bandScore,
    skillScores.writing?.overallBand,
    skillScores.speaking?.overallBand,
  ].filter(Boolean);
  const avgBand = bands.length ? (bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : null;
  const mockCount = (completedHistory || []).filter(r => r.isMockExam).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <AnimatedCard variant="hero" delay={0}>
      <div className="track-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span className="badge badge-blue">IELTS Studio</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Official Academic Format</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
            IELTS® Academic Preparation
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Computer-delivered simulation with AI evaluation and band analytics
          </p>
        </div>

        {/* Right: Estimated Band Score card — unified with GRE and DMAT */}
        <div className="track-score-summary-card">
          <div className="score-stat-group">
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Estimated Overall Band
            </div>
            <div className="score-stat-value">
              <span style={{ fontSize: 22, fontWeight: 800, color: avgBand ? 'var(--accent-amber)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {avgBand ? `Band ${avgBand}` : '—'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {avgBand ? `/ 9.0 (${bands.length} skill${bands.length > 1 ? 's' : ''})` : 'No attempts'}
              </span>
            </div>
          </div>
          <div className="score-stat-divider" />
          <div className="score-stat-group">
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Mocks Taken
            </div>
            <div className="score-stat-value">
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: mockCount > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {mockCount}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Completed</span>
            </div>
          </div>
        </div>
      </div>
      </AnimatedCard>
      {/* ── Mr. Crocs AI English Tutor Banner ── */}
      <AnimatedCard delay={0.08}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(112, 197, 110, 0.08) 0%, rgba(20, 25, 22, 0.6) 100%)',
        border: '1px solid rgba(112, 197, 110, 0.22)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
            src="/images/mr_crocs_frame1_idle.png"
            alt="Mr. Crocs"
            className="animate-mascot-float"
            style={{
              width: 68,
              height: 68,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(112, 197, 110, 0.35))',
              flexShrink: 0
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#70C56E' }}>Mr. Crocs</span>
              <span className="badge badge-green" style={{ fontSize: 10.5, padding: '1px 7px' }}>English Lit & IELTS Coach</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "Good day! As your literary mentor, I shall assist in refining your linguistic elegance. Express yourself with precision, maintain cohesive structure, and let your vocabulary flourish naturally."
            </p>
          </div>
        </div>
      </div>
      </AnimatedCard>
      {/* ── Skill cards section header ── */}
      <AnimatedCard delay={0.14}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>Practice by Skill</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Each session is independently scored and saved</p>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>4 official IELTS skills</span>
        </div>

        {/* ── Skill cards grid with Equal Heights & Widths ── */}
        <div className="practice-card-grid">
          {modules.map(m => (
            <SkillCard key={m.id} module={m} onSelect={onSelectModule} />
          ))}
        </div>
      </div>
      </AnimatedCard>

      {/* ── Bottom row: Mock exam info (left) + Line chart (right) ── */}
      <AnimatedCard delay={0.2}>
      <div className="bottom-end-cards-grid">

        {/* Left: Full Mock Test card — rich, high-utility layout filling the space */}
        <div className="card bottom-end-card" style={{
          background: 'linear-gradient(135deg, rgba(35,131,226,0.09) 0%, rgba(144,101,176,0.07) 100%)',
          border: '1px solid rgba(82,156,202,0.22)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 22px',
          gap: 14,
        }}>
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(35,131,226,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Award size={15} color="#529cca" />
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#529cca',
                  background: 'rgba(35,131,226,0.15)', padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)', border: '1px solid rgba(82,156,202,0.25)',
                }}>
                  Official Format Simulation
                </span>
              </div>
              {mockCount > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent-green)', background: 'rgba(77,171,154,0.12)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(77,171,154,0.25)' }}>
                  {mockCount} Mock{mockCount > 1 ? 's' : ''} Completed
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Not attempted yet
                </span>
              )}
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, marginBottom: 5, color: 'var(--text-primary)' }}>
              Full Length Mock Exam
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Simulates official Cambridge computer-delivered testing conditions with automatic band scoring and consolidated feedback.
            </p>

            {/* 4-skill sequential flow cards */}
            <div className="mock-subtests-flow-grid">
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#529cca', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Headphones size={12} /> Listening
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>4 Sec · 40 Qs</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4dab9a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={12} /> Reading
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>3 Pas · 40 Qs</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ffab4a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PenTool size={12} /> Writing
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>2 Tasks · 60m</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9065b0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mic size={12} /> Speaking
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>3 Pts · AI Band</div>
              </div>
            </div>

            {/* Highlights row */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} color="var(--accent-blue)" /> 2 hrs 44 min full test
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} color="var(--accent-amber)" /> Instant CEFR & Band report
              </span>
            </div>
          </div>

          <div className="mock-bottom-action-row">
            <button
              className="btn btn-primary"
              onClick={onStartMockTest}
              style={{
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, #1a6cb8, #2383e2)',
                boxShadow: '0 6px 22px rgba(35,131,226,0.35)', border: 'none',
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>Start Full Mock Exam</span>
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Continuous session</span>
          </div>
        </div>

        {/* Right: Compact line chart */}
        <div className="bottom-graph-card">
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, margin: 0 }}>Score Progress</h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Band score over time</p>
          </div>
          <LineChart skillScores={skillScores} completedHistory={completedHistory} />
        </div>

      </div>
      </AnimatedCard>
    </div>
  );
}
