import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, CheckCircle2, XCircle, Lightbulb, ChevronRight, HelpCircle, Award, RotateCcw } from 'lucide-react';
import { generateFigureSequenceTask } from '../../../utils/dmat/figureSequencesEngine';
import ExitConfirmationModal from '../../common/ExitConfirmationModal';
import { saveDmatScore } from '../../../utils/storage';

// Color map matching official dMAT and Careerwise palette
const COLOR_MAP = {
  black: '#0f172a', // Deep solid black for maximum contrast on white
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  pink: '#db2777',
  yellow: '#d97706'
};

export function SymbolRenderer({ symbol }) {
  const { shape, color, rotation } = symbol;
  const col = COLOR_MAP[color] || COLOR_MAP.black;

  let content = null;
  if (shape === 'square') {
    content = <div style={{ width: '70%', height: '70%', background: col, borderRadius: 2 }} />;
  } else if (shape === 'circle') {
    content = <div style={{ width: '70%', height: '70%', background: col, borderRadius: '50%' }} />;
  } else if (shape === 'triangle') {
    content = (
      <svg viewBox="0 0 100 100" style={{ width: '75%', height: '75%', fill: col }}>
        <polygon points="50,15 90,85 10,85" />
      </svg>
    );
  } else if (shape === 'arrow') {
    content = (
      <svg viewBox="0 0 100 100" style={{ width: '75%', height: '75%', fill: col }}>
        <polygon points="50,10 90,50 70,50 70,90 30,90 30,50 10,50" />
      </svg>
    );
  } else if (shape === 'L') {
    content = (
      <div style={{ width: '70%', height: '70%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '100%', background: col }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '35%', background: col }} />
      </div>
    );
  } else if (shape === 'cross') {
    content = (
      <div style={{ width: '70%', height: '70%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '33%', width: '34%', height: '100%', background: col }} />
        <div style={{ position: 'absolute', top: '33%', left: 0, width: '100%', height: '34%', background: col }} />
      </div>
    );
  } else if (shape === 'semicircle') {
    content = (
      <div style={{ width: '70%', height: '70%', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: '200%', borderRadius: '50%', background: col }} />
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `rotate(${rotation || 0}deg)`,
      transition: 'transform 0.2s ease'
    }}>
      {content}
    </div>
  );
}

// 4x4 Grid Matrix Viewer with Crisp White Background and Solid Black Grid Lines
export function Matrix4x4({ matrix, size = 110, label = '', isTarget = false, isSelected = false, isCorrect = false, isWrong = false }) {
  if (isTarget) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: size, height: size,
          borderRadius: 4,
          background: '#ffffff',
          border: '2px dashed #000000',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(size * 0.28), fontWeight: 800, color: 'var(--accent-amber)'
        }}>
          ?
        </div>
        {label && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-amber)' }}>{label}</span>}
      </div>
    );
  }

  let outlineStyle = 'none';
  let shadow = '0 4px 14px rgba(0,0,0,0.25)';
  if (isCorrect) {
    outlineStyle = '3px solid var(--accent-green)';
    shadow = '0 0 16px rgba(77, 171, 154, 0.55)';
  } else if (isWrong) {
    outlineStyle = '3px solid var(--accent-red)';
    shadow = '0 0 16px rgba(235, 87, 87, 0.55)';
  } else if (isSelected) {
    outlineStyle = '3px solid var(--accent-blue)';
    shadow = '0 0 16px rgba(82, 156, 202, 0.55)';
  }

  // Map 16 cells
  const cells = Array.from({ length: 16 }, (_, idx) => {
    const sym = matrix?.symbols?.find(s => s.position === idx);
    return sym || null;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: '#ffffff',
        border: '2px solid #000000', // Outer solid black border
        outline: outlineStyle,
        outlineOffset: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        boxShadow: shadow,
        transition: 'all 0.15s ease',
        overflow: 'hidden'
      }}>
        {cells.map((sym, idx) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          return (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                borderRight: col < 3 ? '1.5px solid #000000' : 'none', // Proper black line separating columns
                borderBottom: row < 3 ? '1.5px solid #000000' : 'none', // Proper black line separating rows
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
              }}
            >
              {sym && <SymbolRenderer symbol={sym} />}
            </div>
          );
        })}
      </div>
      {label && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-red)' : isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)'
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

// Balanced difficulty cycle: Low -> Medium -> High -> Medium
const DIFFICULTY_CYCLE = ['low', 'medium', 'high', 'medium'];
const SET_SIZE = 20; // Official 20 series for Figure Sequences

export default function FigureSequencesModule({ onBack }) {
  const [taskCount, setTaskCount] = useState(0);
  const [task, setTask] = useState(() => generateFigureSequenceTask(DIFFICULTY_CYCLE[0]));
  const [selectedImg1, setSelectedImg1] = useState(null); // 0, 1, 2, 3
  const [selectedImg2, setSelectedImg2] = useState(null); // 0, 1, 2, 3
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
    if (!isCompleted && (score.total > 0 || isAnswered || selectedImg1 !== null || selectedImg2 !== null)) {
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

  const handleSubmit = () => {
    if (selectedImg1 === null || selectedImg2 === null || isAnswered) return;
    setIsAnswered(true);
    const img1Correct = selectedImg1 === task.image1.correctAnswer;
    const img2Correct = selectedImg2 === task.image2.correctAnswer;
    const bothCorrect = img1Correct && img2Correct;
    const newCorrect = score.correct + (bothCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore({ correct: newCorrect, total: newTotal });
    // NOTE: DO NOT save to storage here! Only save upon complete practice exam finish.
  };

  const handleNextTask = () => {
    if (taskCount >= SET_SIZE - 1) {
      const finalPct = Math.round((score.correct / SET_SIZE) * 100);
      saveDmatScore('figures', {
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
    setTask(generateFigureSequenceTask(nextDiff));
    setSelectedImg1(null);
    setSelectedImg2(null);
    setIsAnswered(false);
    setShowWalkthrough(false);
    setSecondsElapsed(0);
  };

  const handleRetake = () => {
    setTaskCount(0);
    setTask(generateFigureSequenceTask(DIFFICULTY_CYCLE[0]));
    setSelectedImg1(null);
    setSelectedImg2(null);
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
              background: 'rgba(144, 101, 176, 0.2)',
              color: '#9065b0',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Award size={30} />
            </div>
            <span className="badge badge-purple">Practice Exam Completed</span>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              {score.correct} / {SET_SIZE} Correct ({pct}%)
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Official Figure Sequences 20-Series Subtest Simulation. Your performance score has been saved to your analytics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', marginTop: 6 }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: '#9065b0' }}>{pct}%</div>
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

  const bothSelected = selectedImg1 !== null && selectedImg2 !== null;
  const isBothCorrect = isAnswered && selectedImg1 === task.image1.correctAnswer && selectedImg2 === task.image2.correctAnswer;
  const isPacingOver = secondsElapsed > 75;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ fontSize: 13, padding: '7px 14px' }}>
          ← Back to DMAT Studio
        </button>

        {/* Difficulty Badge (balanced mix, no manual switch) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-purple" style={{ textTransform: 'capitalize', fontSize: 11.5 }}>
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

          {/* Series progress badge */}
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: '#9065b0',
            background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)'
          }}>
            Series <strong>{taskCount + 1}</strong> of {SET_SIZE}
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
        sectionTitle="Figure Sequences"
      />

      {/* Main Container */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '26px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge badge-purple" style={{ fontSize: 11 }}>Subtest 3 · Figure Sequences (Official 4×4 Matrix)</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Difficulty: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{task.difficulty}</strong></span>
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
            Determine the next two matrices: Image 1 and Image 2
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Follow the symbol movement, rotation, and color rules across Matrices 1 to 4. Select the matching Matrix for <strong>Image 1</strong> and <strong>Image 2</strong> below.
          </p>
        </div>

        {/* 6-Matrix Sequence Display (All in one horizontal row, never wrapping) */}
        <div style={{
          background: 'var(--bg-canvas)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'nowrap',
          overflowX: 'auto'
        }}>
          {task.sequence.map((matrix, idx) => (
            <React.Fragment key={idx}>
              <Matrix4x4 matrix={matrix} size={86} label={`Matrix ${idx + 1}`} />
              <ArrowRight size={14} color="rgba(255,255,255,0.25)" />
            </React.Fragment>
          ))}

          {/* Targets: Image 1 & Image 2 */}
          <Matrix4x4 isTarget size={86} label="Image 1 (?)" />
          <ArrowRight size={14} color="rgba(255,255,255,0.25)" />
          <Matrix4x4 isTarget size={86} label="Image 2 (?)" />
        </div>

        {/* Dual Selection Panels: Image 1 and Image 2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20
        }}>
          {/* Panel 1: Image 1 Options */}
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-amber)' }}>
                1. Select Image 1 (Matrix 5):
              </span>
              {isAnswered && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: selectedImg1 === task.image1.correctAnswer ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {selectedImg1 === task.image1.correctAnswer ? '✓ Correct' : `✗ Correct was Matrix ${task.image1.correctAnswer + 1}`}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {task.image1.options.map((optMatrix, optIdx) => {
                const isSelected = selectedImg1 === optIdx;
                const isCorrectOpt = isAnswered && optIdx === task.image1.correctAnswer;
                const isWrongOpt = isAnswered && isSelected && optIdx !== task.image1.correctAnswer;

                return (
                  <div
                    key={optIdx}
                    onClick={() => !isAnswered && setSelectedImg1(optIdx)}
                    style={{ cursor: isAnswered ? 'default' : 'pointer' }}
                  >
                    <Matrix4x4
                      matrix={optMatrix}
                      size={85}
                      label={`Matrix ${optIdx + 1}`}
                      isSelected={isSelected}
                      isCorrect={isCorrectOpt}
                      isWrong={isWrongOpt}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel 2: Image 2 Options */}
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-amber)' }}>
                2. Select Image 2 (Matrix 6):
              </span>
              {isAnswered && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: selectedImg2 === task.image2.correctAnswer ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {selectedImg2 === task.image2.correctAnswer ? '✓ Correct' : `✗ Correct was Matrix ${task.image2.correctAnswer + 1}`}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {task.image2.options.map((optMatrix, optIdx) => {
                const isSelected = selectedImg2 === optIdx;
                const isCorrectOpt = isAnswered && optIdx === task.image2.correctAnswer;
                const isWrongOpt = isAnswered && isSelected && optIdx !== task.image2.correctAnswer;

                return (
                  <div
                    key={optIdx}
                    onClick={() => !isAnswered && setSelectedImg2(optIdx)}
                    style={{ cursor: isAnswered ? 'default' : 'pointer' }}
                  >
                    <Matrix4x4
                      matrix={optMatrix}
                      size={85}
                      label={`Matrix ${optIdx + 1}`}
                      isSelected={isSelected}
                      isCorrect={isCorrectOpt}
                      isWrong={isWrongOpt}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit & Next Action Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          {!isAnswered ? (
            <button
              className="btn btn-primary"
              disabled={!bothSelected}
              onClick={handleSubmit}
              style={{
                padding: '10px 24px', fontSize: 13.5, fontWeight: 600,
                opacity: bothSelected ? 1 : 0.5,
                background: 'linear-gradient(135deg, #ffab4a, #d97706)'
              }}
            >
              Submit Both Images
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700,
                color: isBothCorrect ? 'var(--accent-green)' : 'var(--accent-amber)'
              }}>
                {isBothCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>{isBothCorrect ? 'Both matrices correctly identified!' : `Image 1: Matrix ${task.image1.correctAnswer + 1} · Image 2: Matrix ${task.image2.correctAnswer + 1}`}</span>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleNextTask}
                style={{
                  padding: '10px 22px', fontSize: 13.5, fontWeight: 600,
                  background: 'linear-gradient(135deg, #2383e2, #529cca)',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <span>{taskCount >= SET_SIZE - 1 ? 'Finish Practice Exam & View Scorecard' : 'Next Figure Task'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Solution Walkthrough Accordion */}
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
                  src="/images/mr_crabs_frame4_explaining.png"
                  alt="Mr. Krabs"
                  style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.3))' }}
                />
                <span>Mr. Krabs' Transformation Rule Breakdown</span>
              </div>
              <ChevronRight
                size={16}
                style={{ transform: showWalkthrough ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>

            {showWalkthrough && (
              <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {task.explanation.map((rule, idx) => (
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
                        background: 'rgba(144, 101, 176, 0.15)',
                        color: '#9065b0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span>{rule}</span>
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
                    <span>Shape transformations follow rigid geometric paths. Track border traversals and clockwise rotations independently before confirming your matrices.</span>
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
