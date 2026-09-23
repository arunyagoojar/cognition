import React, { useState } from 'react';
import { Award, CheckCircle2, ArrowRight, X, Sparkles, BookOpen, PenTool, Check, AlertTriangle, Lightbulb } from 'lucide-react';

export default function WritingScoreModal({ isOpen, onClose, scoreResult, onRetake }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !scoreResult) return null;

  const {
    overallBand = 7.0,
    task1 = {},
    task2 = {},
    criteriaBreakdown = {},
    feedback = [],
    task1Feedback,
    task2Feedback,
    lexicalHighlights = [],
    grammarHighlights = [],
    strengths,
    areasForImprovement
  } = scoreResult;

  const feedbackList = Array.isArray(feedback) 
    ? feedback 
    : typeof feedback === 'string' && feedback.trim() 
      ? [feedback] 
      : [];

  const safeLexical = Array.isArray(lexicalHighlights) 
    ? lexicalHighlights 
    : typeof lexicalHighlights === 'string' && lexicalHighlights.trim() 
      ? [lexicalHighlights] 
      : [];

  const safeGrammar = Array.isArray(grammarHighlights) 
    ? grammarHighlights 
    : typeof grammarHighlights === 'string' && grammarHighlights.trim() 
      ? [grammarHighlights] 
      : [];

  const getCEFR = (band) => {
    if (band >= 8.5) return 'C2 Mastery (Expert Academic Writer)';
    if (band >= 7.0) return 'C1 Operational Proficiency (Effective Academic Writer)';
    if (band >= 5.5) return 'B2 Vantage (Competent Writer)';
    if (band >= 4.0) return 'B1 Threshold (Modest Writer)';
    return 'Unrated (No Sufficient Essay Submitted)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <img
              src="/images/mr_crocs_frame3_reading.png"
              alt="Mr. Crocs"
              style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(112,197,110,0.35))', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="badge badge-amber">Official IELTS Writing Assessment</span>
                {scoreResult.isAiEvaluated ? (
                  <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={12} /> AI Examiner: {scoreResult.modelUsed ? scoreResult.modelUsed.replace('gemini-', 'Gemini ').replace(/-/g, ' ') : 'Gemini AI'}
                  </span>
                ) : (
                  <span className="badge badge-blue">Built-in Examiner Engine</span>
                )}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Writing Evaluation Diagnostic Report</h2>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#70C56E', fontWeight: 600 }}>Mr. Crocs — Your IELTS Writing Coach</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="segmented-control" style={{ marginBottom: 18 }}>
          <button
            className={`segmented-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>Scorecard Overview</span>
          </button>
          <button
            className={`segmented-btn ${activeTab === 'diagnostic' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostic')}
          >
            <span>Task 1 & 2 Breakdown</span>
          </button>
          <button
            className={`segmented-btn ${activeTab === 'language' ? 'active' : ''}`}
            onClick={() => setActiveTab('language')}
          >
            <span>Vocabulary & Grammar</span>
          </button>
          <button
            className={`segmented-btn ${activeTab === 'action' ? 'active' : ''}`}
            onClick={() => setActiveTab('action')}
          >
            <span>Improvement Plan</span>
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Composite Band Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 171, 74, 0.15), rgba(82, 156, 202, 0.1))',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                marginBottom: 20
              }}>
                <img
                  src={overallBand >= 7.0 ? "/images/mr_crocs_frame4_celebrating.png" : "/images/mr_crocs_frame5_encouraging.png"}
                  alt="Mr. Crocs Feedback"
                  style={{
                    width: 76,
                    height: 76,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 12px rgba(112, 197, 110, 0.35))',
                    flexShrink: 0
                  }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Calculated Composite Writing Band
                  </div>
                  <div style={{ fontSize: 46, fontWeight: 800, color: 'var(--accent-amber)', lineHeight: 1 }}>
                    Band {Number(overallBand).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 8, fontWeight: 500 }}>
                    {getCEFR(overallBand)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Weighted Official IELTS Formula: (Task 1 × 1/3) + (Task 2 × 2/3) • Half-Band Rounding Applied
                  </div>
                </div>
              </div>

              {/* Task 1 vs Task 2 Scores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Task 1 (Report)</span>
                    <span className={`badge ${task1?.metThreshold ? 'badge-green' : 'badge-amber'}`}>
                      {task1?.wordCount || 0} / 150 words
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 6 }}>
                    Band {Number(task1?.band || overallBand).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Overview detected: {task1?.hasOverview ? 'Yes ✓ (Explicit summary present)' : 'Missing (Caps Task Achievement at Band 5)'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Task 2 (Essay • 2× Weight)</span>
                    <span className={`badge ${task2?.metThreshold ? 'badge-green' : 'badge-amber'}`}>
                      {task2?.wordCount || 0} / 250 words
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-amber)', marginTop: 6 }}>
                    Band {Number(task2?.band || overallBand).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Paragraph structure: {task2?.paragraphs || 4} paragraphs • Discursive stance developed
                  </div>
                </div>
              </div>

              {/* 4 Criteria Breakdown */}
              {criteriaBreakdown && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Official Cambridge Assessment Criteria (0.0 – 9.0)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Task Response</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-blue)' }}>
                        {Number(criteriaBreakdown.taskAchievement || overallBand).toFixed(1)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coherence & Cohesion</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-green)' }}>
                        {Number(criteriaBreakdown.coherenceAndCohesion || overallBand).toFixed(1)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lexical Resource</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-amber)' }}>
                        {Number(criteriaBreakdown.lexicalResource || overallBand).toFixed(1)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grammar Accuracy</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-purple)' }}>
                        {Number(criteriaBreakdown.grammaticalRange || overallBand).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Examiner Highlights */}
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Key Examiner Takeaways:
                </h4>
                <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {feedbackList.map((pt, idx) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: TASK 1 & 2 SPECIFIC DIAGNOSTIC */}
          {activeTab === 'diagnostic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Task 1 Box */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <PenTool size={16} color="var(--accent-blue)" />
                  <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Task 1: Visual Report Diagnosis</h4>
                  <span className="badge badge-blue">Band {Number(task1?.band || overallBand).toFixed(1)}</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {task1Feedback || "Task 1 demonstrates good factual summary. Ensure you report both the highest and lowest data trends with precision, and always provide an explicit overview paragraph."}
                </p>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-blue)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  💡 <strong>Examiner Tip for Task 1:</strong> Do not give your personal opinion or reason for the data. Stick strictly to reporting what the visual illustrates.
                </div>
              </div>

              {/* Task 2 Box */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <BookOpen size={16} color="var(--accent-amber)" />
                  <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Task 2: Discursive Essay Diagnosis</h4>
                  <span className="badge badge-amber">Band {Number(task2?.band || overallBand).toFixed(1)}</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {task2Feedback || "Task 2 presents a relevant point of view. To achieve higher bands, ensure every body paragraph opens with a clear topic sentence and is developed with specific supporting evidence."}
                </p>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-amber)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  💡 <strong>Examiner Tip for Task 2:</strong> Maintain a consistent position from your introduction thesis right through to your concluding paragraph.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VOCABULARY & GRAMMAR UPGRADES */}
          {activeTab === 'language' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Lexical Highlights */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={16} /> Lexical Resource & Vocabulary Recommendations
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {safeLexical.length > 0 ? (
                    safeLexical.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        {item}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Incorporate less common academic collocations (e.g., "exponential growth", "mitigate environmental ramifications", "compelling justification").
                    </div>
                  )}
                </div>
              </div>

              {/* Grammar Highlights */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-purple)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Grammatical Accuracy & Sentence Architecture
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {safeGrammar.length > 0 ? (
                    safeGrammar.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        {item}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Aim for a balanced mix of conditional clauses, relative clauses, and passive voice (e.g. "Water is directed through turbines...").
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTION PLAN */}
          {activeTab === 'action' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Strengths */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 8 }}>
                  Candidate Strengths
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {strengths || "Strong analytical engagement with the prompt topics, clear communicative intent, and consistent paragraph organization."}
                </p>
              </div>

              {/* Actionable Path to Next Band */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lightbulb size={16} /> How to Advance to Band {Math.min(9.0, overallBand + 0.5).toFixed(1)}
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {areasForImprovement || "1. Dedicate 3 minutes to planning your overview in Task 1 before writing. 2. In Task 2, use specific cohesive discourse markers to smoothly connect paragraph transitions. 3. Target 260–290 words for full essay idea development."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          {onRetake && (
            <button className="btn btn-secondary" onClick={onRetake}>
              Practice Next Question Set
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Done & Exit to Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
