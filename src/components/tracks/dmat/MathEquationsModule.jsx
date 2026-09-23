import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, RotateCcw, CheckCircle2, XCircle, Lightbulb, ChevronRight, Layers, Award } from 'lucide-react';
import { generateMathEquationTask } from '../../../utils/dmat/mathEquationsEngine';
import ExitConfirmationModal from '../../common/ExitConfirmationModal';
import { saveDmatScore } from '../../../utils/storage';

const DIFFICULTY_CYCLE = ['low', 'medium', 'high', 'medium'];
const SET_SIZE = 20; // Official 20 tasks for Mathematical Equations

export default function MathEquationsModule({ onBack }) {
  const [taskCount, setTaskCount] = useState(0);
  const [task, setTask] = useState(() => generateMathEquationTask(DIFFICULTY_CYCLE[0]));
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isAnswered || isCompleted) return;
    const interval = setInterval(() => {
      setSecondsElapsed(s => s + 1);
      setTotalSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isAnswered, isCompleted]);

  const handleBack = () => {
    if (!isCompleted && (score.total > 0 || isAnswered || selectedAnswer !== null)) {
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

  const handleSelect = (val) => {
    if (isAnswered) return;
    setSelectedAnswer(val);
    setIsAnswered(true);
    const isCorrect = val === task.correctAnswer;
    const newCorrect = score.correct + (isCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore({ correct: newCorrect, total: newTotal });
    // NOTE: DO NOT save to storage here! Only save upon complete practice exam finish.
  };

  const handleNextTask = () => {
    if (taskCount >= SET_SIZE - 1) {
      const finalPct = Math.round((score.correct / SET_SIZE) * 100);
      saveDmatScore('math', {
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
    setTask(generateMathEquationTask(nextDiff));
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowWalkthrough(false);
    setSecondsElapsed(0);
  };

  const handleRetake = () => {
    setTaskCount(0);
    setTask(generateMathEquationTask(DIFFICULTY_CYCLE[0]));
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowWalkthrough(false);
    setSecondsElapsed(0);
    setTotalSeconds(0);
    setScore({ correct: 0, total: 0 });
    setIsCompleted(false);
  };

  // Auto-scroll to top when completed so the centered scorecard is immediately visible
  useEffect(() => {
    if (isCompleted) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const scrollables = document.querySelectorAll('.main-content, .page-view-enter, .dmat-exam-container, html, body');
      scrollables.forEach(el => { if (el) el.scrollTop = 0; });
    }
  }, [isCompleted]);

  if (isCompleted) {
    const pct = Math.round((score.correct / SET_SIZE) * 100);
    const avgPace = Math.round(totalSeconds / SET_SIZE) || 50;
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
              background: 'rgba(82, 156, 202, 0.2)',
              color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Award size={30} />
            </div>
            <span className="badge badge-blue">Practice Exam Completed</span>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              {score.correct} / {SET_SIZE} Correct ({pct}%)
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Official Mathematical Equations 20-Task Subtest Simulation. Your performance score has been saved to your analytics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', marginTop: 6 }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: 'var(--accent-blue)' }}>{pct}%</div>
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

  const isCorrect = selectedAnswer === task.correctAnswer;
  const isPacingOver = secondsElapsed > 75;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ fontSize: 13, padding: '7px 14px' }}>
          ← Back to DMAT Studio
        </button>

        {/* Difficulty Badge (balanced mix, no manual switch) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-blue" style={{ textTransform: 'capitalize', fontSize: 11.5 }}>
            {task.difficulty} Difficulty
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Balanced Official Mix
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
            fontSize: 12.5, fontWeight: 600, color: 'var(--accent-blue)',
            background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)'
          }}>
            Task <strong>{taskCount + 1}</strong> of {SET_SIZE}
          </div>

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
        sectionTitle="Mathematical Equations"
      />

      {/* Main Container - Split View: Left (Equations Vertical) | Right (Questions & Options) */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        {/* Header line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-blue">Mathematical Equations</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Difficulty: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{task.difficulty}</strong></span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Variables: Integers between 1 and 20</span>
        </div>

        {/* 2-Column Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 28,
          alignItems: 'start'
        }}>
          {/* Left Column: Strictly Vertical Equations List */}
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
                System of Equations:
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {task.equations.length} equations
              </span>
            </div>

            {/* Vertical Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {task.equations.map((eq, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    fontSize: 19,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  <span style={{
                    fontSize: 11.5,
                    color: 'var(--accent-blue)',
                    background: 'rgba(82, 156, 202, 0.15)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 600,
                    flexShrink: 0
                  }}>
                    ({i + 1})
                  </span>
                  <span>{eq}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              • No scratchpad or calculator allowed.<br />
              • Each letter corresponds to exactly one integer.
            </div>
          </div>

          {/* Right Column: Question Prompt & Answer Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent-blue)', fontWeight: 600 }}>
                Target Unknown
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0 0', letterSpacing: -0.4, color: 'var(--text-primary)' }}>
                {task.questionText}
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Determine the single integer value that satisfies the system.
              </p>
            </div>

            {/* Options Grid */}
            <div>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, display: 'block', marginBottom: 10 }}>
                Select Value:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {task.options.map(val => {
                  const isSelected = selectedAnswer === val;
                  const isCorrectVal = val === task.correctAnswer;
                  let bg = 'var(--bg-canvas)';
                  let border = '1px solid var(--border-default)';
                  let color = 'var(--text-primary)';

                  if (isAnswered) {
                    if (isCorrectVal) {
                      bg = 'rgba(77, 171, 154, 0.25)';
                      border = '2px solid var(--accent-green)';
                      color = 'var(--accent-green)';
                    } else if (isSelected && !isCorrectVal) {
                      bg = 'rgba(235, 87, 87, 0.25)';
                      border = '2px solid var(--accent-red)';
                      color = 'var(--accent-red)';
                    }
                  } else if (isSelected) {
                    bg = 'rgba(82, 156, 202, 0.2)';
                    border = '2px solid var(--accent-blue)';
                  }

                  return (
                    <button
                      key={val}
                      disabled={isAnswered}
                      onClick={() => handleSelect(val)}
                      style={{
                        height: 52,
                        borderRadius: 'var(--radius-md)',
                        fontSize: 20,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        background: bg,
                        border: border,
                        color: color,
                        cursor: isAnswered ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {task.targetVariable} =
                      </span>
                      <span>{val}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Answer banner & Next button */}
            {isAnswered && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isCorrect ? 'rgba(77, 171, 154, 0.12)' : 'rgba(235, 87, 87, 0.12)',
                  border: isCorrect ? '1px solid rgba(77, 171, 154, 0.3)' : '1px solid rgba(235, 87, 87, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: isCorrect ? 'var(--accent-green)' : 'var(--accent-red)'
                }}>
                  {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <span>{isCorrect ? `Correct! ${task.targetVariable} = ${task.correctAnswer}` : `Incorrect. Correct is ${task.targetVariable} = ${task.correctAnswer}`}</span>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleNextTask}
                  style={{
                    padding: '11px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #2383e2, #529cca)'
                  }}
                >
                  <span>{taskCount >= SET_SIZE - 1 ? 'Finish Practice Exam & View Scorecard' : 'Next Equation Task'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step-by-Step Substitution Walkthrough */}
        {isAnswered && (
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
                <img
                  src="/images/mr_crabs_frame3_teaching.png"
                  alt="Mr. Krabs"
                  style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                />
                <span>Mr. Krabs' Algebraic Solution Path</span>
              </div>
              <ChevronRight
                size={16}
                style={{ transform: showWalkthrough ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>

            {showWalkthrough && (
              <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {task.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <span style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'rgba(82, 156, 202, 0.15)',
                        color: 'var(--accent-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span>{step.text}</span>
                    </div>
                  ))}
                  <div style={{
                    marginTop: 4,
                    background: 'rgba(240, 103, 103, 0.06)',
                    border: '1px solid rgba(240, 103, 103, 0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <strong style={{ color: '#F06767', whiteSpace: 'nowrap' }}>Mr. Krabs' Rule:</strong>
                    <span>Isolate variables with pure integer operations. Double-check sign flips when transposing terms across the equals sign.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
