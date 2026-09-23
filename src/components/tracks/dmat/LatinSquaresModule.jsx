import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, RotateCcw, CheckCircle2, XCircle, ChevronRight, Award } from 'lucide-react';
import { generateLatinSquareTask } from '../../../utils/dmat/latinSquareEngine';
import ExitConfirmationModal from '../../common/ExitConfirmationModal';
import { saveDmatScore } from '../../../utils/storage';

const DIFFICULTY_CYCLE = ['low', 'medium', 'high', 'medium'];
const SET_SIZE = 16; // Official 16 tasks for Latin Squares

export default function LatinSquaresModule({ onBack }) {
  const [taskCount, setTaskCount] = useState(0);
  const [task, setTask] = useState(() => generateLatinSquareTask(DIFFICULTY_CYCLE[0]));
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Pacing timer (ticks every second)
  useEffect(() => {
    if (isAnswered || isCompleted) return;
    const interval = setInterval(() => {
      setSecondsElapsed(s => s + 1);
      setTotalSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isAnswered, isCompleted]);

  // Auto-scroll to top when completed so the centered scorecard is immediately visible
  useEffect(() => {
    if (isCompleted) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const scrollables = document.querySelectorAll('.main-content, .page-view-enter, .dmat-exam-container, html, body');
      scrollables.forEach(el => { if (el) el.scrollTop = 0; });
    }
  }, [isCompleted]);

  const handleBack = () => {
    if (!isCompleted && (score.total > 0 || isAnswered || selectedLetter !== null)) {
      setIsExitModalOpen(true);
    } else {
      onBack();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    // Explicitly do NOT save score when exiting early
    onBack();
  };

  // Keyboard shortcut listener for A, B, C, D, E and Enter
  useEffect(() => {
    if (isCompleted) return;
    const handleKeyDown = (e) => {
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        if (!isAnswered) {
          handleSelect(key);
        }
      } else if (e.key === 'Enter') {
        if (isAnswered) {
          handleNextTask();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, selectedLetter, isCompleted, taskCount, score]);

  const handleSelect = (letter) => {
    if (isAnswered) return;
    setSelectedLetter(letter);
    setIsAnswered(true);
    const isCorrect = letter === task.correctAnswer;
    const newCorrect = score.correct + (isCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore({ correct: newCorrect, total: newTotal });
    // NOTE: DO NOT save to storage here! Only save upon complete practice exam finish.
  };

  const handleNextTask = () => {
    if (taskCount >= SET_SIZE - 1) {
      // Completed full practice exam!
      const finalPct = Math.round((score.correct / SET_SIZE) * 100);
      saveDmatScore('latin', {
        correct: score.correct,
        total: SET_SIZE,
        percentage: finalPct,
        completed: true
      });
      setIsCompleted(true);
      return;
    }

    const nextCount = taskCount + 1;
    setTaskCount(nextCount);
    const nextDiff = DIFFICULTY_CYCLE[nextCount % DIFFICULTY_CYCLE.length];
    setTask(generateLatinSquareTask(nextDiff));
    setSelectedLetter(null);
    setIsAnswered(false);
    setShowWalkthrough(false);
    setSecondsElapsed(0);
  };

  const handleRetake = () => {
    setTaskCount(0);
    setTask(generateLatinSquareTask(DIFFICULTY_CYCLE[0]));
    setSelectedLetter(null);
    setIsAnswered(false);
    setShowWalkthrough(false);
    setSecondsElapsed(0);
    setTotalSeconds(0);
    setScore({ correct: 0, total: 0 });
    setIsCompleted(false);
  };

  if (isCompleted) {
    const pct = Math.round((score.correct / SET_SIZE) * 100);
    const avgPace = Math.round(totalSeconds / SET_SIZE) || 45;
    return (
      <div className="exam-centered-result-view">
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18
          }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: 'rgba(77, 171, 154, 0.2)',
            color: 'var(--accent-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Award size={30} />
          </div>
          <span className="badge badge-green">Practice Exam Completed</span>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
            {score.correct} / {SET_SIZE} Correct ({pct}%)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Official Latin Squares 16-Task Subtest Simulation. Your performance score has been saved to your analytics.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', marginTop: 6 }}>
            <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: 'var(--accent-green)' }}>{pct}%</div>
            </div>
            <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Pace</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{avgPace}s / 75s</div>
            </div>
            <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Est. Standard</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: 'var(--accent-blue)' }}>{Math.round(80 + pct * 0.4)} / 120</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={handleRetake}>
              <RotateCcw size={14} />
              <span>Retake Practice Exam</span>
            </button>
            <button className="btn btn-primary" onClick={onBack}>
              <span>Return to DMAT Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

  const isCorrect = selectedLetter === task.correctAnswer;
  const isPacingOver = secondsElapsed > 75; // Official dMAT recommended pacing is 75s

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top navigation & control bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ fontSize: 13, padding: '7px 14px' }}>
          ← Back to DMAT Studio
        </button>

        {/* Difficulty Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-green" style={{ textTransform: 'capitalize', fontSize: 11.5 }}>
            {task.difficulty || 'Balanced'} Difficulty
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Balanced Official Mix
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Pacing indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
            color: isPacingOver ? 'var(--accent-red)' : 'var(--accent-amber)',
            background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Clock size={13} />
            <span>Time: <strong>{secondsElapsed}s</strong> / 75s pacing</span>
          </div>

          {/* Task progress badge */}
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--accent-green)',
            background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)'
          }}>
            Task <strong>{taskCount + 1}</strong> of {SET_SIZE}
          </div>

          {/* Running score */}
          <div style={{
            fontSize: 12.5, color: 'var(--text-muted)',
            background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)'
          }}>
            Session: <strong style={{ color: 'var(--accent-green)' }}>{score.correct}</strong> / {score.total} correct
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Latin Squares"
      />

      {/* Main card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-green" style={{ fontSize: 11 }}>Subtest 1 · Latin Squares</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target Cell: <strong>{task.targetLabel}</strong></span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              Determine the letter for the marked cell [?]
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Each letter <strong>A, B, C, D, E</strong> appears exactly once in each row and column. Do not solve the entire grid.
            </p>
          </div>
          <div style={{
            fontSize: 11.5, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
          }}>
            Mental deduction only · No notes
          </div>
        </div>

        {/* Grid and Keypad layout */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '10px 0' }}>
          {/* 5x5 Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 54px)',
            gridTemplateRows: 'repeat(5, 54px)',
            gap: 6,
            background: 'var(--bg-canvas)',
            padding: 12,
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--border-default)'
          }}>
            {task.grid.map((row, r) =>
              row.map((cell, c) => {
                const isTarget = r === task.target.r && c === task.target.c;
                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      width: 54,
                      height: 54,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isTarget ? 22 : 18,
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 'var(--radius-sm)',
                      background: isTarget
                        ? isAnswered
                          ? isCorrect
                            ? 'rgba(77, 171, 154, 0.25)'
                            : 'rgba(235, 87, 87, 0.25)'
                          : 'rgba(255, 171, 74, 0.22)'
                        : cell
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.015)',
                      border: isTarget
                        ? isAnswered
                          ? isCorrect
                            ? '2px solid var(--accent-green)'
                            : '2px solid var(--accent-red)'
                          : '2px solid var(--accent-amber)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: isTarget
                        ? isAnswered
                          ? isCorrect
                            ? 'var(--accent-green)'
                            : 'var(--accent-red)'
                          : 'var(--accent-amber)'
                        : cell
                        ? 'var(--text-primary)'
                        : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isTarget && isAnswered ? selectedLetter : cell || (isTarget ? '?' : '')}
                  </div>
                );
              })
            )}
          </div>

          {/* Keypad and Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 220 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
              Select Answer (Keypad or press A–E):
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {['A', 'B', 'C', 'D', 'E'].map(letter => {
                const isThisSelected = selectedLetter === letter;
                const isThisCorrect = letter === task.correctAnswer;
                let bg = 'var(--bg-canvas)';
                let border = '1px solid var(--border-default)';
                let color = 'var(--text-primary)';

                if (isAnswered) {
                  if (isThisCorrect) {
                    bg = 'rgba(77, 171, 154, 0.25)';
                    border = '2px solid var(--accent-green)';
                    color = 'var(--accent-green)';
                  } else if (isThisSelected && !isThisCorrect) {
                    bg = 'rgba(235, 87, 87, 0.25)';
                    border = '2px solid var(--accent-red)';
                    color = 'var(--accent-red)';
                  }
                }

                return (
                  <button
                    key={letter}
                    disabled={isAnswered}
                    onClick={() => handleSelect(letter)}
                    style={{
                      height: 48,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      background: bg,
                      border: border,
                      color: color,
                      cursor: isAnswered ? 'default' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Answer banner */}
            {isAnswered && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: isCorrect ? 'rgba(77, 171, 154, 0.12)' : 'rgba(235, 87, 87, 0.12)',
                border: isCorrect ? '1px solid rgba(77, 171, 154, 0.3)' : '1px solid rgba(235, 87, 87, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: isCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{isCorrect ? 'Correct Deduction!' : `Incorrect (Correct: ${task.correctAnswer})`}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Solved in {secondsElapsed}s {isPacingOver ? '(exceeded 75s pace)' : '(within 75s target)'}
                </div>
              </div>
            )}

            {/* Next task CTA */}
            {isAnswered && (
              <button
                className="btn btn-primary"
                onClick={handleNextTask}
                style={{
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #2383e2, #529cca)'
                }}
              >
                <span>{taskCount >= SET_SIZE - 1 ? 'Finish Practice Exam & View Scorecard' : 'Next Task (Press Enter)'}</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* 3-Part Explanation System: How to Solve / Future Rules / 30-Sec Shortcut */}
        {isAnswered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Card 1: How to Solve This Question */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowWalkthrough(!showWalkthrough)}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <span>1. How to Solve This Question</span>
                </div>
                <ChevronRight
                  size={16}
                  style={{ transform: showWalkthrough ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </button>

              {showWalkthrough && (
                <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 10px 0' }}>
                    Step-by-step deduction to find <strong style={{ color: 'var(--accent-amber)' }}>{task.targetLabel}</strong>:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {task.steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(255, 171, 74, 0.15)',
                          color: 'var(--accent-amber)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0
                        }}>
                          {idx + 1}
                        </span>
                        <span>{step.text}</span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      fontSize: 12.5, fontWeight: 700,
                      color: 'var(--accent-green)',
                      background: 'rgba(77, 171, 154, 0.1)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(77, 171, 154, 0.25)'
                    }}>
                      <span>✅</span>
                      <span>Therefore {task.targetLabel} = <strong>{task.correctAnswer}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Mr. Krabs — Strict Mathematical Axioms */}
            <div style={{
              background: 'rgba(240, 103, 103, 0.06)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(240, 103, 103, 0.22)',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <img
                  src="/images/mr_crabs_frame3_teaching.png"
                  alt="Mr. Krabs"
                  style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F06767' }}>
                  Mr. Krabs' Strict Mathematical Axioms
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { rule: 'Axiom 1 (Row Constraint) — Every letter (A–E) appears strictly once per row. If 4 distinct letters are already placed, the 5th is forced with absolute certainty.' },
                  { rule: 'Axiom 2 (Column Constraint) — Every column is an identical permutation set. Locate 4 entries and eliminate them; the vacant cell admits only one valid conclusion.' },
                  { rule: 'Axiom 3 (Deterministic Intersection) — Intersect the row exclusions with column exclusions. Guesswork is unacceptable; mathematical elimination guarantees the exact letter.' },
                ].map((item, i) => (
                  <div key={i} style={{
                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(240, 103, 103, 0.12)'
                  }}>
                    {item.rule}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Mr. Krabs — Instant Pivot Technique */}
            <div style={{
              background: 'rgba(255, 171, 74, 0.07)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255, 171, 74, 0.25)',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <img
                  src="/images/mr_crabs_frame4_explaining.png"
                  alt="Mr. Krabs"
                  style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(255,171,74,0.3))' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-amber)' }}>
                  Mr. Krabs' Rapid Intersection Pivot
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  '① Cross-examine the target row: discard all letters present in that row immediately.',
                  '② Cross-examine the target column: discard remaining letters present in that column.',
                  '③ Exactly one letter survives this double filter. Execute your selection without hesitation.',
                  '⏱ Disciplined candidates complete this in under 10 seconds. Focus your vision strictly on the crosshairs.'
                ].map((tip, i) => (
                  <div key={i} style={{
                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255, 171, 74, 0.12)'
                  }}>
                    {tip}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
