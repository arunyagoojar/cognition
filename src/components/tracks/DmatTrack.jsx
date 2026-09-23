import React, { useState, useEffect } from 'react';
import { Layers, CheckCircle2, Clock, Sparkles, Brain, Award, Play, BookOpen, ArrowRight, ShieldAlert, Grid3x3, Calculator, Eye, Info, X, TrendingUp, Zap, HelpCircle } from 'lucide-react';
import { AnimatedCard } from '../../utils/animations';
import LatinSquaresModule from './dmat/LatinSquaresModule';
import MathEquationsModule from './dmat/MathEquationsModule';
import FigureSequencesModule from './dmat/FigureSequencesModule';
import AcademicModule from './dmat/AcademicModule';
import DmatMockExam from './dmat/DmatMockExam';
import { getDmatScores, getDmatHistory } from '../../utils/storage';

// ── DMAT Percentage Progress Line Chart (0% - 100%) ───────────────────────────
function DmatLineChart({ scores, history }) {
  const sections = [
    { key: 'latin',    label: 'Latin Squares', color: '#4dab9a' },
    { key: 'math',     label: 'Math Equations', color: '#529cca' },
    { key: 'figures',  label: 'Figure Sequences', color: '#9065b0' },
    { key: 'academic', label: 'Academic Module', color: '#ffab4a' },
  ];

  const getSectionHistory = (key) => {
    const hist = (history || [])
      .filter(r => r.section === key)
      .map(r => ({
        percentage: r.percentage ?? 0,
        date: new Date(r.completedAt || Date.now())
      }))
      .sort((a, b) => a.date - b.date);

    const cur = scores[key];
    if (cur && cur.percentage !== undefined) {
      const curPct = cur.percentage;
      const curDate = new Date(cur.updatedAt || Date.now());
      if (!hist.length || Math.abs(hist[hist.length - 1].date - curDate) > 1000) {
        hist.push({ percentage: curPct, date: curDate });
      }
    }
    return hist;
  };

  const mockAttempts = (history || [])
    .filter(r => r.section === 'mock')
    .map(r => ({
      percentage: r.percentage ?? 0,
      date: new Date(r.completedAt || Date.now())
    }))
    .sort((a, b) => a.date - b.date);

  const allHistories = sections.map(s => ({ ...s, hist: getSectionHistory(s.key) }));
  const anyData = allHistories.some(s => s.hist.length > 0) || mockAttempts.length > 0;

  const W = 460, H = 145;
  const PAD = { top: 12, right: 28, bottom: 26, left: 34 };
  const graphStartX = PAD.left + 22; // Clean invisible starting barrier after numbers
  const graphEndX = W - PAD.right;
  const plotW = graphEndX - graphStartX;
  const plotH = H - PAD.top - PAD.bottom;

  // Collect all unique session timestamps
  const allTimestamps = Array.from(new Set([
    ...allHistories.flatMap(s => s.hist.map(p => p.date.getTime())),
    ...mockAttempts.map(p => p.date.getTime())
  ])).sort((a, b) => a - b);

  const toX = (ts) => {
    if (allTimestamps.length <= 1) return graphStartX + 12;
    const idx = allTimestamps.indexOf(ts);
    if (idx === -1) {
      const minT = allTimestamps[0];
      const maxT = allTimestamps[allTimestamps.length - 1];
      const frac = maxT > minT ? (ts - minT) / (maxT - minT) : 0;
      return graphStartX + Math.max(0, Math.min(1, frac)) * plotW;
    }
    return graphStartX + (idx / (allTimestamps.length - 1)) * plotW;
  };

  const toY = (pct) => PAD.top + plotH - ((Math.min(100, Math.max(0, pct)) / 100) * plotH);

  const makePath = (hist) => {
    if (hist.length === 0) return '';
    if (hist.length === 1) {
      const segWidth = 44;
      const xCenter = toX(hist[0].date.getTime());
      const y = toY(hist[0].percentage);
      const x1 = Math.max(graphStartX, Math.min(graphEndX - segWidth, xCenter - segWidth / 2));
      const x2 = Math.min(graphEndX, x1 + segWidth);
      return `M${x1.toFixed(1)},${y.toFixed(1)} L${x2.toFixed(1)},${y.toFixed(1)}`;
    }
    return hist.map((p, i) => {
      const x = toX(p.date.getTime()).toFixed(1);
      const y = toY(p.percentage).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  };

  const yLines = [25, 50, 75, 100];

  if (!anyData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: H, gap: 6 }}>
        <TrendingUp size={22} color="var(--text-muted)" style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Complete a practice drill or mock exam to track your percentage
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {sections.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            {s.label}
          </div>
        ))}
        {mockAttempts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: '#e03e3e', display: 'inline-block' }} />
            Mock
          </div>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'hidden' }}>
        <defs>
          <clipPath id="dmat-plot-clip">
            <rect x={graphStartX - 1} y={PAD.top - 2} width={plotW + 2} height={plotH + 4} />
          </clipPath>
        </defs>

        {/* Y-axis percentage labels (25%, 50%, 75%, 100%) */}
        {yLines.map(pct => (
          <text
            key={`label-${pct}`}
            x={PAD.left - 6}
            y={toY(pct) + 3.5}
            textAnchor="end"
            fontSize="8.5"
            fill="rgba(255,255,255,0.28)"
          >
            {pct}%
          </text>
        ))}

        <g clipPath="url(#dmat-plot-clip)">
          {/* Horizontal grid lines */}
          {yLines.map(pct => (
            <line
              key={`grid-${pct}`}
              x1={graphStartX} y1={toY(pct)}
              x2={graphEndX} y2={toY(pct)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
          ))}

          {/* 75% target benchmark line */}
          <line
            x1={graphStartX} y1={toY(75)}
            x2={graphEndX} y2={toY(75)}
            stroke="rgba(255,171,74,0.35)" strokeWidth="1" strokeDasharray="4,3"
          />

          {/* Render section lines */}
          {allHistories.map(s => {
            const d = makePath(s.hist);
            if (!d) return null;
            return (
              <path
                key={s.key}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Mock exam line & points */}
          {mockAttempts.length > 0 && (
            <path
              d={makePath(mockAttempts)}
              fill="none"
              stroke="#e03e3e"
              strokeWidth="2.5"
              strokeDasharray="5,3"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
}

export default function DmatTrack({
  onBackToIelts,
  onExamStateChange,
  isGuidelinesOpen: externalIsGuidelinesOpen,
  setIsGuidelinesOpen: externalSetIsGuidelinesOpen,
  initialModule = null,
  onExitToLastTab
}) {
  const [activeModule, setActiveModule] = useState(initialModule); // null | 'latin' | 'math' | 'figures' | 'academic' | 'mock'
  const [internalGuidelinesOpen, setInternalGuidelinesOpen] = useState(false);

  const isGuidelinesOpen = externalIsGuidelinesOpen !== undefined ? externalIsGuidelinesOpen : internalGuidelinesOpen;
  const setIsGuidelinesOpen = externalSetIsGuidelinesOpen || setInternalGuidelinesOpen;

  useEffect(() => {
    if (onExamStateChange) {
      onExamStateChange(Boolean(activeModule));
    }
  }, [activeModule, onExamStateChange]);

  const scores = getDmatScores();
  const history = getDmatHistory();

  // Aggregate overall score across all subtests and mock tests
  let totalAttempted = 0;
  let totalCorrect = 0;
  ['latin', 'math', 'figures', 'academic', 'mock'].forEach(key => {
    const s = scores[key];
    if (s && s.total > 0) {
      totalAttempted += s.total;
      totalCorrect += s.correct;
    }
  });
  const overallPercentage = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const estimatedStandardScore = totalAttempted > 0 ? Math.round(80 + overallPercentage * 0.4) : null;

  const handleExitModule = () => {
    if (initialModule && onExitToLastTab) {
      onExitToLastTab();
    } else {
      setActiveModule(null);
    }
  };

  if (activeModule === 'latin') {
    return (
      <div className="dmat-exam-container">
        <LatinSquaresModule onBack={handleExitModule} />
      </div>
    );
  }
  if (activeModule === 'math') {
    return (
      <div className="dmat-exam-container">
        <MathEquationsModule onBack={handleExitModule} />
      </div>
    );
  }
  if (activeModule === 'figures') {
    return (
      <div className="dmat-exam-container">
        <FigureSequencesModule onBack={handleExitModule} />
      </div>
    );
  }
  if (activeModule === 'academic') {
    return (
      <div className="dmat-exam-container">
        <AcademicModule onBack={handleExitModule} />
      </div>
    );
  }
  if (activeModule === 'mock') {
    return (
      <div className="dmat-exam-container">
        <DmatMockExam onExit={handleExitModule} />
      </div>
    );
  }

  // 4 official subtests with accurate icons
  const subtests = [
    {
      id: 'latin',
      title: 'Latin Squares',
      badge: 'Core Module 1',
      badgeColor: 'var(--accent-green)',
      icon: Grid3x3,
      color: '#4dab9a',
      time: '16 Tasks · 20 min',
      desc: 'Deduce row and column cell values within 5x5 grids by eliminating conflicting letters systematically until exactly one unique solution remains.',
      coachNote: 'Eliminate conflicts methodically; careless guessing is unacceptable.',
      scoreInfo: scores.latin
    },
    {
      id: 'math',
      title: 'Mathematical Equations',
      badge: 'Core Module 2',
      badgeColor: 'var(--accent-blue)',
      icon: Calculator,
      color: '#529cca',
      time: '20 Tasks · 25 min',
      desc: 'Solve coupled systems of algebraic equations through precise substitution and elimination to isolate unknown integer variables without calculating errors.',
      coachNote: 'Isolate variables with absolute rigor; verify every single operation.',
      scoreInfo: scores.math
    },
    {
      id: 'figures',
      title: 'Figure Sequences',
      badge: 'Core Module 3',
      badgeColor: '#9065b0',
      icon: Eye,
      color: '#9065b0',
      time: '20 Series · 25 min',
      desc: 'Analyze abstract geometric matrix transformations across sequential steps by tracing rotational symmetry, shape trajectories, and color shifts accurately.',
      coachNote: 'Track geometric rules without deviation; patterns do not lie.',
      scoreInfo: scores.figures
    },
    {
      id: 'academic',
      title: 'General Academic Module',
      badge: 'Subject Module',
      badgeColor: 'var(--accent-amber)',
      icon: BookOpen,
      color: '#ffab4a',
      time: '26 Questions · 90 min',
      desc: 'Interpret dense scientific texts and diagrams spanning physics, economics, and logic through rigorous data evaluation and structural textual synthesis.',
      coachNote: 'Synthesize scientific formulas with discerning textual comprehension.',
      scoreInfo: scores.academic
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Studio Header & Banner */}
      <AnimatedCard variant="hero" delay={0}>
      <div className="track-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span className="badge badge-green">dMAT Studio</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>German Master's Aptitude Assessment</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
            Digital Master Assessment Test (dMAT)
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Cognitive aptitude and academic reasoning assessment with subtest drills
          </p>
        </div>

        {/* Right Header: Overall Score Card (replaces previous instructions button) */}
        <div className="track-score-summary-card">
          <div className="score-stat-group">
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Overall Accuracy
            </div>
            <div className="score-stat-value">
              <span style={{ fontSize: 22, fontWeight: 800, color: totalAttempted > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {overallPercentage}%
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {totalAttempted > 0 ? `(${totalCorrect}/${totalAttempted} Qs)` : 'No attempts'}
              </span>
            </div>
          </div>
          <div className="score-stat-divider" />
          <div className="score-stat-group">
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Standard Score
            </div>
            <div className="score-stat-value">
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {estimatedStandardScore !== null ? estimatedStandardScore : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>/ 120</span>
            </div>
          </div>
        </div>
      </div>
      </AnimatedCard>

      {/* ── Mr. Krabs dMAT Quantitative Aptitude Banner ── */}
      <AnimatedCard delay={0.08}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(240, 103, 103, 0.08) 0%, rgba(25, 20, 22, 0.6) 100%)',
        border: '1px solid rgba(240, 103, 103, 0.22)',
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
            src="/images/mr_crabs_duo_cutout.png"
            alt="Mr. Krabs"
            className="animate-mascot-float"
            style={{
              width: 68,
              height: 68,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(240, 103, 103, 0.35))',
              flexShrink: 0
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F06767' }}>Mr. Krabs</span>
              <span className="badge badge-amber" style={{ fontSize: 10.5, padding: '1px 7px' }}>dMAT Aptitude Specialist</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "DMAT demands unwavering mental discipline. In Latin Squares and Math Equations, guess nothing. Eliminate impossibilities systematically and verify every deduction with absolute precision."
            </p>
          </div>
        </div>
      </div>
      </AnimatedCard>

      {/* Practice by Subtest Section */}
      <AnimatedCard delay={0.16}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>Practice by Subtest</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Each session is automatically mixed between low, medium, and high difficulty</p>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>4 official dMAT modules</span>
        </div>

        {/* 4 Cards Grid with Equal Heights & Widths */}
        <div className="practice-card-grid">
          {subtests.map(sub => {
            const Icon = sub.icon;
            const hasScore = sub.scoreInfo && sub.scoreInfo.total > 0;
            const pct = hasScore ? sub.scoreInfo.percentage : 0;

            return (
              <div
                key={sub.id}
                onClick={() => setActiveModule(sub.id)}
                className="card practice-module-card"
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {/* Top content block */}
                <div className="practice-card-top">
                  {/* Icon + Mascot + badge row */}
                  <div className="practice-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 13,
                        background: `linear-gradient(135deg, ${sub.color}28, ${sub.color}10)`,
                        border: `1px solid ${sub.color}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: sub.color, flexShrink: 0
                      }}>
                        <Icon size={20} />
                      </div>
                      {sub.id === 'latin' && (
                        <img
                          src="/images/mr_crabs_frame2_thinking.png"
                          alt="Mr. Krabs"
                          style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                          title="Mr. Krabs — Grid Deduction"
                        />
                      )}
                      {sub.id === 'math' && (
                        <img
                          src="/images/mr_crabs_frame3_teaching.png"
                          alt="Mr. Krabs"
                          style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                          title="Mr. Krabs — Math Specialist"
                        />
                      )}
                      {sub.id === 'figures' && (
                        <img
                          src="/images/mr_crabs_frame4_explaining.png"
                          alt="Mr. Krabs"
                          style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                          title="Mr. Krabs — Spatial Pattern Logic"
                        />
                      )}
                      {sub.id === 'academic' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <img
                            src="/images/mr_crabs_frame1_idle.png"
                            alt="Mr. Krabs"
                            style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                            title="Mr. Krabs — Quantitative Logic"
                          />
                          <img
                            src="/images/mr_crocs_frame3_reading.png"
                            alt="Mr. Crocs"
                            style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(112,197,110,0.3))' }}
                            title="Mr. Crocs — Academic Reading"
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 500, color: sub.color,
                        background: `${sub.color}18`, padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)', border: `1px solid ${sub.color}28`
                      }}>
                        {sub.badge}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {sub.time}
                      </span>
                    </div>
                  </div>

                  {/* Title + description with uniform height */}
                  <div className="practice-card-title-desc">
                    <h3 className="practice-card-title">
                      {sub.title}
                    </h3>
                    <p className="practice-card-desc">
                      {sub.desc}
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
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Accuracy</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: sub.color, fontFamily: 'var(--font-mono)' }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: `linear-gradient(90deg, ${sub.color}88, ${sub.color})`,
                            borderRadius: 'var(--radius-pill)'
                          }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)', minHeight: 14 }}>
                          {sub.scoreInfo.correct} of {sub.scoreInfo.total} tasks completed
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Module Status</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            — / 100%
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                          <div style={{ width: '0%', height: '100%' }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, minHeight: 14 }}>
                          <Zap size={11} color={sub.color} />
                          <span>Not attempted yet · Take first drill</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CTA pinned horizontally at identical bottom height */}
                  <div className="practice-card-cta-row">
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: sub.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasScore ? 'Practice Again' : 'Start Practice'}
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </AnimatedCard>

      {/* ── Bottom row: Mock exam info (left) + Line chart (right) ── */}
      <AnimatedCard delay={0.24}>
      <div className="bottom-end-cards-grid">
        {/* Left: Full Mock Test card — structured exactly like IELTS */}
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
            pointerEvents: 'none'
          }} />

          <div>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Award size={15} color="#529cca" />
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#529cca',
                  background: 'rgba(35,131,226,0.15)', padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)', border: '1px solid rgba(82,156,202,0.25)'
                }}>
                  Official g.a.s.t. Test Simulation
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Exact Structure: 82 Qs · 160 Min
              </span>
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, marginBottom: 5, color: 'var(--text-primary)' }}>
              Full Length dMAT Mock Exam
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Simulates the full German Master Assessment Test structure: Core Module (Figure Sequences, Math Equations, Latin Squares) and General Academic Subject Module.
            </p>

            {/* 4-section sequential flow cards */}
            <div className="mock-subtests-flow-grid">
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9065b0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={12} /> Figures
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>20 Qs · 25m</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#529cca', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calculator size={12} /> Math Eq.
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>20 Qs · 25m</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4dab9a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Grid3x3 size={12} /> Latin Sq.
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>16 Qs · 20m</div>
              </div>
              <div className="mock-subtest-pill">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ffab4a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={12} /> Academic
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>26 Qs · 90m</div>
              </div>
            </div>

            {/* Highlights row */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} color="var(--accent-blue)" /> 160 min total duration
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} color="var(--accent-amber)" /> Standard score (80–120) & APS readiness
              </span>
            </div>
          </div>

          <div className="mock-bottom-action-row">
            <button
              className="btn btn-primary"
              onClick={() => setActiveModule('mock')}
              style={{
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, #1a6cb8, #2383e2)',
                boxShadow: '0 6px 22px rgba(35,131,226,0.35)', border: 'none'
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>Start Official Mock Exam</span>
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Exact question structure</span>
          </div>
        </div>

        {/* Right: Compact line chart (Percentage out of 100%) */}
        <div className="bottom-graph-card">
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, margin: 0 }}>Performance Progress</h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Accuracy percentage (% out of 100) over time</p>
          </div>
          <DmatLineChart scores={scores} history={history} />
        </div>
      </div>
      </AnimatedCard>

      {/* Guidelines Modal Overlay */}
      {isGuidelinesOpen && (
        <div className="modal-overlay-animated" onClick={() => setIsGuidelinesOpen(false)}>
          <div className="modal-content-animated" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 'var(--radius-md)',
                  background: 'rgba(82, 156, 202, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-blue)'
                }}>
                  <Info size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Official dMAT Regulations & Structure
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Administered by g.a.s.t. e.V. · APS Germany
                  </span>
                </div>
              </div>

              <button className="btn btn-ghost" onClick={() => setIsGuidelinesOpen(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>1. Mandatory Target Audience:</strong>
                Required for Indian applicants holding degrees in Engineering, Computer Science, Economics, Commerce, Finance, or Business/Management applying for German Master's degrees.
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>2. Strict Zero-Notes Policy:</strong>
                Purely computer-delivered. Absolutely no rough paper, scratchpads, pens, or calculators are allowed. Candidates must perform mental substitution and visual deduction.
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>3. Examination Timing & Questions:</strong>
                • <strong>Core Module (70 min, 56 Qs)</strong>: Figure Sequences (20 Qs · 25m), Math Equations (20 Qs · 25m), Latin Squares (16 Qs · 20m).<br />
                • <strong>Subject Module (90 min, 26 Qs)</strong>: 4 Reading passages with 6 to 7 questions each.
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>4. Official Standardized Scoring:</strong>
                Scores are reported on a standardized scale from 80 to 120 (mean 100, standard deviation 10). A standard score of 100+ indicates high APS readiness.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setIsGuidelinesOpen(false)} style={{ borderRadius: 'var(--radius-pill)', padding: '8px 22px' }}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
