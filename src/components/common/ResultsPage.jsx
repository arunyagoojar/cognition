import React, { useState, useEffect } from 'react';
import {
  Award, CheckCircle2, XCircle, RotateCcw, ArrowRight, ArrowLeft,
  Home, BookOpen, Headphones, Target, TrendingUp, Zap, AlertCircle, CheckCheck
} from 'lucide-react';
import { AnimatedCard } from '../../utils/animations';

export default function ResultsPage({
  title = 'Test Results',
  moduleName = 'Listening',
  accentColor = 'var(--accent-blue)',
  rawScore = 0,
  totalQuestions = 40,
  bandScore = 0.0,
  breakdown = [],
  questionResults = [], // [{id, answer, correct, expected}]
  onRetake,
  onBackToDashboard,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  // Immediately reset all scroll positions so the results screen opens centered at top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const scrollables = document.querySelectorAll('.main-content, .page-view-enter, .exam-container, html, body');
    scrollables.forEach(el => { if (el) el.scrollTop = 0; });
  }, []);

  const percentage = Math.round((rawScore / totalQuestions) * 100);

  const getCEFR = (band) => {
    if (band >= 8.5) return 'C2 Mastery — Expert Academic Proficiency';
    if (band >= 7.0) return 'C1 Operational Proficiency — Effective User';
    if (band >= 5.5) return 'B2 Vantage — Independent User';
    if (band >= 4.0) return 'B1 Threshold — Basic Academic User';
    return 'A2 Elementary';
  };

  const getBandColor = (band) => {
    if (band >= 8.0) return '#4dab9a';
    if (band >= 7.0) return '#529cca';
    if (band >= 6.0) return '#ffab4a';
    return '#d44c47';
  };

  const bandColor = getBandColor(bandScore);

  const correctCount = questionResults.filter(q => q.correct).length || rawScore;
  const incorrectItems = questionResults.filter(q => !q.correct);

  const tabs = [
    { id: 'overview', label: 'Score Overview', icon: Award },
    { id: 'breakdown', label: 'Section Breakdown', icon: Target },
    { id: 'questions', label: 'Question Review', icon: CheckCheck },
    { id: 'next', label: 'What\'s Next', icon: TrendingUp },
  ];

  return (
    <div
      className="animate-fade-in"
      style={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* Sleek Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(22,22,24,0.92)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={onBackToDashboard}
            style={{ padding: '5px 10px', gap: 6, fontSize: 12.5 }}
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </span>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
            Official IELTS Scale
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRetake && (
            <button className="btn btn-secondary" onClick={onRetake} style={{ padding: '6px 12px', fontSize: 12.5 }}>
              <RotateCcw size={13} />
              <span>Retake</span>
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onBackToDashboard}
            style={{ background: `linear-gradient(135deg, ${bandColor}, ${bandColor}cc)`, border: 'none', padding: '6px 14px', fontSize: 12.5 }}
          >
            <Home size={13} />
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* Centered Results Container */}
      <div style={{
        flex: 1,
        maxWidth: 960,
        margin: '0 auto',
        width: '100%',
        padding: '16px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box'
      }}>
        {/* Compact Hero Band Score Card */}
        <AnimatedCard variant="hero" delay={0}>
        <div style={{
          background: `linear-gradient(135deg, rgba(${
            bandScore >= 7 ? '82,156,202' : bandScore >= 6 ? '255,171,74' : '212,76,71'
          }, 0.12) 0%, rgba(20,20,24,0.7) 100%)`,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 28px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(200px, 1.4fr) auto',
            gap: 20,
            alignItems: 'center',
          }}>
            {/* Band Score & Module */}
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                {moduleName} Band Score
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: bandColor, lineHeight: 1, letterSpacing: -2 }}>
                  {bandScore.toFixed(1)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 9.0</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {getCEFR(bandScore)}
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Raw Score', value: `${rawScore} / ${totalQuestions}`, color: 'var(--text-primary)' },
                { label: 'Accuracy', value: `${percentage}%`, color: bandColor },
                { label: 'CEFR Level', value: bandScore >= 8.5 ? 'C2' : bandScore >= 7.0 ? 'C1' : bandScore >= 5.5 ? 'B2' : 'B1', color: 'var(--text-secondary)' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{stat.label}</span>
                  <span style={{ fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Circular Progress (Compact 96px) */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 96, height: 96 }}>
                <svg width={96} height={96} viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
                  <circle
                    cx="48" cy="48" r="38"
                    fill="none"
                    stroke={bandColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - percentage / 100)}`}
                    transform="rotate(-90 48 48)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: bandColor, lineHeight: 1 }}>{percentage}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>accuracy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Integrated Sleek Tab Nav */}
          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap'
          }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: active ? `1px solid ${bandColor}55` : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? bandColor : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        </AnimatedCard>

        {/* Tab content */}
        <AnimatedCard delay={0.12} key={activeTab}>
        <div style={{ flex: 1 }}>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 2-Column Strengths & Areas to Improve Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* What you did right */}
                <div style={{
                  background: 'rgba(77, 171, 154, 0.07)',
                  border: '1px solid rgba(77, 171, 154, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={15} color="var(--accent-green)" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent-green)', margin: 0 }}>What You Did Well</h3>
                  </div>
                  <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                    <li>Answered {correctCount} of {totalQuestions} correctly ({percentage}% accuracy)</li>
                    {percentage >= 70 && <li>Above the target academic passing threshold</li>}
                    {breakdown.filter(s => s.score / s.total >= 0.75).map(s => (
                      <li key={s.name}>{s.name}: {s.score}/{s.total} solid control</li>
                    ))}
                  </ul>
                </div>

                {/* What went wrong */}
                <div style={{
                  background: 'rgba(212, 76, 71, 0.07)',
                  border: '1px solid rgba(212, 76, 71, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <XCircle size={15} color="var(--accent-red)" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent-red)', margin: 0 }}>Areas to Improve</h3>
                  </div>
                  <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                    <li>Missed {totalQuestions - correctCount} questions (~0.1–0.3 band loss per error)</li>
                    {breakdown.filter(s => s.score / s.total < 0.7).map(s => (
                      <li key={s.name}>{s.name}: {s.score}/{s.total} needs practice</li>
                    ))}
                    {percentage < 70 && <li>Focus on pacing and keyword recognition strategies</li>}
                  </ul>
                </div>
              </div>

              {/* Overall summary */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Zap size={15} color="var(--accent-amber)" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent-amber)', margin: 0 }}>Diagnostic Summary</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px 0' }}>
                  Your {moduleName} Band {bandScore.toFixed(1)} score places you at {getCEFR(bandScore)}.
                  {bandScore >= 7.0
                    ? ' Solid performance — sharpen accuracy on complex questions to target Band 8.0+.'
                    : bandScore >= 6.0
                    ? ' Nearing target university threshold. Regular timed drills will close the gap in 3–4 weeks.'
                    : ' Focused question-type drills recommended. Review incorrect question explanations below.'}
                </p>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Standard benchmark: Band 7.5+ meets postgraduate criteria for Oxford, Cambridge, and Ivy League universities.
                </div>
              </div>
            </div>
          )}

        {/* TAB: SECTION BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {breakdown.length > 0 ? breakdown.map((sec, idx) => {
              const secPct = Math.round((sec.score / sec.total) * 100);
              const secColor = secPct >= 80 ? 'var(--accent-green)' : secPct >= 65 ? 'var(--accent-blue)' : secPct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
              return (
                <div key={idx} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{sec.name}</span>
                    <span style={{ fontWeight: 700, color: secColor, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                      {sec.score} / {sec.total} ({secPct}%)
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-canvas)', borderRadius: 'var(--radius-pill)', height: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${secPct}%`,
                      height: '100%',
                      background: secColor,
                      borderRadius: 'var(--radius-pill)',
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {secPct >= 80 ? '✓ Excellent — strong section command'
                      : secPct >= 65 ? '→ Good — minor improvements needed'
                      : secPct >= 50 ? '⚠ Needs work — review question type strategies'
                      : '✗ Weak section — prioritize this in your next practice'}
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Section breakdown not available for this test.
              </div>
            )}
          </div>
        )}

        {/* TAB: QUESTION REVIEW */}
        {activeTab === 'questions' && (
          <div>
            {questionResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '420px', overflowY: 'auto', paddingRight: 4 }}>
                {questionResults.map((q, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    background: q.correct ? 'rgba(77,171,154,0.06)' : 'rgba(212,76,71,0.06)',
                    border: `1px solid ${q.correct ? 'rgba(77,171,154,0.18)' : 'rgba(212,76,71,0.18)'}`,
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {q.correct
                      ? <CheckCircle2 size={14} color="var(--accent-green)" />
                      : <XCircle size={14} color="var(--accent-red)" />}
                    <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 30 }}>Q{q.id}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>
                      {q.correct ? 'Correct' : `Your answer: "${q.answer || '—'}" → Correct: "${q.expected}"`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <AlertCircle size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Detailed question review available after submitting with answers recorded.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: WHAT'S NEXT */}
        {activeTab === 'next' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: `rgba(82,156,202,0.08)`,
              border: '1px solid rgba(82,156,202,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 10 }}>
                🎯 Your Path to Band {Math.min(9.0, Math.ceil(bandScore + 0.5) * 2 / 2).toFixed(1)}
              </h3>
              <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 2 }}>
                {bandScore < 7.0 && <li>Complete at least 2 more timed practice tests this week</li>}
                {bandScore < 8.0 && <li>Review the specific question types you missed most frequently</li>}
                <li>Study Cambridge IELTS {moduleName} official answer strategies</li>
                <li>Practice note-taking speed and predict question types from keywords</li>
                <li>Take the Full IELTS Mock Test to get a complete band estimate</li>
              </ul>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}>
              {[
                { label: 'Reading', desc: 'Paired skill for academic comprehension', color: 'var(--accent-green)' },
                { label: 'Writing', desc: 'Task 1 & 2 with AI band evaluation', color: 'var(--accent-amber)' },
                { label: 'Speaking', desc: 'Parts 1–3 with live transcription', color: 'var(--accent-purple)' },
                { label: 'Full Mock Test', desc: 'All 4 sections in official exam sequence', color: 'var(--accent-blue)' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ fontWeight: 600, color: item.color, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={onBackToDashboard}
              style={{
                background: `linear-gradient(135deg, ${bandColor}, ${bandColor}bb)`,
                border: 'none',
                padding: '14px 28px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                alignSelf: 'center',
                marginTop: 8,
              }}
            >
              <Home size={16} />
              <span>Return to Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
