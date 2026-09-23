import React, { useState, useEffect } from 'react';
import { BookOpen, Calculator, PenTool, Sparkles, Clock, CheckCircle2, Play, Award, TrendingUp, Layers, HelpCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { AnimatedCard } from '../../utils/animations';
import GreWritingModule from './gre/GreWritingModule';
import GreVerbalModule from './gre/GreVerbalModule';
import GreQuantModule from './gre/GreQuantModule';
import GreMockExam from './gre/GreMockExam';
import { getGreScores, getGreHistory } from '../../utils/storage';
import { GRE_VERBAL_QUESTIONS } from '../../utils/gre/greVerbalPool';
import { GRE_QUANT_QUESTIONS } from '../../utils/gre/greQuantPool';

// ── GRE Progress Line Chart (Scaled Score 130 – 170) ─────────────────────────
function GreScoreChart({ history, scores }) {
  const verbalHist = (history || [])
    .filter(r => r.section === 'verbal')
    .map(r => ({ score: r.scaledScore || 130, date: new Date(r.completedAt || Date.now()) }))
    .sort((a, b) => a.date - b.date);

  const quantHist = (history || [])
    .filter(r => r.section === 'quant')
    .map(r => ({ score: r.scaledScore || 130, date: new Date(r.completedAt || Date.now()) }))
    .sort((a, b) => a.date - b.date);

  const mockHist = (history || [])
    .filter(r => r.section === 'mock')
    .map(r => ({ score: r.scaledScore || r.totalScaled || 260, date: new Date(r.completedAt || Date.now()) }))
    .sort((a, b) => a.date - b.date);

  const anyData = verbalHist.length > 0 || quantHist.length > 0 || mockHist.length > 0;

  const W = 460, H = 145;
  const PAD = { top: 12, right: 28, bottom: 26, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Scale: 130 to 170 (40 points range)
  const toY = (score) => {
    const clamped = Math.min(170, Math.max(130, score));
    return PAD.top + plotH - ((clamped - 130) / 40) * plotH;
  };

  const allTimestamps = Array.from(new Set([
    ...verbalHist.map(p => p.date.getTime()),
    ...quantHist.map(p => p.date.getTime())
  ])).sort((a, b) => a - b);

  const toX = (ts) => {
    if (allTimestamps.length <= 1) return PAD.left + plotW / 2;
    const idx = allTimestamps.indexOf(ts);
    return PAD.left + (idx / (allTimestamps.length - 1)) * plotW;
  };

  const makePath = (list) => {
    if (list.length === 0) return '';
    if (list.length === 1) {
      const y = toY(list[0].score);
      return `M${PAD.left},${y} L${PAD.left + plotW},${y}`;
    }
    return list.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.date.getTime()).toFixed(1)},${toY(p.score).toFixed(1)}`).join(' ');
  };

  const yLabels = [140, 150, 160, 170];

  if (!anyData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: H, gap: 6 }}>
        <TrendingUp size={22} color="var(--text-muted)" style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Complete a Verbal or Quant section to visualize your 130–170 score trend
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 2.5, borderRadius: 2, background: '#9065b0', display: 'inline-block' }} />
          Verbal (130–170)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 2.5, borderRadius: 2, background: '#529cca', display: 'inline-block' }} />
          Quantitative (130–170)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <span style={{ width: 12, height: 1, borderTop: '1px dashed #ffab4a', display: 'inline-block' }} />
          160 Target (80th%ile)
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'hidden' }}>
        {/* Y Axis labels & grid */}
        {yLabels.map(val => (
          <g key={val}>
            <text x={PAD.left - 6} y={toY(val) + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">
              {val}
            </text>
            <line
              x1={PAD.left} y1={toY(val)}
              x2={W - PAD.right} y2={toY(val)}
              stroke={val === 160 ? 'rgba(255, 171, 74, 0.35)' : 'rgba(255,255,255,0.06)'}
              strokeDasharray={val === 160 ? '4,3' : 'none'}
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Verbal Line */}
        {verbalHist.length > 0 && (
          <path
            d={makePath(verbalHist)}
            fill="none"
            stroke="#9065b0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Quant Line */}
        {quantHist.length > 0 && (
          <path
            d={makePath(quantHist)}
            fill="none"
            stroke="#529cca"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}

export default function GreTrack({ onBackToIelts, onExamStateChange, initialModule = null, onExitToLastTab }) {
  const [activeModule, setActiveModule] = useState(initialModule); // 'writing' | 'verbal' | 'quant' | 'mock'
  const scores = getGreScores();
  const history = getGreHistory();

  // Notify parent App when inside an exam/drill so the top navbar is hidden
  useEffect(() => {
    if (onExamStateChange) {
      onExamStateChange(Boolean(activeModule));
    }
  }, [activeModule, onExamStateChange]);

  // Aggregate composite scores (Verbal + Quant out of 340 + AWA out of 6.0)
  const verbalScore = scores.verbal?.scaledScore || scores.mock?.verbalScaled || null;
  const quantScore = scores.quant?.scaledScore || scores.mock?.quantScaled || null;
  const writingScore = scores.writing?.score || scores.mock?.writingScore || null;

  const compositeScore = verbalScore && quantScore ? verbalScore + quantScore : null;

  const handleExitModule = () => {
    if (initialModule && onExitToLastTab) {
      onExitToLastTab();
    } else {
      setActiveModule(null);
    }
  };

  // Active module renderers
  if (activeModule === 'writing') {
    return <GreWritingModule onBack={handleExitModule} />;
  }
  if (activeModule === 'verbal') {
    return <GreVerbalModule onBack={handleExitModule} />;
  }
  if (activeModule === 'quant') {
    return <GreQuantModule onBack={handleExitModule} />;
  }
  if (activeModule === 'mock') {
    return <GreMockExam onExit={handleExitModule} />;
  }

  // 3 Official Sections (Analytical Writing, Verbal Reasoning & Quantitative Reasoning)
  const sections = [
    {
      id: 'writing',
      title: 'Analytical Writing',
      badge: 'Issue Analysis',
      badgeColor: 'var(--accent-amber)',
      icon: PenTool,
      color: '#ffab4a',
      time: '1 Task · 30 min',
      desc: 'Compose a cogent critique analyzing a complex issue, supporting your perspective with reasoned development, persuasive examples, and controlled academic prose.',
      coachNote: 'Construct a logically sound argument with polished prose.',
      coachMascot: 'duo',
      scoreInfo: scores.writing
    },
    {
      id: 'verbal',
      title: 'Verbal Reasoning',
      badge: 'Sections 2 and 4',
      badgeColor: 'var(--accent-purple)',
      icon: BookOpen,
      color: '#9065b0',
      time: '12 Tasks · 18 min',
      desc: 'Evaluate nuanced passages and complete challenging sentence structures by discerning precise vocabulary distinctions, rhetorical logic, and textual relationships.',
      coachNote: 'Discern subtle contextual cues and appreciate lexical nuance.',
      coachMascot: 'crocs',
      scoreInfo: scores.verbal
    },
    {
      id: 'quant',
      title: 'Quantitative Reasoning',
      badge: 'Sections 3 and 5',
      badgeColor: 'var(--accent-blue)',
      icon: Calculator,
      color: '#529cca',
      time: '12 Tasks · 21 min',
      desc: 'Demonstrate mathematical mastery across arithmetic, algebra, geometry, and data interpretation through quantitative comparison and exact numeric entry.',
      coachNote: 'Verify constraints relentlessly; avoid hasty numerical estimation.',
      coachMascot: 'krabs',
      scoreInfo: scores.quant
    }
  ];

  const totalPoolSize = GRE_VERBAL_QUESTIONS.length + GRE_QUANT_QUESTIONS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Studio Header & Banner */}
      <AnimatedCard variant="hero" delay={0}>
      <div className="track-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span className="badge badge-purple">GRE Studio</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Official 5-Section Test Structure</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
            GRE® General Test Preparation
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Standardized graduate exam simulation with adaptive scoring and timing
          </p>
        </div>

        {/* Right Header: Composite Score Card — matches DMAT/IELTS compact style */}
        <div className="track-score-summary-card">
          <div className="score-stat-group">
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Estimated Total Score
            </div>
            <div className="score-stat-value">
              <span style={{ fontSize: 22, fontWeight: 800, color: compositeScore ? 'var(--accent-purple)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {compositeScore !== null ? compositeScore : '—'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>/ 340</span>
            </div>
          </div>
          <div className="score-stat-divider" />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center' }}>
            <div className="score-stat-group" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Verbal</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
                {verbalScore ?? '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/ 170</span>
              </div>
            </div>
            <div className="score-stat-group" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Quant</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                {quantScore ?? '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/ 170</span>
              </div>
            </div>
            <div className="score-stat-group" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>AWA</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
                {writingScore ? writingScore.toFixed(1) : '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/ 6.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </AnimatedCard>

      {/* ── GRE Mascot Banner: Mr. Krabs & Mr. Crocs ── */}
      <AnimatedCard delay={0.08}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(240, 103, 103, 0.08) 0%, rgba(20, 20, 28, 0.6) 50%, rgba(112, 197, 110, 0.08) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Mascots together on the left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <img
            src="/images/mr_crabs_frame1_idle.png"
            alt="Mr. Krabs"
            className="animate-mascot-float"
            style={{
              width: 58,
              height: 58,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(240, 103, 103, 0.35))'
            }}
          />
          <img
            src="/images/mr_crocs_frame3_reading.png"
            alt="Mr. Crocs"
            className="animate-mascot-float"
            style={{
              width: 58,
              height: 58,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(112, 197, 110, 0.35))',
              animationDelay: '0.4s'
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#F06767' }}>Mr. Krabs</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>&</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#70C56E' }}>Mr. Crocs</span>
            <span className="badge badge-purple" style={{ fontSize: 10.5, padding: '1px 7px' }}>GRE Mentors</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            "Master analytical precision and verbal nuance. Approach each section with rigor, eliminate false choices systematically, and maintain composure."
          </p>
        </div>
      </div>
      </AnimatedCard>

      {/* Practice by Section */}
      <AnimatedCard delay={0.16}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>Practice by Section</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Official timed practice sets for all 3 GRE measures
            </p>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>3 core measures</span>
        </div>

        {/* 3 Section Cards Grid with Equal Heights & Widths */}
        <div className="practice-card-grid">
          {sections.map(sec => {
            const Icon = sec.icon;
            const hasScore = sec.scoreInfo && sec.scoreInfo.completed;
            const scoreVal = hasScore ? (sec.scoreInfo.scaledScore || sec.scoreInfo.score) : null;

            return (
              <div
                key={sec.id}
                onClick={() => setActiveModule(sec.id)}
                className="card practice-module-card"
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {/* Top content block */}
                <div className="practice-card-top">
                  {/* Header row */}
                  <div className="practice-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 13,
                        background: `linear-gradient(135deg, ${sec.color}28, ${sec.color}10)`,
                        border: `1px solid ${sec.color}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: sec.color, flexShrink: 0
                      }}>
                        <Icon size={20} />
                      </div>
                      {sec.id === 'quant' && (
                        <img
                          src="/images/mr_crabs_frame3_teaching.png"
                          alt="Mr. Krabs"
                          style={{ width: 38, height: 38, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(240,103,103,0.3))' }}
                          title="Mr. Krabs — Quant Specialist"
                        />
                      )}
                      {sec.id === 'verbal' && (
                        <img
                          src="/images/mr_crocs_frame3_reading.png"
                          alt="Mr. Crocs"
                          style={{ width: 38, height: 38, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(112,197,110,0.3))' }}
                          title="Mr. Crocs — Verbal Specialist"
                        />
                      )}
                      {sec.id === 'writing' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <img
                            src="/images/mr_crocs_frame2_thinking.png"
                            alt="Mr. Crocs"
                            style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(112,197,110,0.3))' }}
                            title="Mr. Crocs — Language Mentor"
                          />
                          <img
                            src="/images/mr_crabs_frame2_thinking.png"
                            alt="Mr. Krabs"
                            style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(240,103,103,0.3))' }}
                            title="Mr. Krabs — Logic Coach"
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, color: sec.color,
                        background: `${sec.color}18`, padding: '2px 9px',
                        borderRadius: 'var(--radius-pill)', border: `1px solid ${sec.color}28`
                      }}>
                        {sec.badge}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {sec.time}
                      </span>
                    </div>
                  </div>

                  {/* Title & Desc with uniform height */}
                  <div className="practice-card-title-desc">
                    <h3 className="practice-card-title">
                      {sec.title}
                    </h3>
                    <p className="practice-card-desc">
                      {sec.desc}
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: sec.color, fontFamily: 'var(--font-mono)' }}>
                            {sec.id === 'writing' ? `${scoreVal ? Number(scoreVal).toFixed(1) : '—'} / 6.0` : `${scoreVal} / 170`}
                          </span>
                        </div>
                        <div style={{ background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: sec.id === 'writing' ? `${((scoreVal || 0) / 6) * 100}%` : `${(((scoreVal || 130) - 130) / 40) * 100}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${sec.color}88, ${sec.color})`,
                            borderRadius: 'var(--radius-pill)'
                          }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)', minHeight: 14 }}>
                          {sec.id === 'writing' ? 'Analytical writing criterion passed' : 'ETS scaled benchmark met'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Section Status</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {sec.id === 'writing' ? '— / 6.0' : '— / 170'}
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-pill)', height: 3, overflow: 'hidden' }}>
                          <div style={{ width: '0%', height: '100%' }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, minHeight: 14 }}>
                          <Zap size={11} color={sec.color} />
                          <span>Not attempted yet · Take first drill</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CTA pinned horizontally at identical bottom height */}
                  <div className="practice-card-cta-row">
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: sec.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasScore ? 'Practice Again' : 'Start Drill'}
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </AnimatedCard>

      {/* Bottom Row: Full Mock Exam Banner + Score Trends Chart */}
      <AnimatedCard delay={0.24}>
      <div className="bottom-end-cards-grid">
        {/* Full Mock Test Card */}
        <div
          className="card bottom-end-card"
          style={{
            background: 'linear-gradient(135deg, rgba(144, 101, 176, 0.12), rgba(82, 156, 202, 0.08))',
            border: '1px solid rgba(144, 101, 176, 0.35)',
            padding: '24px 24px',
            gap: 18,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-purple">Official Full Simulation</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>1 hr 58 min Total (5 Official Sections)</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, marginBottom: 8 }}>
              Official GRE General Test Simulation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Complete 5-section exam mirroring the official ETS testing order:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div>• Section 1: Analytical Writing (1 Issue Task, 30 min)</div>
              <div>• Section 2: Verbal Reasoning 1 (12 Questions, 18 min)</div>
              <div>• Section 3: Quantitative Reasoning 1 (12 Questions, 21 min)</div>
              <div>• Section 4: Verbal Reasoning 2 (15 Questions, 23 min)</div>
              <div>• Section 5: Quantitative Reasoning 2 (15 Questions, 26 min)</div>
            </div>
          </div>

          <div className="mock-bottom-action-row" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total Scaled Score (260–340) + Analytical Writing (0.0–6.0)
            </span>
            <button
              className="btn btn-primary"
              onClick={() => setActiveModule('mock')}
              style={{
                padding: '10px 22px',
                background: 'linear-gradient(135deg, #9065b0, #7a4a9e)',
                border: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 7
              }}
            >
              <Play size={13} fill="currentColor" />
              <span>Launch Full GRE Mock Exam</span>
            </button>
          </div>
        </div>

        {/* Progress Line Chart Card */}
        <div className="bottom-graph-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Scaled Score Trends</h4>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>ETS scaled score (130–170) history</span>
              </div>
              <TrendingUp size={15} color="var(--accent-purple)" />
            </div>
            <GreScoreChart history={history} scores={scores} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
            <span>Target: 160+ Verbal / 165+ Quant</span>
            <span style={{ color: 'var(--accent-purple)' }}>{history.length} completed sessions</span>
          </div>
        </div>
      </div>
      </AnimatedCard>
    </div>
  );
}
