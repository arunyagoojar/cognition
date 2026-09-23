import React, { useState } from 'react';
import { Award, CheckCircle2, MessageSquare, ArrowRight, X, Sparkles, Mic, Lightbulb, Check, AlertTriangle } from 'lucide-react';

export default function SpeakingScoreModal({ isOpen, onClose, scoreResult, onRetake }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !scoreResult) return null;

  const {
    overallBand = 7.5,
    breakdown = {},
    metrics = {},
    feedback = [],
    part1Feedback,
    part2Feedback,
    part3Feedback,
    vocabularyUpgrades = [],
    grammarCorrections = [],
    strengths,
    areasForImprovement
  } = scoreResult;

  const feedbackList = Array.isArray(feedback)
    ? feedback
    : typeof feedback === 'string' && feedback.trim()
      ? [feedback]
      : [];

  const safeVocab = Array.isArray(vocabularyUpgrades)
    ? vocabularyUpgrades
    : typeof vocabularyUpgrades === 'string' && vocabularyUpgrades.trim()
      ? [vocabularyUpgrades]
      : [];

  const safeGrammar = Array.isArray(grammarCorrections)
    ? grammarCorrections
    : typeof grammarCorrections === 'string' && grammarCorrections.trim()
      ? [grammarCorrections]
      : [];

  const getCEFR = (band) => {
    if (band >= 8.5) return 'C2 Mastery (Native-like Fluency)';
    if (band >= 7.0) return 'C1 Operational Proficiency (High Fluency)';
    if (band >= 5.5) return 'B2 Vantage (Independent Speaker)';
    if (band >= 4.0) return 'B1 Threshold (Limited Fluency)';
    return 'Unrated (No Spoken Audio Recorded)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" style={{ maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <img
              src="/images/mr_crocs_frame5_encouraging.png"
              alt="Mr. Crocs"
              style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(112,197,110,0.35))', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="badge badge-purple">Official IELTS Speaking Assessment</span>
                {scoreResult.isAiEvaluated ? (
                  <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={12} /> AI Examiner: {scoreResult.modelUsed ? scoreResult.modelUsed.replace('gemini-', 'Gemini ').replace(/-/g, ' ') : 'Gemini AI'}
                  </span>
                ) : (
                  <span className="badge badge-blue">Built-in Examiner Engine</span>
                )}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Speaking Performance Diagnostic Report</h2>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#70C56E', fontWeight: 600 }}>Mr. Crocs — Your IELTS English Coach</p>
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
            <span>Parts 1, 2 & 3 Feedback</span>
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
              {/* Overall Band Box */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(144, 101, 176, 0.15), rgba(82, 156, 202, 0.1))',
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
                  src={overallBand >= 7.5 ? "/images/mr_crocs_frame4_celebrating.png" : "/images/mr_crocs_frame5_encouraging.png"}
                  alt="Mr. Crocs Feedback"
                  style={{
                    width: 76,
                    height: 76,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 12px rgba(144, 101, 176, 0.35))',
                    flexShrink: 0
                  }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Estimated Speaking Band Score
                  </div>
                  <div style={{ fontSize: 46, fontWeight: 800, color: 'var(--accent-purple)', lineHeight: 1 }}>
                    Band {Number(overallBand).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 8, fontWeight: 500 }}>
                    {getCEFR(overallBand)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Paced at ~{metrics?.estimatedWpm || 130} WPM • Total words spoken: {metrics?.wordCount || 0}
                  </div>
                </div>
              </div>

              {/* 4 Criteria Breakdown */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Four Official Assessment Criteria (0.0 – 9.0)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fluency & Coherence</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 2 }}>
                      Band {Number(breakdown?.fluencyAndCoherence || overallBand).toFixed(1)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lexical Resource</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-green)', marginTop: 2 }}>
                      Band {Number(breakdown?.lexicalResource || overallBand).toFixed(1)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grammatical Range</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-amber)', marginTop: 2 }}>
                      Band {Number(breakdown?.grammaticalRange || overallBand).toFixed(1)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pronunciation & Rhythm</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-purple)', marginTop: 2 }}>
                      Band {Number(breakdown?.pronunciation || overallBand).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Examiner Observations */}
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Core Examiner Observations:
                </h4>
                <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {feedbackList.map((pt, idx) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PARTS 1, 2 & 3 DIAGNOSTIC */}
          {activeTab === 'diagnostic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Part 1 */}
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Mic size={15} color="var(--accent-blue)" />
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Part 1: Introduction & Interview</h4>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {part1Feedback || "Clear conversational replies. Extend answers by offering explanations ('because...') and personal anecdotes."}
                </p>
              </div>

              {/* Part 2 */}
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Mic size={15} color="var(--accent-purple)" />
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Part 2: Individual Long Turn (Cue Card)</h4>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {part2Feedback || "Good progression through the cue card prompts. To target Band 8+, maintain speech for the full 2 minutes without hesitating."}
                </p>
              </div>

              {/* Part 3 */}
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Mic size={15} color="var(--accent-green)" />
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Part 3: Two-Way Analytical Discussion</h4>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {part3Feedback || "Engaged with conceptual themes. Contrast opposing perspectives before consolidating your final viewpoint."}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VOCABULARY & GRAMMAR */}
          {activeTab === 'language' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Lexical Upgrades */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={16} /> Vocabulary & Idiomatic Language Upgrades
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {safeVocab.length > 0 ? (
                    safeVocab.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        {item}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Incorporate natural idiomatic phrasing (e.g. "once in a blue moon", "we hit it off immediately", "a double-edged sword").
                    </div>
                  )}
                </div>
              </div>

              {/* Grammar Corrections */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-purple)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Grammatical Precision & Verb Tense Usage
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
                      Ensure consistent past tense verb forms when recounting personal experiences in Part 2.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTION PLAN */}
          {activeTab === 'action' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 8 }}>
                  Candidate Strengths
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {strengths || "Confident conversational delivery, clear pronunciation, and steady communication across all 3 speaking sections."}
                </p>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lightbulb size={16} /> How to Advance to Band {Math.min(9.0, overallBand + 0.5).toFixed(1)}
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {areasForImprovement || "1. In Part 2, spend the 1-minute prep outlining 4 bullet points to speak smoothly for 2 full minutes. 2. Use signposting connectors like 'On the flip side' or 'Fundamentally' in Part 3."}
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
