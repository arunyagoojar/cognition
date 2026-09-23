import React, { useState } from 'react';
import CountdownTimer from '../common/CountdownTimer';
import WritingScoreModal from './WritingScoreModal';
import ExitConfirmationModal from '../common/ExitConfirmationModal';
import ExitScreen from '../common/ExitScreen';
import { Award, ZoomIn, ArrowLeft, ArrowRight, Send, CheckCircle2 } from 'lucide-react';
import { evaluateWritingLocally, evaluateWritingWithGemini } from '../../utils/writingScorer';
import { saveSkillScore, getApiKey, recordAttemptedQuestionSet } from '../../utils/storage';
import { getNextWritingTask, WRITING_TASK_POOLS } from '../../data/questionPools/writingPool';

export default function WritingModule({ testData, onComplete, isExamMode = false, onBackToDashboard }) {
  // Initialize writing task set from unattempted primary pool (randomized initial start, or specific setId for regression verification)
  const [taskSelection, setTaskSelection] = useState(() => {
    const requestedSetId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('setId') : null;
    if (requestedSetId) {
      const match = WRITING_TASK_POOLS.find(p => p.id === requestedSetId);
      if (match) {
        return {
          task: match,
          poolInfo: {
            attemptedCount: 0,
            totalCount: WRITING_TASK_POOLS.length,
            remainingInPool: WRITING_TASK_POOLS.length,
            isCycleReset: false
          }
        };
      }
    }
    return getNextWritingTask();
  });
  const currentWritingTaskSet = taskSelection.task;

  const [activeTask, setActiveTask] = useState(1);
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');
  const [showModels, setShowModels] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Exit confirmation and Exit Screen state
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Score modal state
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showModal') === '1';
  });
  const [scoreResult, setScoreResult] = useState(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showModal') === '1') {
      return {
        overallBand: 7.0,
        task1: {
          band: 7.0,
          wordCount: 168,
          hasOverview: true,
          metThreshold: true
        },
        task2: {
          band: 7.0,
          wordCount: 284,
          paragraphs: 4,
          metThreshold: true
        },
        criteria: {
          taskResponse: 7.0,
          coherence: 7.5,
          lexical: 7.0,
          grammar: 7.0
        },
        feedback: "Diagnostic Evaluation Completed. Strong cohesive progression and appropriate lexical choices."
      };
    }
    return null;
  });
  const [isEvaluating, setIsEvaluating] = useState(false);

  const countWords = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const task1Words = countWords(task1Text);
  const task2Words = countWords(task2Text);

  const currentTaskData = activeTask === 1 ? currentWritingTaskSet.task1 : currentWritingTaskSet.task2;
  const currentWordCount = activeTask === 1 ? task1Words : task2Words;
  const minRequired = currentTaskData.minWords;

  // Handle next randomized unattempted task
  const handlePracticeNext = () => {
    const nextSelection = getNextWritingTask(currentWritingTaskSet.id);
    setTaskSelection(nextSelection);
    setActiveTask(1);
    setTask1Text('');
    setTask2Text('');
    setShowModels(false);
    setScoreResult(null);
    setIsSubmitted(false);
  };

  // Progression check before exiting (only true if there is unsubmitted text)
  const hasProgress = (task1Text.trim().length > 0 || task2Text.trim().length > 0) && !isSubmitted;

  const handleBackClick = () => {
    if (hasProgress && !isExamMode) {
      setIsExitModalOpen(true);
    } else if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    setTask1Text('');
    setTask2Text('');
    setIsExited(true);
  };

  const handleCloseScoreModal = () => {
    setIsScoreModalOpen(false);
    if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  // Strict score commit: calculated ONLY on explicit submit
  const handleSubmitWriting = async () => {
    setIsEvaluating(true);
    try {
      const apiKey = getApiKey();
      let result = null;

      if (apiKey) {
        try {
          result = await evaluateWritingWithGemini(
            apiKey,
            task1Text,
            task2Text,
            { task1: currentWritingTaskSet.task1.prompt, task2: currentWritingTaskSet.task2.prompt }
          );
        } catch (err) {
          console.warn('Gemini evaluation failed, falling back to local scoring:', err);
        }
      }

      if (!result) {
        result = evaluateWritingLocally(task1Text, task2Text);
      }

      setScoreResult(result);
      setIsSubmitted(true);
      setIsScoreModalOpen(true);
      // Officially committed to scorecard and analytics ONLY here
      saveSkillScore('writing', result);
      // Record in attempted history so it goes into the attempted pool
      recordAttemptedQuestionSet('writing', currentWritingTaskSet.id);

      if (onComplete) {
        onComplete(result);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isExited) {
    return (
      <ExitScreen
        sectionTitle="IELTS Academic Writing Practice"
        onReturnToDashboard={() => {
          setIsExited(false);
          if (onBackToDashboard) onBackToDashboard();
        }}
        onRestart={() => {
          setIsExited(false);
          handlePracticeNext();
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBackToDashboard && !isExamMode && (
            <button
              className="btn btn-ghost"
              onClick={handleBackClick}
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              <ArrowLeft size={15} />
              <span>Back to Dashboard</span>
            </button>
          )}

          <div className="segmented-control">
            <button
              className={`segmented-btn ${activeTask === 1 ? 'active' : ''}`}
              onClick={() => setActiveTask(1)}
            >
              <span>Task 1 (Report)</span>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                {task1Words} / 150 words
              </span>
            </button>
            <button
              className={`segmented-btn ${activeTask === 2 ? 'active' : ''}`}
              onClick={() => setActiveTask(2)}
            >
              <span>Task 2 (Essay)</span>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                {task2Words} / 250 words
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Subtle Pool Status Indicator (No interactive shuffle button) */}
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-amber)'
            }} />
            <span>Unattempted Pool • {taskSelection.poolInfo?.remainingInPool || 1} of {taskSelection.poolInfo?.totalCount || 3}</span>
          </div>

          {!isExamMode && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowModels(!showModels)}
              style={{ fontSize: 12.5 }}
            >
              <Award size={15} color="var(--accent-amber)" />
              <span>{showModels ? 'Hide Model Answers' : 'View Band 8+ Models'}</span>
            </button>
          )}

          <CountdownTimer initialMinutes={activeTask === 1 ? 20 : 40} isActive={true} />

          <button
            className="btn btn-primary"
            onClick={handleSubmitWriting}
            disabled={isEvaluating}
            style={{
              background: 'linear-gradient(135deg, #e9b949, #d97706)',
              color: '#111',
              fontWeight: 600,
              fontSize: 13.5
            }}
          >
            {isEvaluating ? (
              <span>Evaluating...</span>
            ) : (
              <>
                <Send size={14} />
                <span>Submit Writing for Score</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Task Set Title Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
          {currentWritingTaskSet.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          IELTS Academic Writing Format
        </span>
      </div>

      {/* Side-by-Side Prompt & Editor with LOCKED layout */}
      <div className="writing-layout">
        {/* Left: Prompt & Map Image (Independently Scrollable) */}
        <div className="writing-prompt-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge badge-amber">{currentTaskData.title}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Suggested: {currentTaskData.timeSuggestedMinutes} minutes
            </span>
          </div>

          <div style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            background: 'var(--bg-card)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--accent-amber)',
            whiteSpace: 'pre-line'
          }}>
            {currentTaskData.prompt}
          </div>

          {/* Task 1 Image if present */}
          {activeTask === 1 && currentTaskData.image && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Exam Visual Diagram / Material</span>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setIsImageZoomed(true)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  <ZoomIn size={14} />
                  <span>Enlarge Full View</span>
                </button>
              </div>

              <div 
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
                onClick={() => setIsImageZoomed(true)}
                title="Click to zoom in"
              >
                <img
                  src={currentTaskData.image}
                  alt="IELTS Task 1 Visual"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '380px',
                    height: 'auto',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-sm)',
                    display: 'inline-block'
                  }}
                />
              </div>
            </div>
          )}

          {/* Model Answers Accordion */}
          {showModels && (
            <div style={{
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16
            }}>
              {activeTask === 1 ? (
                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span className="badge badge-green" style={{ marginBottom: 6 }}>{currentWritingTaskSet.task1.modelBand8.band}</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {currentWritingTaskSet.task1.modelBand8.text}
                  </pre>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span className="badge badge-green" style={{ marginBottom: 6 }}>{currentWritingTaskSet.task2.modelBand85.band}</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {currentWritingTaskSet.task2.modelBand85.text}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Locked Essay Editor */}
        <div className="writing-editor-card">
          <div className="word-count-meter">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Words:</span>
              <span style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: 15, 
                fontWeight: 700,
                color: currentWordCount >= minRequired ? 'var(--accent-green)' : 'var(--accent-amber)'
              }}>
                {currentWordCount}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                / {minRequired} minimum
              </span>
            </div>

            <span className={`badge ${currentWordCount >= minRequired ? 'badge-green' : 'badge-neutral'}`}>
              {currentWordCount >= minRequired ? 'Requirement Met' : `${minRequired - currentWordCount} words to go`}
            </span>
          </div>

          <textarea
            className="writing-textarea"
            placeholder={activeTask === 1 ? "Begin summarizing the Task 1 diagram/map here..." : "Write your Task 2 essay response here..."}
            value={activeTask === 1 ? task1Text : task2Text}
            onChange={(e) => {
              if (activeTask === 1) setTask1Text(e.target.value);
              else setTask2Text(e.target.value);
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Unsubmitted attempts are not added to your scorecard</span>
            <span>IELTS Academic Writing Criteria: TR • CC • LR • GRA</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Navigation Bar (Always visible without scrolling) */}
      <div className="sticky-bottom-action-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${currentWordCount >= minRequired ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 13, padding: '5px 12px' }}>
            {activeTask === 1 ? 'Task 1 (Report)' : 'Task 2 (Essay)'}: {currentWordCount} / {minRequired} words
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {currentWordCount >= minRequired ? 'Minimum requirement fulfilled ✓' : `${minRequired - currentWordCount} words remaining`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeTask === 2 && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setActiveTask(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ borderRadius: 'var(--radius-pill)', padding: '9px 18px', fontSize: 13 }}
            >
              <ArrowLeft size={14} />
              <span>Previous: Task 1</span>
            </button>
          )}

          {activeTask === 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setActiveTask(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 22px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-blue), #1a6cb8)',
                boxShadow: '0 4px 14px rgba(35, 131, 226, 0.35)',
                fontWeight: 600
              }}
            >
              <span>Next Section: Task 2 (Essay)</span>
              <ArrowRight size={15} />
            </button>
          ) : isSubmitted ? (
            <button
              className="btn btn-primary"
              onClick={onBackToDashboard}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-green), #16a34a)',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CheckCircle2 size={16} />
              <span>Evaluation Complete • Return to Dashboard</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmitWriting}
              disabled={isEvaluating}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-amber), #d97706)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                fontWeight: 600
              }}
            >
              {isEvaluating ? (
                <span>Evaluating with Examiner AI...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Writing for Evaluation</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scorecard Modal */}
      <WritingScoreModal
        isOpen={isScoreModalOpen}
        onClose={handleCloseScoreModal}
        scoreResult={scoreResult}
        onRetake={handlePracticeNext}
      />

      {/* Exit Confirmation Guard Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Writing Practice Session"
      />

      {/* Enlarged Map Modal */}
      {isImageZoomed && currentTaskData.image && (
        <div className="modal-overlay" onClick={() => setIsImageZoomed(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 960, background: '#191919', padding: 24 }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Task 1 Visual Material — Full High Resolution</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{currentWritingTaskSet.title}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setIsImageZoomed(false)}>Close</button>
            </div>
            <div style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              textAlign: 'center',
              maxHeight: '75vh',
              overflowY: 'auto'
            }}>
              <img 
                src={currentTaskData.image} 
                alt="Diagram Enlarged" 
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', display: 'inline-block' }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
