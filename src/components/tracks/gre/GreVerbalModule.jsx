import React, { useState, useEffect } from 'react';
import { Bookmark, Clock, ArrowRight, ArrowLeft, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Eye, ShieldAlert, Award, BookOpen, CheckSquare, Square, MousePointer } from 'lucide-react';
import { getVerbalSection } from '../../../utils/gre/greVerbalPool';
import { saveGreScore } from '../../../utils/storage';

const SET_SIZE = 12; // Official Section 1 Question Count
const DURATION_SECONDS = 18 * 60; // 18 minutes

export default function GreVerbalModule({ onBack }) {
  const [questions] = useState(() => getVerbalSection(SET_SIZE));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qId]: userSelection }
  const [marked, setMarked] = useState({}); // { [qId]: boolean }
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);

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

  // Text Completion Selection
  const handleSelectBlank = (blankIdx, opt) => {
    const prev = answers[currentQ.id] || {};
    const updated = { ...prev, [blankIdx]: opt };
    setAnswers({ ...answers, [currentQ.id]: updated });
  };

  // Sentence Equivalence: Select exactly 2
  const handleToggleSentenceEq = (opt) => {
    const currentList = answers[currentQ.id] || [];
    let updated;
    if (currentList.includes(opt)) {
      updated = currentList.filter(item => item !== opt);
    } else {
      if (currentList.length >= 2) {
        updated = [currentList[1], opt];
      } else {
        updated = [...currentList, opt];
      }
    }
    setAnswers({ ...answers, [currentQ.id]: updated });
  };

  // Reading Comprehension Single / Multi Select
  const handleSelectRc = (opt) => {
    if (currentQ.type === 'reading_comprehension_multi') {
      const currentList = answers[currentQ.id] || [];
      const updated = currentList.includes(opt)
        ? currentList.filter(o => o !== opt)
        : [...currentList, opt];
      setAnswers({ ...answers, [currentQ.id]: updated });
    } else {
      setAnswers({ ...answers, [currentQ.id]: opt });
    }
  };

  // Select-in-Passage Handler
  const handleSelectSentence = (sentenceIdx) => {
    setAnswers({ ...answers, [currentQ.id]: sentenceIdx });
  };

  // Toggle Mark for review
  const toggleMark = () => {
    setMarked(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
  };

  // Check if a question is answered
  const isQuestionAnswered = (q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return false;
    if (q.type.startsWith('text_completion')) {
      return q.blanks.every((b, idx) => ans[idx] !== undefined);
    }
    if (q.type === 'sentence_equivalence') {
      return Array.isArray(ans) && ans.length === 2;
    }
    if (q.type === 'reading_comprehension_multi') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'reading_comprehension_select_passage') {
      return typeof ans === 'number';
    }
    return Boolean(ans);
  };

  // Grade question accurately
  const gradeQuestion = (q) => {
    const userAns = answers[q.id];
    if (userAns === undefined || userAns === null) return false;

    if (q.type.startsWith('text_completion')) {
      return q.blanks.every((b, idx) => userAns[idx] === b.answer);
    }
    if (q.type === 'sentence_equivalence') {
      if (!Array.isArray(userAns) || userAns.length !== 2) return false;
      const sortedUser = [...userAns].sort();
      const sortedCorrect = [...q.answers].sort();
      return sortedUser[0] === sortedCorrect[0] && sortedUser[1] === sortedCorrect[1];
    }
    if (q.type === 'reading_comprehension_multi') {
      if (!Array.isArray(userAns)) return false;
      const sortedUser = [...userAns].sort();
      const sortedCorrect = [...q.answers].sort();
      return sortedUser.length === sortedCorrect.length && sortedUser.every((val, i) => val === sortedCorrect[i]);
    }
    if (q.type === 'reading_comprehension_select_passage') {
      return userAns === q.targetSentenceIndex;
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

    saveGreScore('verbal', {
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
            background: 'linear-gradient(135deg, rgba(144, 101, 176, 0.16), rgba(82, 156, 202, 0.12))',
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
                <span className="badge badge-purple">Verbal Section Completed</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>12 Questions · 18 Minutes</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
                Verbal Reasoning Scorecard
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
                border: '1px solid rgba(144, 101, 176, 0.4)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Scaled Score</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                  {scaledScore}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>out of 170</div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '12px 22px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(82, 156, 202, 0.4)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Accuracy</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                  {percentage}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{correctCount} / {SET_SIZE} Correct</div>
              </div>
            </div>
          </div>

          {/* Question Explanations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/images/mr_crocs_frame4_celebrating.png"
                alt="Mr. Crocs Celebrating"
                style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(112,197,110,0.35))' }}
              />
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Review All Answers & Explanations</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Detailed linguistic analysis by Mr. Crocs, GRE Verbal Expert</p>
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

                  {q.passage && (
                    <div style={{ background: 'rgba(0,0,0,0.22)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                      {q.passageTitle && <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>{q.passageTitle}</strong>}
                      {q.passage}
                    </div>
                  )}

                  {q.sentences && (
                    <div style={{ background: 'rgba(0,0,0,0.22)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                      {q.sentences.map((sent, sIdx) => (
                        <span
                          key={sIdx}
                          style={{
                            background: sIdx === q.targetSentenceIndex ? 'rgba(77, 171, 154, 0.25)' : 'transparent',
                            color: sIdx === q.targetSentenceIndex ? 'var(--accent-green)' : 'inherit',
                            fontWeight: sIdx === q.targetSentenceIndex ? 600 : 'normal',
                            padding: '2px 4px',
                            borderRadius: 4
                          }}
                        >
                          {sent}{' '}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
                    {q.prompt}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      Official Explanation:
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
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
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review Questions — Verbal Reasoning</h2>
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
                        background: currentIndex === idx ? 'rgba(144, 101, 176, 0.12)' : 'transparent',
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
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--accent-purple)', fontWeight: 600 }}>
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
              <span>Submit Verbal Section</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active Question View ──────────────────────────────────────────────────
  return (
    <div className="gre-exam-container">
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
              Verbal Reasoning Practice
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple)' }}>
              Question {currentIndex + 1} of {SET_SIZE}
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              {currentQ.category}
            </span>
          </div>

          {/* Reading Comprehension Standard Passage */}
          {currentQ.passage && (
            <div style={{
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxHeight: 260,
              overflowY: 'auto'
            }}>
              {currentQ.passageTitle && (
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 14 }}>
                  {currentQ.passageTitle}
                </div>
              )}
              {currentQ.passage}
            </div>
          )}

          {/* Select-in-Passage Interactive Passage Card */}
          {currentQ.type === 'reading_comprehension_select_passage' && currentQ.sentences && (
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              fontSize: 14.5,
              lineHeight: 1.75,
              color: 'var(--text-secondary)'
            }}>
              {currentQ.passageTitle && (
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, fontSize: 14 }}>
                  {currentQ.passageTitle}
                </div>
              )}
              {currentQ.sentences.map((sent, sIdx) => {
                const isSelected = answers[currentQ.id] === sIdx;
                return (
                  <span
                    key={sIdx}
                    onClick={() => handleSelectSentence(sIdx)}
                    className={`gre-sentence-span${isSelected ? ' selected' : ''}`}
                    title="Click to select this sentence"
                  >
                    {sent}{' '}
                  </span>
                );
              })}
            </div>
          )}

          {/* Prompt */}
          <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {currentQ.prompt}
          </div>

          {/* ── 1. Text Completion (Columns for 1, 2, or 3 Blanks) ── */}
          {currentQ.type.startsWith('text_completion') && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${currentQ.blanks.length}, 1fr)`,
              gap: 16,
              marginTop: 6
            }}>
              {currentQ.blanks.map((blank, bIdx) => {
                const selectedOpt = (answers[currentQ.id] || {})[bIdx];
                return (
                  <div
                    key={bIdx}
                    style={{
                      background: 'rgba(0,0,0,0.22)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--accent-purple)'
                    }}>
                      {blank.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {blank.options.map(opt => {
                        const isSel = selectedOpt === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectBlank(bIdx, opt)}
                            style={{
                              padding: '11px 14px',
                              textAlign: 'left',
                              fontSize: 13.5,
                              border: 'none',
                              borderBottom: '1px solid var(--border-subtle)',
                              background: isSel ? 'rgba(144, 101, 176, 0.22)' : 'transparent',
                              color: isSel ? '#ffffff' : 'var(--text-secondary)',
                              fontWeight: isSel ? 600 : 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <span style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                              background: isSel ? 'var(--accent-purple)' : 'transparent',
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 2. Sentence Equivalence (Select exactly 2) ── */}
          {currentQ.type === 'sentence_equivalence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Select the <strong style={{ color: 'var(--text-primary)' }}>TWO</strong> choices that complete the sentence and produce completed sentences alike in meaning.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {currentQ.options.map(opt => {
                  const selectedList = answers[currentQ.id] || [];
                  const isSel = selectedList.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleToggleSentenceEq(opt)}
                      style={{
                        padding: '11px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                        background: isSel ? 'rgba(144, 101, 176, 0.18)' : 'rgba(0,0,0,0.2)',
                        color: isSel ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isSel ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <span style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                        background: isSel ? 'var(--accent-purple)' : 'transparent',
                        display: 'inline-block',
                        flexShrink: 0
                      }} />
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. Reading Comprehension & Critical Reasoning Options ── */}
          {(currentQ.type === 'reading_comprehension_single' ||
            currentQ.type === 'reading_comprehension_multi' ||
            currentQ.type === 'critical_reasoning') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, oIdx) => {
                const isMulti = currentQ.type === 'reading_comprehension_multi';
                const userAns = answers[currentQ.id];
                const isSel = isMulti
                  ? Array.isArray(userAns) && userAns.includes(opt)
                  : userAns === opt;

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectRc(opt)}
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
                      alignItems: 'flex-start',
                      gap: 12,
                      lineHeight: 1.55
                    }}
                  >
                    <span style={{
                      width: 15,
                      height: 15,
                      borderRadius: isMulti ? 3 : '50%',
                      border: `1.5px solid ${isSel ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                      background: isSel ? 'var(--accent-blue)' : 'transparent',
                      display: 'inline-block',
                      marginTop: 3,
                      flexShrink: 0
                    }} />
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 4. Select-in-Passage Selection Feedback ── */}
          {currentQ.type === 'reading_comprehension_select_passage' && (
            <div style={{
              background: answers[currentQ.id] !== undefined ? 'rgba(82, 156, 202, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px dashed ${answers[currentQ.id] !== undefined ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13
            }}>
              <MousePointer size={16} color={answers[currentQ.id] !== undefined ? 'var(--accent-blue)' : 'var(--text-muted)'} />
              {answers[currentQ.id] !== undefined ? (
                <span>
                  Selected: <strong style={{ color: '#ffffff' }}>Sentence {answers[currentQ.id] + 1}</strong>: "{currentQ.sentences[answers[currentQ.id]].slice(0, 80)}..."
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  Click directly on any sentence in the passage above to select it as your answer.
                </span>
              )}
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
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Exit Verbal Practice?</h3>
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
