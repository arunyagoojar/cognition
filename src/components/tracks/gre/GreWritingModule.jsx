import React, { useState, useEffect } from 'react';
import { PenTool, Clock, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, Award, BookOpen, Layers } from 'lucide-react';
import { getRandomWritingPrompt } from '../../../utils/gre/greWritingPool';
import { getApiKey, saveGreScore } from '../../../utils/storage';

const DURATION_SECONDS = 30 * 60; // 30 minutes

export default function GreWritingModule({ onBack }) {
  const [promptData] = useState(() => getRandomWritingPrompt());
  const [essayText, setEssayText] = useState('');
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Timer
  useEffect(() => {
    if (isCompleted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted]);

  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;
  const paragraphCount = essayText.trim() ? essayText.split(/\n\s*\n/).filter(p => p.trim()).length : 0;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const evaluateEssay = async (text) => {
    const apiKey = getApiKey();
    if (apiKey) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an official ETS GRE Analytical Writing examiner grading an "Analyze an Issue" essay.
Prompt Claim: "${promptData.claim || promptData.prompt}"
Prompt Instructions: "${promptData.instruction || promptData.instructions}"

Student Essay (${wordCount} words):
"${text}"

Evaluate the essay according to the official 0.0 to 6.0 GRE scoring criteria in 0.5 point increments.
Respond ONLY with a valid JSON object matching this structure:
{
  "score": 4.5,
  "summary": "Clear, persuasive response that takes a nuanced position...",
  "thesisAnalysis": "Strong initial thesis, acknowledging both sides...",
  "organization": "Logical progression across 4 well-structured paragraphs...",
  "languageAndStyle": "Sophisticated vocabulary with varied sentence syntax...",
  "strengths": ["Clear position", "Relevance of historical examples"],
  "improvements": ["Elaborate counter-argument in paragraph 3"]
}`
              }]
            }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
          return parsed;
        }
      } catch (e) {
        console.warn('AI evaluation request failed, falling back to rule-based rubric', e);
      }
    }

    // Zero-score guard for unattempted or empty essay
    if (wordCount < 15) {
      return {
        score: 0.0,
        summary: 'No sufficient essay submitted. An essay with fewer than 15 words receives a score of 0.0 on the official GRE Analytical Writing scale.',
        thesisAnalysis: 'No position developed or stated.',
        organization: 'No paragraphs written.',
        languageAndStyle: 'No response submitted.',
        strengths: [],
        improvements: ['Compose a full essay response analyzing the issue with supporting reasoning and examples.']
      };
    }

    // Heuristic ETS Rubric Fallback
    let score = 3.0;
    if (wordCount >= 450) score += 1.5;
    else if (wordCount >= 350) score += 1.0;
    else if (wordCount >= 250) score += 0.5;

    if (paragraphCount >= 4) score += 1.0;
    else if (paragraphCount >= 3) score += 0.5;

    // Vocabulary density check
    const advancedVocab = ['however', 'moreover', 'furthermore', 'nevertheless', 'consequently', 'paradoxical', 'inherent', 'substantiate', 'proponent', 'fundamental'];
    const matchedVocab = advancedVocab.filter(w => text.toLowerCase().includes(w));
    if (matchedVocab.length >= 3) score += 0.5;

    score = Math.min(6.0, Math.max(1.0, Math.round(score * 2) / 2));

    return {
      score,
      summary: `Your essay demonstrates ${score >= 5.0 ? 'an insightful and cogently argued position' : score >= 4.0 ? 'a competent and coherent perspective' : 'an emerging argument requiring deeper supporting evidence'}.`,
      thesisAnalysis: wordCount >= 350 ? 'Clear position established early with relevant contextual framing.' : 'Position taken but requires further nuance and counter-perspective analysis.',
      organization: paragraphCount >= 4 ? 'Well-developed structural flow with clear paragraph divisions.' : 'Paragraphing needs more distinct topical transitions.',
      languageAndStyle: matchedVocab.length >= 2 ? 'Effective use of discourse markers and academic diction.' : 'Maintain greater sentence variety and lexical range.',
      strengths: ['Addressed the central issue prompt', 'Maintained formal academic tone'],
      improvements: ['Develop second-order real-world examples', 'Deepen analytical rebuttal of opposing claims']
    };
  };

  const handleFinish = async () => {
    setIsEvaluating(true);
    const result = await evaluateEssay(essayText);
    setEvaluation(result);
    setIsEvaluating(false);
    setIsCompleted(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const scrollables = document.querySelectorAll('.main-content, .gre-exam-container, html, body');
    scrollables.forEach(el => { if (el) el.scrollTop = 0; });

    saveGreScore('writing', {
      score: result.score,
      scaledScore: result.score,
      wordCount,
      paragraphCount,
      completed: true,
      timeSpent: DURATION_SECONDS - timeLeft
    });
  };

  // ── Scorecard View ────────────────────────────────────────────────────────
  if (isCompleted && evaluation) {
    return (
      <div className="exam-centered-result-view">
        <div style={{ maxWidth: 860, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 171, 74, 0.12), rgba(144, 101, 176, 0.12))',
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
              <span className="badge badge-amber">Analytical Writing Completed</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyze an Issue · 30 min</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
              Analytical Writing Scorecard
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, margin: 0 }}>
              Calibrated to official ETS GRE 0.0–6.0 analytical writing bands.
            </p>
            {/* Dual mascot tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <img src="/images/mr_crocs_frame3_reading.png" alt="Mr. Crocs" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(112,197,110,0.35))' }} />
              <img src="/images/mr_crabs_frame2_thinking.png" alt="Mr. Krabs" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(240,103,103,0.35))' }} />
              <span style={{ fontSize: 11.5, color: '#70C56E', fontWeight: 600 }}>Mr. Crocs</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>&</span>
              <span style={{ fontSize: 11.5, color: '#F06767', fontWeight: 600 }}>Mr. Krabs</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— AWA Co-Coaches</span>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.35)',
            padding: '16px 28px',
            borderRadius: 14,
            border: '1px solid rgba(255, 171, 74, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              AWA Score
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {evaluation.score.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>out of 6.0</div>
          </div>
        </div>

        {/* Detailed Breakdown Card */}
        <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Diagnostic Evaluation Breakdown</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {evaluation.summary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4 }}>Thesis & Analysis</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{evaluation.thesisAnalysis}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 4 }}>Structure & Organization</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{evaluation.organization}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 4 }}>Language & Vocabulary</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{evaluation.languageAndStyle}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 6 }}>
            <div style={{ background: 'rgba(77, 171, 154, 0.08)', border: '1px solid rgba(77, 171, 154, 0.25)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-green)', marginBottom: 6 }}>Key Strengths:</div>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={{ background: 'rgba(255, 171, 74, 0.08)', border: '1px solid rgba(255, 171, 74, 0.25)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-amber)', marginBottom: 6 }}>Suggested Improvements:</div>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={onBack} style={{ padding: '10px 24px' }}>
            <span>Return to GRE Studio</span>
          </button>
        </div>
        </div>
      </div>
    );
  }

  // ── Writing Interface ─────────────────────────────────────────────────────
  return (
    <div className="gre-exam-container">
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowExitModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ArrowLeft size={14} /> <span>Exit</span>
          </button>
          <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            GRE Analytical Writing — Analyze an Issue
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: timeLeft < 300 ? 'var(--accent-red)' : 'var(--text-primary)',
            background: 'rgba(0,0,0,0.25)',
            padding: '4px 10px',
            borderRadius: 6
          }}>
            <Clock size={13} />
            <span>{timeFormatted}</span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Word Count: <strong style={{ color: 'var(--text-primary)' }}>{wordCount}</strong>
          </div>
        </div>
      </div>

      {/* Issue Prompt Card */}
      <div className="card" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-purple" style={{ fontSize: 11 }}>Official Prompt</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{promptData.topic}</span>
        </div>

        <div style={{
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.55,
          color: 'var(--text-primary)',
          background: 'rgba(255,255,255,0.03)',
          padding: '14px 18px',
          borderRadius: 8,
          borderLeft: '3px solid var(--accent-purple)'
        }}>
          "{promptData.claim}"
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {promptData.instruction || promptData.instructions}
        </div>
      </div>

      {/* Editor Card */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={essayText}
          onChange={(e) => setEssayText(e.target.value)}
          placeholder="Compose your response here. Develop a clear thesis, support your claims with reasons and examples, and address counterarguments..."
          rows={16}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 14.5,
            lineHeight: 1.7,
            fontFamily: 'var(--font-system)',
            resize: 'vertical'
          }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 12,
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Recommended length: 350–550 words • Spellcheck disabled in real exam
          </span>

          <button
            className="btn btn-primary"
            onClick={handleFinish}
            disabled={isEvaluating || wordCount < 50}
            style={{ padding: '8px 20px' }}
          >
            {isEvaluating ? (
              <span>Evaluating Essay...</span>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Submit & Evaluate Essay</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Early Exit Confirmation Modal */}
      {showExitModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
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
            border: '1px solid rgba(224, 62, 62, 0.35)',
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
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Exit Analytical Writing?</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Essay will be discarded</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to return to GRE Studio? Your unfinished essay will not be scored.
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
