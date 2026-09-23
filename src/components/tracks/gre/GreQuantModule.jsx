import React, { useState, useEffect } from 'react';
import { Bookmark, Clock, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Calculator, FileText, AlertTriangle, HelpCircle, BarChart3, Table as TableIcon } from 'lucide-react';
import { getQuantSection, QC_CHOICES } from '../../../utils/gre/greQuantPool';
import GreCalculator from './GreCalculator';
import { saveGreScore } from '../../../utils/storage';

const SET_SIZE = 12; // Official Section 1 Question Count
const DURATION_SECONDS = 21 * 60; // 21 minutes

export default function GreQuantModule({ onBack }) {
  const [questions] = useState(() => getQuantSection(SET_SIZE));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qId]: userSelection }
  const [marked, setMarked] = useState({});
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);

  // Tools: On-Screen Calculator & Scratchpad
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  // Timer
  useEffect(() => {
    if (isCompleted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishSet();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted]);

  const currentQ = questions[currentIndex];

  // Selection handlers
  const handleSelectChoice = (opt) => {
    if (currentQ.type === 'multi_choice') {
      const currentList = answers[currentQ.id] || [];
      const updated = currentList.includes(opt)
        ? currentList.filter(o => o !== opt)
        : [...currentList, opt];
      setAnswers({ ...answers, [currentQ.id]: updated });
    } else {
      setAnswers({ ...answers, [currentQ.id]: opt });
    }
  };

  const handleNumericInput = (val) => {
    setAnswers({ ...answers, [currentQ.id]: val });
  };

  const handleFractionInput = (part, val) => {
    const prev = answers[currentQ.id] || { num: '', den: '' };
    setAnswers({
      ...answers,
      [currentQ.id]: { ...prev, [part]: val }
    });
  };

  const toggleMark = () => {
    setMarked(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
  };

  const isQuestionAnswered = (q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null || ans === '') return false;
    if (q.type === 'multi_choice') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'numeric_entry_fraction') {
      return ans && ans.num !== undefined && ans.num.trim() !== '' && ans.den !== undefined && ans.den.trim() !== '';
    }
    return true;
  };

  const gradeQuestion = (q) => {
    const userAns = answers[q.id];
    if (userAns === undefined || userAns === null || userAns === '') return false;

    if (q.type === 'multi_choice') {
      if (!Array.isArray(userAns)) return false;
      const sortedUser = [...userAns].sort();
      const sortedCorrect = [...q.answers].sort();
      return sortedUser.length === sortedCorrect.length && sortedUser.every((val, i) => val === sortedCorrect[i]);
    }

    if (q.type === 'numeric_entry') {
      const cleanUser = String(userAns).trim().replace(/,/g, '');
      if (q.acceptedAnswers) {
        return q.acceptedAnswers.map(a => String(a).trim().replace(/,/g, '')).includes(cleanUser);
      }
      return cleanUser === String(q.answer).trim();
    }

    if (q.type === 'numeric_entry_fraction') {
      if (!userAns || typeof userAns !== 'object') return false;
      const userNum = String(userAns.num || '').trim();
      const userDen = String(userAns.den || '').trim();
      const correctNum = String(q.numerator).trim();
      const correctDen = String(q.denominator).trim();
      const numMatches = userNum.toLowerCase() === correctNum.toLowerCase() ||
        (q.acceptedNumerator && q.acceptedNumerator.map(n => n.toLowerCase()).includes(userNum.toLowerCase()));
      return numMatches && userDen === correctDen;
    }

    return userAns === q.answer;
  };

  const finishSet = () => {
    let correctCount = 0;
    questions.forEach(q => {
      if (gradeQuestion(q)) correctCount++;
    });

    const scaledScore = Math.round(130 + (correctCount / SET_SIZE) * 40);
    const percentage = Math.round((correctCount / SET_SIZE) * 100);

    saveGreScore('quant', {
      correct: correctCount,
      total: SET_SIZE,
      scaledScore,
      percentage,
      timeSpent: DURATION_SECONDS - timeLeft,
      completed: true
    });

    setIsCompleted(true);
    setShowReviewScreen(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // ── Completion Scorecard ──────────────────────────────────────────────────
  if (isCompleted) {
    let correctCount = 0;
    questions.forEach(q => {
      if (gradeQuestion(q)) correctCount++;
    });
    const scaledScore = Math.round(130 + (correctCount / SET_SIZE) * 40);
    const percentage = Math.round((correctCount / SET_SIZE) * 100);

    return (
      <div className="gre-exam-container">
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Scorecard */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(82, 156, 202, 0.16), rgba(77, 171, 154, 0.12))',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '32px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="badge badge-blue">Quantitative Section Completed</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>12 Questions · 21 Minutes</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
                Quantitative Reasoning Scorecard
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, margin: 0 }}>
                Scaled according to official ETS criteria on the 130–170 scale.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '12px 22px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(82, 156, 202, 0.4)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Scaled Score</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                  {scaledScore}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>out of 170</div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '12px 22px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(77, 171, 154, 0.4)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Accuracy</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  {percentage}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{correctCount} / {SET_SIZE} Correct</div>
              </div>
            </div>
          </div>

          {/* Question Explanations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src="/images/mr_crabs_frame4_explaining.png"
                  alt="Mr. Krabs Explaining"
                  style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(240,103,103,0.3))' }}
                />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Review All Answers & Explanations</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Detailed step-by-step mathematical reasoning by Mr. Krabs</p>
                </div>
              </div>
            </div>
            {questions.map((q, idx) => {
              const isCorrect = gradeQuestion(q);
              return (
                <div
                  key={q.id}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${isCorrect ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Question {idx + 1}</span>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>{q.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isCorrect ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 13, fontWeight: 600 }}>
                      {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </div>
                  </div>

                  {q.context && (
                    <div style={{ background: 'rgba(0,0,0,0.22)', padding: 12, borderRadius: 8, fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {q.context}
                    </div>
                  )}

                  {q.quantityA && q.quantityB && (
                    <div className="gre-qc-grid">
                      <div className="gre-qc-card">
                        <span className="gre-qc-header">Quantity A</span>
                        <span className="gre-qc-value">{q.quantityA}</span>
                      </div>
                      <div className="gre-qc-card">
                        <span className="gre-qc-header">Quantity B</span>
                        <span className="gre-qc-value">{q.quantityB}</span>
                      </div>
                    </div>
                  )}

                  {q.prompt && (
                    <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.55 }}>
                      {q.prompt}
                    </div>
                  )}

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      Official Solution:
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {q.explanation}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn btn-primary" onClick={onBack} style={{ padding: '12px 28px' }}>
              <span>Return to GRE Studio</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review Screen (ETS Table) ─────────────────────────────────────────────
  if (showReviewScreen) {
    return (
      <div className="gre-exam-container">
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review Questions — Quantitative Reasoning</h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                Click any row to return directly to that question.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowReviewScreen(false)}>
              <ArrowLeft size={14} /> <span>Return to Current Question</span>
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 18px' }}>Number</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px' }}>Marked</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => {
                  const answered = isQuestionAnswered(q);
                  const isMarked = marked[q.id];

                  return (
                    <tr
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowReviewScreen(false);
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: currentIndex === idx ? 'rgba(82, 156, 202, 0.12)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 18px', fontWeight: 600 }}>Question {idx + 1}</td>
                      <td style={{ padding: '12px 18px', color: answered ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {answered ? 'Answered' : 'Not Answered'}
                      </td>
                      <td style={{ padding: '12px 18px', color: isMarked ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                        {isMarked ? '✓ Marked' : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        Go to Q{idx + 1} ➔
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn-primary" onClick={finishSet} style={{ padding: '10px 24px' }}>
              <span>Submit Quantitative Section</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active Question View ──────────────────────────────────────────────────
  return (
    <div className="gre-exam-container">
      {/* On-Screen Calculator */}
      <GreCalculator
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        onTransferDisplay={(val) => {
          if (currentQ && currentQ.type === 'numeric_entry') {
            handleNumericInput(val);
          }
        }}
      />

      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Apple HIG Navigation Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowExitModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6
              }}
            >
              <ArrowLeft size={14} /> <span>Exit</span>
            </button>
            <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Quantitative Reasoning Practice
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Calculator Button */}
            <button
              onClick={() => setIsCalcOpen(prev => !prev)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 'var(--radius-pill)',
                border: isCalcOpen ? '1px solid var(--accent-blue)' : '1px solid var(--border-default)',
                background: isCalcOpen ? 'rgba(82, 156, 202, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                color: isCalcOpen ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 600
              }}
            >
              <Calculator size={13} />
              <span>Calculator</span>
            </button>

            {/* Apple Timer Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: timeLeft < 180 ? '#ffffff' : 'var(--text-primary)',
              background: timeLeft < 180 ? 'var(--accent-red)' : 'rgba(0,0,0,0.3)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              border: timeLeft < 180 ? 'none' : '1px solid var(--border-subtle)'
            }}>
              <Clock size={13} />
              <span>{timeFormatted}</span>
            </div>

            {/* Apple Mark Button */}
            <button
              onClick={toggleMark}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 'var(--radius-pill)',
                border: marked[currentQ.id] ? '1px solid var(--accent-amber)' : '1px solid var(--border-default)',
                background: marked[currentQ.id] ? 'rgba(255, 171, 74, 0.18)' : 'transparent',
                color: marked[currentQ.id] ? 'var(--accent-amber)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Bookmark size={13} fill={marked[currentQ.id] ? 'var(--accent-amber)' : 'none'} />
              <span>{marked[currentQ.id] ? 'Marked' : 'Mark'}</span>
            </button>

            {/* Apple Review Button */}
            <button
              onClick={() => setShowReviewScreen(true)}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-default)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Review ({Object.keys(answers).length}/{SET_SIZE})
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className="card" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}>
              Question {currentIndex + 1} of {SET_SIZE}
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              {currentQ.category}
            </span>
          </div>

          {/* Context / Given Condition */}
          {currentQ.context && (
            <div style={{
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              fontSize: 14.5,
              fontWeight: 500,
              color: 'var(--text-primary)'
            }}>
              {currentQ.context}
            </div>
          )}

          {/* ── 1. Quantitative Comparison (Quantity A vs Quantity B) ── */}
          {currentQ.type === 'quant_comparison' && (
            <div className="gre-qc-grid">
              <div className="gre-qc-card">
                <span className="gre-qc-header">Quantity A</span>
                <span className="gre-qc-value">{currentQ.quantityA}</span>
              </div>
              <div className="gre-qc-card">
                <span className="gre-qc-header">Quantity B</span>
                <span className="gre-qc-value">{currentQ.quantityB}</span>
              </div>
            </div>
          )}

          {/* ── Data Interpretation Visuals (Bar Chart / Table) ── */}
          {currentQ.type === 'data_interpretation' && (
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentQ.graphType === 'bar_chart' ? <BarChart3 size={17} color="var(--accent-blue)" /> : <TableIcon size={17} color="var(--accent-green)" />}
                <span>{currentQ.datasetTitle}</span>
              </div>

              {currentQ.graphType === 'bar_chart' && (
                <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                  <svg width="100%" height="160" viewBox="0 0 540 160" style={{ display: 'block' }}>
                    {/* Grid lines */}
                    <line x1="120" y1="20" x2="520" y2="20" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="55" x2="520" y2="55" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="90" x2="520" y2="90" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="125" x2="520" y2="125" stroke="rgba(255,255,255,0.06)" />

                    {currentQ.tableData.map((d, dIdx) => {
                      const y = 15 + dIdx * 35;
                      const maxVal = 1600;
                      const w2018 = (d.y2018 / maxVal) * 380;
                      const w2024 = (d.y2024 / maxVal) * 380;

                      return (
                        <g key={d.source}>
                          <text x="110" y={y + 16} textAnchor="end" fontSize="11" fill="var(--text-secondary)">
                            {d.source.split(' ')[0]}
                          </text>
                          {/* 2018 Bar */}
                          <rect x="120" y={y} width={w2018} height="12" rx="3" fill="#529cca" opacity="0.65" />
                          <text x={125 + w2018} y={y + 10} fontSize="10" fill="var(--text-muted)">{d.y2018}</text>
                          {/* 2024 Bar */}
                          <rect x="120" y={y + 14} width={w2024} height="12" rx="3" fill="#529cca" />
                          <text x={125 + w2024} y={y + 24} fontSize="10" fill="#ffffff" fontWeight="600">{d.y2024}</text>
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 10, background: '#529cca', opacity: 0.65, borderRadius: 2 }} /> 2018 Capacity (GW)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 10, background: '#529cca', borderRadius: 2 }} /> 2024 Capacity (GW)
                    </div>
                  </div>
                </div>
              )}

              {currentQ.graphType === 'table' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '8px 12px' }}>Department</th>
                        <th style={{ padding: '8px 12px' }}>Faculty</th>
                        <th style={{ padding: '8px 12px' }}>Students</th>
                        <th style={{ padding: '8px 12px' }}>Grant Funding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentQ.tableData.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.dept}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.faculty}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.students}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>${row.grantMillions.toFixed(1)}M</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Question Prompt */}
          {currentQ.prompt && (
            <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {currentQ.prompt}
            </div>
          )}

          {/* ── 2. Standard Options (Radio / QC Choices / Data Interpretation Single) ── */}
          {currentQ.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, oIdx) => {
                const isMulti = currentQ.type === 'multi_choice';
                const userAns = answers[currentQ.id];
                const isSel = isMulti
                  ? Array.isArray(userAns) && userAns.includes(opt)
                  : userAns === opt;

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectChoice(opt)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${isSel ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                      background: isSel ? 'rgba(82, 156, 202, 0.16)' : 'rgba(0,0,0,0.2)',
                      color: isSel ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: isSel ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      lineHeight: 1.5
                    }}
                  >
                    <span style={{
                      width: 15,
                      height: 15,
                      borderRadius: isMulti ? 3 : '50%',
                      border: `1.5px solid ${isSel ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                      background: isSel ? 'var(--accent-blue)' : 'transparent',
                      display: 'inline-block',
                      flexShrink: 0
                    }} />
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 3. Numeric Entry (Single Box) ── */}
          {currentQ.type === 'numeric_entry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="text"
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleNumericInput(e.target.value)}
                  placeholder="Enter numeric answer"
                  style={{
                    width: 220,
                    padding: '10px 14px',
                    fontSize: 16,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsCalcOpen(true)}
                  style={{ padding: '8px 14px', fontSize: 12 }}
                >
                  <Calculator size={13} /> <span>Open Calculator</span>
                </button>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Tip: Enter numbers as integers or decimals. You can use the ETS Calculator to compute and click "Transfer Display".
              </span>
            </div>
          )}

          {/* ── 4. Numeric Entry - Fraction Boxes ── */}
          {currentQ.type === 'numeric_entry_fraction' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="gre-fraction-container">
                  <input
                    type="text"
                    value={(answers[currentQ.id] || {}).num || ''}
                    onChange={(e) => handleFractionInput('num', e.target.value)}
                    placeholder="Num"
                    className="gre-fraction-input"
                  />
                  <div className="gre-fraction-divider" />
                  <input
                    type="text"
                    value={(answers[currentQ.id] || {}).den || ''}
                    onChange={(e) => handleFractionInput('den', e.target.value)}
                    placeholder="Den"
                    className="gre-fraction-input"
                  />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Enter numerator above and denominator below in lowest terms.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            style={{ visibility: currentIndex === 0 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={14} /> <span>Previous</span>
          </button>

          {currentIndex < SET_SIZE - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentIndex(prev => prev + 1)}
            >
              <span>Next</span> <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowReviewScreen(true)}
            >
              <span>Review & Complete Section</span>
            </button>
          )}
        </div>

        {/* High-Contrast Exit Confirmation Modal */}
        {showExitModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="card" style={{
              maxWidth: 440,
              width: '100%',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(224, 62, 62, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#e03e3e', flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Exit Quantitative Practice?</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress will be discarded</span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to return to GRE Studio? Your current session answers will not be recorded in your score history.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowExitModal(false)}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel & Resume
                </button>
                <button
                  onClick={onBack}
                  className="btn-danger-solid"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>Discard & Exit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
