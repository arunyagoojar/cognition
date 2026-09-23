import React, { useState } from 'react';
import { BookOpen, CheckCircle2, XCircle, ArrowRight, Lightbulb, ChevronRight } from 'lucide-react';
import { getAcademicModulePassages } from '../../../utils/dmat/academicModuleData';
import ExitConfirmationModal from '../../common/ExitConfirmationModal';
import { saveDmatScore } from '../../../utils/storage';

export default function AcademicModule({ onBack }) {
  const passages = getAcademicModulePassages();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const currentPassage = passages[currentIdx];
  const [activeQIdx, setActiveQIdx] = useState(0);

  const handleSelect = (qId, optionLabel) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qId]: optionLabel }));
  };

  const handleBack = () => {
    if (Object.keys(selectedAnswers).length > 0 && !submitted) {
      setIsExitModalOpen(true);
    } else {
      onBack();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    onBack();
  };

  const handleSubmit = () => {
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const scrollables = document.querySelectorAll('.main-content, .page-view-enter, .dmat-exam-container, html, body');
    scrollables.forEach(el => { if (el) el.scrollTop = 0; });

    const correct = currentPassage.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length;
    const total = currentPassage.questions.length;
    saveDmatScore('academic', {
      correct,
      total,
      percentage: Math.round((correct / total) * 100),
      completed: true
    });
  };

  const handleNextPassage = () => {
    setCurrentIdx((currentIdx + 1) % passages.length);
    setSelectedAnswers({});
    setSubmitted(false);
    setShowWalkthrough(false);
    setActiveQIdx(0);
  };

  const totalQuestions = currentPassage.questions.length;
  const answeredCount = currentPassage.questions.filter(q => selectedAnswers[q.id]).length;
  const allAnswered = answeredCount === totalQuestions;

  // Calculate score if submitted
  const correctCount = submitted
    ? currentPassage.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length
    : 0;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ fontSize: 13, padding: '7px 14px' }}>
          ← Back to DMAT Studio
        </button>

        {/* Exit Confirmation Modal */}
        <ExitConfirmationModal
          isOpen={isExitModalOpen}
          onCancel={() => setIsExitModalOpen(false)}
          onConfirm={handleConfirmExit}
          sectionTitle="General Academic Module"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-amber" style={{ fontSize: 11 }}>Subject Module · General Academic Reasoning</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Passage {currentIdx + 1} of {passages.length} ({totalQuestions} Questions)
          </span>
        </div>
      </div>

      {/* Duo Coach Tag: Mr. Krabs (Quantitative & Science Logic) + Mr. Crocs (Textual & Rhetorical Comprehension) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(240, 103, 103, 0.06) 0%, rgba(20, 20, 28, 0.6) 50%, rgba(112, 197, 110, 0.06) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <img src="/images/mr_crabs_frame1_idle.png" alt="Mr. Krabs" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <img src="/images/mr_crocs_frame3_reading.png" alt="Mr. Crocs" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            Co-Coaches: <span style={{ color: '#F06767' }}>Mr. Krabs</span> & <span style={{ color: '#70C56E' }}>Mr. Crocs</span>
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          "Unite quantitative formula precision with discerning textual inference."
        </span>
      </div>

      {/* Split layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 1.05fr',
        gap: 24,
        alignItems: 'start'
      }}>
        {/* Left: Sticky Text & Data Table */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'sticky',
          top: 20,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent-amber)', fontWeight: 600 }}>
                {currentPassage.field}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                Official g.a.s.t. & Careerwise Syllabus
              </span>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: '4px 0 0 0', letterSpacing: -0.3 }}>
              {currentPassage.title}
            </h2>
          </div>

          <div style={{
            fontSize: 13,
            lineHeight: 1.68,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-line',
            background: 'var(--bg-canvas)',
            padding: '16px 18px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)'
          }}>
            {currentPassage.text}
          </div>

          {/* Telemetry/Data Table */}
          {currentPassage.table && (
            <div>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Telemetry & Experimental Data:
              </span>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {currentPassage.table.headers.map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPassage.table.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: ri < currentPassage.table.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: Question Navigation & Active Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Passage Progress & Question Jump Pills */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {submitted ? (
                  <span style={{ color: correctCount >= 4 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                    Score: <strong>{correctCount} / {totalQuestions}</strong> Correct ({Math.round((correctCount / totalQuestions) * 100)}%)
                  </span>
                ) : (
                  <span>Questions Progress: <strong>{answeredCount} / {totalQuestions}</strong> Answered</span>
                )}
              </span>

              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                6–7 Questions / Section
              </span>
            </div>

            {/* Jump Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {currentPassage.questions.map((q, idx) => {
                const isSelected = selectedAnswers[q.id];
                const isCorrect = submitted && isSelected === q.correctAnswer;
                const isWrong = submitted && isSelected && !isCorrect;

                let pillBg = 'rgba(255,255,255,0.04)';
                let pillBorder = '1px solid var(--border-subtle)';
                let pillColor = 'var(--text-muted)';

                if (submitted) {
                  if (isCorrect) {
                    pillBg = 'rgba(77, 171, 154, 0.2)';
                    pillBorder = '1px solid var(--accent-green)';
                    pillColor = 'var(--accent-green)';
                  } else {
                    pillBg = 'rgba(235, 87, 87, 0.2)';
                    pillBorder = '1px solid var(--accent-red)';
                    pillColor = 'var(--accent-red)';
                  }
                } else if (isSelected) {
                  pillBg = 'rgba(82, 156, 202, 0.2)';
                  pillBorder = '1px solid var(--accent-blue)';
                  pillColor = 'var(--accent-blue)';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      const el = document.getElementById(`q-card-${q.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    style={{
                      width: 32,
                      height: 30,
                      borderRadius: 'var(--radius-sm)',
                      background: pillBg,
                      border: pillBorder,
                      color: pillColor,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Q{idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of 6-7 Questions */}
          {currentPassage.questions.map((q, qIdx) => (
            <div
              key={q.id}
              id={`q-card-${q.id}`}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                scrollMarginTop: 20
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--accent-blue)', marginRight: 6 }}>Q{qIdx + 1}.</strong> {q.prompt}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map(opt => {
                  const isSelected = selectedAnswers[q.id] === opt.label;
                  const isCorrect = opt.label === q.correctAnswer;
                  let bg = 'rgba(255,255,255,0.02)';
                  let border = '1px solid var(--border-subtle)';

                  if (submitted) {
                    if (isCorrect) {
                      bg = 'rgba(77, 171, 154, 0.2)';
                      border = '1px solid var(--accent-green)';
                    } else if (isSelected && !isCorrect) {
                      bg = 'rgba(235, 87, 87, 0.2)';
                      border = '1px solid var(--accent-red)';
                    }
                  } else if (isSelected) {
                    bg = 'rgba(82, 156, 202, 0.15)';
                    border = '1px solid var(--accent-blue)';
                  }

                  return (
                    <button
                      key={opt.label}
                      disabled={submitted}
                      onClick={() => handleSelect(q.id, opt.label)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: bg,
                        border: border,
                        textAlign: 'left',
                        cursor: submitted ? 'default' : 'pointer',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: 'var(--text-primary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: isSelected ? 'var(--accent-blue)' : 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 10.5,
                        flexShrink: 0
                      }}>
                        {opt.label}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div style={{
                  fontSize: 11.5,
                  color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start'
                }}>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginTop: 1 }}>
                    <img src="/images/mr_crabs_frame1_idle.png" alt="Mr. Krabs" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    <img src="/images/mr_crocs_frame3_reading.png" alt="Mr. Crocs" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  </div>
                  <div>
                    <strong style={{ color: 'var(--accent-amber)' }}>Mr. Krabs & Mr. Crocs Joint Deduction:</strong> {q.explanation}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 20px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {!submitted ? `${answeredCount} of ${totalQuestions} selected` : 'Review your deductions above'}
            </span>

            {!submitted ? (
              <button
                className="btn btn-primary"
                disabled={!allAnswered}
                onClick={handleSubmit}
                style={{
                  padding: '10px 24px', fontSize: 13, fontWeight: 600,
                  opacity: allAnswered ? 1 : 0.5,
                  background: 'linear-gradient(135deg, #ffab4a, #d97706)'
                }}
              >
                Submit All {totalQuestions} Answers
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleNextPassage}
                style={{
                  padding: '10px 24px', fontSize: 13, fontWeight: 600,
                  background: 'linear-gradient(135deg, #2383e2, #529cca)',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <span>Next Academic Section</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
