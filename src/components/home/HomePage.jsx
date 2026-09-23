import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedCard } from '../../utils/animations';
import { 
  CheckCircle2, RotateCcw, Sparkles, ArrowRight, 
  Clock, ShieldCheck, ChevronRight, Settings, X
} from 'lucide-react';
import { 
  getUserProfile, 
  saveUserProfile, 
  getAllTrackScores, 
  getAllAttemptHistory 
} from '../../utils/storage';
import { playButtonTap, playCardSelect, playOnboardingSuccess } from '../../utils/soundEffects';

// ── Inject global keyframe animations once ──────────────────────────────────
const ANIMATION_STYLES = [
  '@keyframes ob-backdrop-in { from { opacity: 0; } to { opacity: 1; } }',
  '@keyframes ob-card-in { from { opacity: 0; transform: translateY(28px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }',
  '@keyframes ob-step-slide-in { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }',
  '@keyframes ob-step-slide-back { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }',
  '@keyframes ob-mascot-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }',
  '@keyframes ob-checkmark-pop { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }',
  '@keyframes card-fade-up { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }',
  '@keyframes home-hero-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }',
  '@keyframes pulse-dot { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.3); } 50% { box-shadow: 0 0 0 5px rgba(56,189,248,0); } }',
].join('\n');

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cognition-anim-styles')) return;
  const el = document.createElement('style');
  el.id = 'cognition-anim-styles';
  el.textContent = ANIMATION_STYLES;
  document.head.appendChild(el);
}

// ── Onboarding Overlay Modal ─────────────────────────────────────────────────
function OnboardingOverlay({ isOpen, onClose, onComplete, initialProfile }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('forward');
  const [name, setName] = useState(initialProfile.name || '');
  const [selectedExams, setSelectedExams] = useState(
    initialProfile.targetExams?.length ? initialProfile.targetExams : ['IELTS', 'GRE', 'DMAT']
  );
  const stepKey = step + '-' + direction;

  useEffect(() => { if (isOpen) injectStyles(); }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const goNext = () => { playButtonTap(); setDirection('forward'); setStep(p => p + 1); };
  const goBack = () => { playButtonTap(); setDirection('back'); setStep(p => p - 1); };

  const toggleExam = (id) => {
    const willSelect = !selectedExams.includes(id);
    setSelectedExams(prev => {
      if (prev.includes(id)) { if (prev.length === 1) return prev; return prev.filter(e => e !== id); }
      return [...prev, id];
    });
    playCardSelect(willSelect);
  };

  const handleFinish = () => {
    playOnboardingSuccess();
    const updated = saveUserProfile({ name: name.trim() || 'Scholar', targetExams: selectedExams, onboarded: true });
    setTimeout(() => onComplete(updated), 380);
  };

  const stepAnim = direction === 'forward'
    ? 'ob-step-slide-in 0.32s cubic-bezier(0.22,1,0.36,1) both'
    : 'ob-step-slide-back 0.32s cubic-bezier(0.22,1,0.36,1) both';

  const progressPct = ((step / 3) * 100) + '%';

  return createPortal(
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      width:'100vw', height:'100vh', zIndex:999999,
      background:'rgba(5,8,15,0.88)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px', boxSizing:'border-box',
      animation:'ob-backdrop-in 0.3s ease both'
    }}>
      <div style={{
        background:'linear-gradient(145deg,#181B26 0%,#0F1118 100%)',
        border:'1px solid rgba(255,255,255,0.14)',
        borderRadius:'var(--radius-xl)', width:'100%', maxWidth:640,
        boxShadow:'0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
        overflow:'hidden', position:'relative',
        animation:'ob-card-in 0.42s cubic-bezier(0.22,1,0.36,1) both'
      }}>
        {/* Animated progress bar */}
        <div style={{ height:3, background:'rgba(255,255,255,0.06)', position:'relative' }}>
          <div style={{
            position:'absolute', top:0, left:0, height:'100%',
            width: progressPct,
            background:'linear-gradient(90deg,var(--accent-blue),#818cf8)',
            borderRadius:99, transition:'width 0.45s cubic-bezier(0.22,1,0.36,1)'
          }} />
        </div>

        {/* Header */}
        <div style={{ padding:'22px 30px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/images/logo.svg" alt="Cognition" style={{ width:34, height:34, objectFit:'contain' }} />
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)' }}>Welcome to Cognition</div>
              <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>Step {step} of 3 · Candidate Setup</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            {[1,2,3].map(s => (
              <div key={s} style={{
                width: s === step ? 18 : 8, height:8, borderRadius:99,
                background: s === step ? 'var(--accent-blue)' : s < step ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.12)',
                transition:'all 0.35s ease',
                animation: s === step ? 'pulse-dot 1.8s ease infinite' : 'none'
              }} />
            ))}
          </div>
          {initialProfile.onboarded && (
            <button onClick={() => { playButtonTap(); onClose(); }}
              style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:6, display:'flex', alignItems:'center', borderRadius:'var(--radius-sm)' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step body */}
        <div style={{ padding:'26px 30px', minHeight:268 }}>
          <div key={stepKey} style={{ animation: stepAnim }}>

            {step === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div style={{ textAlign:'center', paddingBottom:4 }}>
                  <div style={{ fontSize:40, marginBottom:10, display:'inline-block', animation:'ob-mascot-float 3.5s ease-in-out infinite' }}>👋</div>
                  <div><span style={{ display:'inline-block', padding:'3px 12px', borderRadius:99, background:'rgba(56,189,248,0.15)', color:'var(--accent-blue)', fontSize:11, fontWeight:700, marginBottom:8 }}>CANDIDATE IDENTITY</span></div>
                  <h3 style={{ fontSize:21, fontWeight:800, margin:'4px 0 8px', color:'var(--text-primary)' }}>What should we call you?</h3>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 auto', lineHeight:1.5, maxWidth:400 }}>
                    We'll personalize your preparation plans, track your scores, and tailor coach advice to your profile.
                  </p>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:7, textTransform:'uppercase', letterSpacing:0.6 }}>Your Name or Alias</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Alex Henderson"
                    style={{ width:'100%', padding:'13px 16px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--border-subtle)', background:'rgba(0,0,0,0.35)', color:'var(--text-primary)', fontSize:15, fontWeight:600, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor='var(--accent-blue)'}
                    onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') goNext(); }}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div style={{ textAlign:'center', paddingBottom:4 }}>
                  <div style={{ fontSize:36, marginBottom:10, display:'inline-block', animation:'ob-mascot-float 3s ease-in-out infinite' }}>🎯</div>
                  <div><span style={{ display:'inline-block', padding:'3px 12px', borderRadius:99, background:'rgba(56,189,248,0.15)', color:'var(--accent-blue)', fontSize:11, fontWeight:700, marginBottom:8 }}>TARGET TRACKS</span></div>
                  <h3 style={{ fontSize:21, fontWeight:800, margin:'4px 0 8px', color:'var(--text-primary)' }}>Which exams are you preparing for?</h3>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 auto', lineHeight:1.5, maxWidth:400 }}>
                    Choose one or multiple. Your dashboard filters recommendations accordingly.
                  </p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { id:'IELTS', title:'IELTS Academic', desc:'Listening, Reading, Writing Task 1 & 2, Speaking', emoji:'🗣️' },
                    { id:'GRE',   title:'GRE General Test', desc:'Quantitative Reasoning, Verbal Reasoning & Analytical Writing', emoji:'📊' },
                    { id:'DMAT',  title:'dMAT Assessment', desc:'Latin Squares, Math Equations, Figure Sequences & Critical Logic', emoji:'🧩' },
                  ].map((exam, i) => {
                    const sel = selectedExams.includes(exam.id);
                    return (
                      <div key={exam.id} onClick={() => toggleExam(exam.id)} style={{
                        padding:'13px 18px', borderRadius:'var(--radius-lg)',
                        border: '1.5px solid ' + (sel ? 'var(--accent-blue)' : 'var(--border-subtle)'),
                        background: sel ? 'rgba(56,189,248,0.09)' : 'var(--bg-elevated)',
                        cursor:'pointer', display:'flex', alignItems:'center', gap:14,
                        transition:'all 0.18s ease',
                        animation: 'card-fade-up 0.32s ' + (i * 0.07) + 's cubic-bezier(0.22,1,0.36,1) both',
                        transform: sel ? 'scale(1.01)' : 'scale(1)'
                      }}>
                        <span style={{ fontSize:22, flexShrink:0 }}>{exam.emoji}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{exam.title}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>{exam.desc}</div>
                        </div>
                        <div style={{
                          width:22, height:22, borderRadius:'50%', flexShrink:0,
                          border: '1.5px solid ' + (sel ? 'var(--accent-blue)' : 'var(--border-subtle)'),
                          background: sel ? 'var(--accent-blue)' : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.18s'
                        }}>
                          {sel && <div style={{ animation:'ob-checkmark-pop 0.2s ease both' }}><CheckCircle2 size={15} color="#000" strokeWidth={3} /></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div style={{ textAlign:'center', paddingBottom:4 }}>
                  <div style={{ fontSize:36, marginBottom:10, display:'inline-block', animation:'ob-mascot-float 2.8s ease-in-out infinite' }}>🤝</div>
                  <div><span style={{ display:'inline-block', padding:'3px 12px', borderRadius:99, background:'rgba(56,189,248,0.15)', color:'var(--accent-blue)', fontSize:11, fontWeight:700, marginBottom:8 }}>MEET YOUR COACHES</span></div>
                  <h3 style={{ fontSize:21, fontWeight:800, margin:'4px 0 8px', color:'var(--text-primary)' }}>Your Dual Preparation Coaches</h3>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 auto', lineHeight:1.5, maxWidth:420 }}>
                    Two AI mentors guide you through all practice drills and mock simulations.
                  </p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                    borderRadius:'var(--radius-lg)',
                    background:'linear-gradient(135deg,rgba(16,185,129,0.08) 0%,var(--bg-elevated) 100%)',
                    border:'1px solid rgba(112,197,110,0.3)',
                    animation:'card-fade-up 0.35s 0.05s cubic-bezier(0.22,1,0.36,1) both'
                  }}>
                    <img src="/images/mr_crocs_frame3_reading.png" alt="Mr. Crocs" style={{ width:58, height:58, objectFit:'contain', flexShrink:0, filter:'drop-shadow(0 3px 10px rgba(112,197,110,0.35))', animation:'ob-mascot-float 3s ease-in-out infinite' }} />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:15, fontWeight:800, color:'#70C56E' }}>Mr. Crocs</span>
                        <span style={{ padding:'2px 8px', borderRadius:99, background:'rgba(112,197,110,0.15)', color:'#70C56E', fontSize:10.5, fontWeight:700 }}>English & Vocabulary</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>Analyzes speaking fluency, writing structure, reading comprehension & GRE verbal. Pinpoints vocabulary upgrades and grammatical precision.</div>
                    </div>
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                    borderRadius:'var(--radius-lg)',
                    background:'linear-gradient(135deg,rgba(239,68,68,0.08) 0%,var(--bg-elevated) 100%)',
                    border:'1px solid rgba(240,103,103,0.3)',
                    animation:'card-fade-up 0.35s 0.13s cubic-bezier(0.22,1,0.36,1) both'
                  }}>
                    <img src="/images/mr_crabs_frame4_explaining.png" alt="Mr. Krabs" style={{ width:58, height:58, objectFit:'contain', flexShrink:0, filter:'drop-shadow(0 3px 10px rgba(240,103,103,0.35))', animation:'ob-mascot-float 3.5s 0.5s ease-in-out infinite' }} />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:15, fontWeight:800, color:'#F06767' }}>Mr. Krabs</span>
                        <span style={{ padding:'2px 8px', borderRadius:99, background:'rgba(240,103,103,0.15)', color:'#F06767', fontSize:10.5, fontWeight:700 }}>Quantitative & Spatial Logic</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>Oversees GRE Quant drills & dMAT modules (Latin squares, math balancing, figure sequences). Provides rapid calculation shortcuts and elimination strategies.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 30px 22px', borderTop:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={goBack} style={{ fontSize:13 }}>Back</button>
          ) : <div />}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={goNext} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13.5, fontWeight:700 }}>
              <span>Next Step</span><ChevronRight size={15} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13.5, fontWeight:700, padding:'10px 26px' }}>
              <Sparkles size={15} /><span>Enter Dashboard</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// AnimatedCard is now imported from shared utility

// ── Main HomePage Component ────────────────────────────────────────────────
export default function HomePage({ onNavigateTrack, onNavigateModule }) {
  const [profile, setProfile] = useState(() => getUserProfile());
  const [showOnboarding, setShowOnboarding] = useState(!profile.onboarded);
  const allScores = useMemo(() => getAllTrackScores(), []);
  const attemptHistory = useMemo(() => getAllAttemptHistory(), []);

  useEffect(() => { injectStyles(); }, []);

  const continueItems = useMemo(() => attemptHistory.slice(0, 3), [attemptHistory]);

  const { crocsPointers, krabsPointers } = useMemo(() => {
    const { ielts, gre, dmat } = allScores;
    const crocs = [];
    if (ielts?.speaking?.breakdown) {
      const b = ielts.speaking.breakdown;
      if (b.lexicalResource && b.lexicalResource < 7.0) {
        crocs.push('Your Speaking Lexical Resource scored Band ' + b.lexicalResource + '. Work on incorporating idiomatic academic collocations (e.g., \'striking resemblance\', \'profound implication\') instead of general adjectives.');
      } else {
        crocs.push('Excellent vocabulary breadth in Speaking! Maintain spontaneous rhythm and natural intonation to preserve Band 7.5+ in Fluency.');
      }
    }
    if (ielts?.writing?.criteriaBreakdown) {
      const cb = ielts.writing.criteriaBreakdown;
      if (cb.taskAchievement && cb.taskAchievement < 7.0) {
        crocs.push('In Writing Task 1, ensure you write a dedicated "Overall..." sentence. Without an explicit overview, the band score cannot exceed 5.0 in Task Achievement.');
      } else {
        crocs.push('Strong structural progression in Writing! Ensure paragraph transitions deploy cohesive logical linkers rather than mechanical bulleting.');
      }
    }
    if (gre?.verbal) {
      if (gre.verbal.scaledScore && gre.verbal.scaledScore < 158) {
        crocs.push('In GRE Verbal (Score: ' + gre.verbal.scaledScore + '), focus on Sentence Equivalence: find the synonym pair before reading answer traps, and always verify whether the sentence mood is positive or negative.');
      } else {
        crocs.push('High verbal acumen detected! Keep training on high-tier academic prose from philosophy and economics to sharpen dense reading comprehension speed.');
      }
    }
    if (crocs.length === 0) {
      crocs.push('Welcome! I specialize in English, rhetorical flow, and vocabulary mastery across IELTS and GRE Verbal. Take your first Speaking, Writing, or Verbal practice test so I can analyze your lexical precision.');
      crocs.push('Tip for today: In reading and speaking, notice how tone pivot words ("nevertheless", "in spite of", "paradoxically") completely shift the argument direction.');
    }
    const krabs = [];
    if (gre?.quant) {
      if (gre.quant.scaledScore && gre.quant.scaledScore < 162) {
        krabs.push('In GRE Quant (Score: ' + gre.quant.scaledScore + '), do NOT calculate exact values for Quantitative Comparison! Always test extreme boundaries: -1, 0, 1/2, and 1 to spot hidden constraints.');
      } else {
        krabs.push('Formidable calculation accuracy! Protect your time budget: solve single-choice algebra in under 60 seconds to bank reserves for complex Data Interpretation tables.');
      }
    }
    if (dmat?.latin) {
      if (dmat.latin.percentage < 80) {
        krabs.push('In dMAT Latin Squares (Accuracy: ' + dmat.latin.percentage + '%), find the row or column containing 3 known symbols first. Intersect it with empty cells to find guaranteed deterministic placements without guesswork.');
      } else {
        krabs.push('Sharp grid deduction speed in Latin Squares! Practice rapid scanning of dual-symbol coordinates to reduce completion time below 40 seconds per grid.');
      }
    }
    if (dmat?.math && dmat.math.percentage < 80) {
      krabs.push('For dMAT Math Equation balancing, prioritize operator precedence (PEMDAS) and eliminate odd/even arithmetic mismatches before doing manual calculations.');
    }
    if (dmat?.figures && dmat.figures.percentage < 80) {
      krabs.push('In dMAT Figure Sequences, break the complex shape into 2 individual layers (e.g. outer rotation vs inner shading) and track them independently.');
    }
    if (krabs.length === 0) {
      krabs.push('Ahoy scholar! I specialize in quantitative problem solving, mathematical shortcuts, and spatial deduction across GRE Quant and dMAT.');
      krabs.push('To establish your mathematical diagnostic baseline, dive into a quick GRE Quantitative set or dMAT Latin Squares module below!');
    }
    return { crocsPointers: crocs.slice(0, 2), krabsPointers: krabs.slice(0, 2) };
  }, [allScores]);

  const suggestedItems = useMemo(() => {
    const list = [];
    const targets = profile.targetExams || ['IELTS', 'GRE', 'DMAT'];
    const { ielts, gre, dmat } = allScores;
    if (targets.includes('IELTS')) {
      if (!ielts?.speaking) list.push({ track:'IELTS', module:'speaking', title:'IELTS Speaking Full Mock', duration:'14 mins', tag:'Unattempted Diagnostic', tagClass:'badge-accent', description:'Live voice recording with AI transcript evaluation across 4 official criteria.' });
      if (!ielts?.writing)  list.push({ track:'IELTS', module:'writing',  title:'IELTS Academic Writing',    duration:'60 mins', tag:'Recommended Core',       tagClass:'badge-neutral', description:'Task 1 visual data report & Task 2 academic essay with granular rubric feedback.' });
      if (!ielts?.listening) list.push({ track:'IELTS', module:'listening', title:'IELTS Listening Practice',  duration:'30 mins', tag:'Recommended Core',       tagClass:'badge-neutral', description:'4 multi-part audio sections with realistic Cambridge test timing.' });
    }
    if (targets.includes('GRE')) {
      if (!gre?.quant)  list.push({ track:'GRE', module:'quant',  title:'GRE Quantitative Reasoning', duration:'21 mins', tag:'High Impact Track',    tagClass:'badge-accent',  description:'Master quantitative comparison, numeric entry, and algebra questions with Mr. Krabs.' });
      if (!gre?.verbal) list.push({ track:'GRE', module:'verbal', title:'GRE Verbal Reasoning',       duration:'18 mins', tag:'Vocabulary Booster',   tagClass:'badge-neutral', description:'Text completion and sentence equivalence sets curated by Mr. Crocs.' });
    }
    if (targets.includes('DMAT')) {
      if (!dmat?.latin)   list.push({ track:'DMAT', module:'latin',   title:'dMAT Latin Squares Deduction', duration:'15 mins', tag:'Cognitive Logic',     tagClass:'badge-accent',  description:'Axiomatic grid deduction under strict timing to sharpen deductive reasoning.' });
      if (!dmat?.figures) list.push({ track:'DMAT', module:'figures', title:'dMAT Figure Sequences',        duration:'15 mins', tag:'Spatial Intelligence', tagClass:'badge-neutral', description:'Pattern rotations, shape transformations, and matrix completions.' });
    }
    if (list.length === 0) {
      list.push({ track:'IELTS', module:'mock_test', title:'IELTS Full Simulation Mock Exam',     duration:'160 mins', tag:'Full Exam Simulation', tagClass:'badge-accent',  description:'Comprehensive exam condition simulation covering all four language components.' });
      list.push({ track:'GRE',   module:'quant',     title:'GRE Advanced Quantitative Sprint',   duration:'21 mins',  tag:'Score Refinement',     tagClass:'badge-neutral', description:'Hard-tier quantitative challenges to push your scaled score towards 170.' });
    }
    return list.slice(0, 3);
  }, [allScores, profile.targetExams]);

  const handleLaunch = (track, module) => {
    playButtonTap();
    if (onNavigateModule) onNavigateModule(track, module);
    else if (onNavigateTrack) onNavigateTrack(track);
  };

  return (
    <div className="home-dashboard-container" style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px 60px', display:'flex', flexDirection:'column', gap:32 }}>
      <OnboardingOverlay
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={p => { setProfile(p); setShowOnboarding(false); }}
        initialProfile={profile}
      />

      {/* Profile Hero */}
      <section className="home-hero-card" style={{
        background:'linear-gradient(135deg,rgba(30,41,59,0.5) 0%,rgba(15,23,42,0.7) 100%)',
        border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xl)',
        padding:'26px 30px', backdropFilter:'blur(16px)',
        display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16,
        animation:'home-hero-in 0.5s cubic-bezier(0.22,1,0.36,1) both'
      }}>
        <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:'var(--radius-pill)', background:'rgba(56,189,248,0.15)', color:'var(--accent-blue)', fontSize:11.5, fontWeight:700, marginBottom:8 }}>
            <Sparkles size={13} /><span>Scholar Intelligence Hub</span>
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, margin:'0 0 6px', color:'var(--text-primary)' }}>Welcome back, {profile.name || 'Scholar'}</h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:10 }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Targeting:</span>
            {profile.targetExams.map(ex => (
              <span key={ex} style={{ padding:'3px 10px', borderRadius:'var(--radius-pill)', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', fontSize:11.5, fontWeight:600, color:'var(--text-primary)' }}>
                {ex === 'IELTS' ? 'IELTS Academic' : ex === 'GRE' ? 'GRE General' : 'dMAT Aptitude'}
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => { playButtonTap(); setShowOnboarding(true); }} style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px',
          borderRadius:'var(--radius-pill)', border:'1px solid var(--border-subtle)',
          background:'var(--bg-elevated)', color:'var(--text-secondary)', fontSize:12.5, fontWeight:600,
          cursor:'pointer', transition:'all 0.15s ease'
        }} title="Edit candidate profile">
          <Settings size={14} /><span>Edit Profile &amp; Goals</span>
        </button>
      </section>

      {/* Continue Practice */}
      <section>
        <AnimatedCard delay={0.05} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <Clock size={18} color="var(--accent-blue)" />
          <h2 style={{ fontSize:17, fontWeight:700, margin:0, color:'var(--text-primary)' }}>Continue Practice</h2>
        </AnimatedCard>
        {continueItems.length > 0 ? (
          <div className="responsive-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            {continueItems.map((item, i) => (
              <AnimatedCard key={item.id} delay={0.08 + i * 0.07}>
                <div style={{
                  background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
                  padding:'18px 20px', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:14,
                  height:'100%', boxSizing:'border-box',
                  transition:'transform 0.18s ease,border-color 0.18s ease,box-shadow 0.18s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor='rgba(56,189,248,0.35)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.boxShadow='none'; }}>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span className="badge badge-neutral" style={{ fontSize:10.5, fontWeight:700 }}>{item.trackLabel}</span>
                      <span className="badge badge-accent" style={{ fontSize:11, fontWeight:700 }}>{item.scoreText}</span>
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:4 }}>
                      Completed on {new Date(item.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => handleLaunch(item.track, item.module)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 14px', fontSize:12.5, fontWeight:700 }}>
                    <RotateCcw size={14} /><span>Resume / Retake Test</span>
                  </button>
                </div>
              </AnimatedCard>
            ))}
          </div>
        ) : (
          <AnimatedCard delay={0.1}>
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', fontSize:13, color:'var(--text-muted)', textAlign:'center' }}>
              No recent test sessions recorded. Your most recent practice sessions will appear here for fast resumption.
            </div>
          </AnimatedCard>
        )}
      </section>

      {/* Duo Coach Diagnostic */}
      <section>
        <AnimatedCard delay={0.12} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <ShieldCheck size={18} color="var(--accent-blue)" />
          <h2 style={{ fontSize:17, fontWeight:700, margin:0, color:'var(--text-primary)' }}>Duo Coach Diagnostic Suggestions</h2>
        </AnimatedCard>
        <div className="responsive-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:16, alignItems:'stretch' }}>
          <AnimatedCard delay={0.14} style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{
              background:'linear-gradient(135deg,rgba(16,185,129,0.06) 0%,var(--bg-surface) 100%)',
              border:'1px solid rgba(112,197,110,0.25)', borderRadius:'var(--radius-lg)', padding:'20px 22px',
              display:'flex', gap:16, alignItems:'flex-start', flex:1, width:'100%', height:'100%', boxSizing:'border-box',
              transition:'transform 0.18s ease,box-shadow 0.18s ease'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(112,197,110,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
              <img src="/images/mr_crocs_frame3_reading.png" alt="Mr. Crocs" style={{ width:64, height:64, objectFit:'contain', filter:'drop-shadow(0 4px 12px rgba(112,197,110,0.3))', flexShrink:0, animation:'ob-mascot-float 3.5s ease-in-out infinite' }} />
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontSize:15, fontWeight:800, color:'#70C56E' }}>Mr. Crocs</span>
                  <span style={{ padding:'2px 8px', borderRadius:99, background:'rgba(112,197,110,0.15)', color:'#70C56E', fontSize:10.5, fontWeight:700 }}>Verbal &amp; Literature</span>
                </div>
                <div style={{ fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5 }}>
                  {crocsPointers.map((p,i) => <div key={i} style={{ marginBottom:i===0?8:0, display:'flex', gap:6 }}><span style={{ color:'#70C56E', fontWeight:800 }}>•</span><span>{p}</span></div>)}
                </div>
              </div>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.2} style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{
              background:'linear-gradient(135deg,rgba(239,68,68,0.06) 0%,var(--bg-surface) 100%)',
              border:'1px solid rgba(240,103,103,0.25)', borderRadius:'var(--radius-lg)', padding:'20px 22px',
              display:'flex', gap:16, alignItems:'flex-start', flex:1, width:'100%', height:'100%', boxSizing:'border-box',
              transition:'transform 0.18s ease,box-shadow 0.18s ease'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(240,103,103,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
              <img src="/images/mr_crabs_frame4_explaining.png" alt="Mr. Krabs" style={{ width:64, height:64, objectFit:'contain', filter:'drop-shadow(0 4px 12px rgba(240,103,103,0.3))', flexShrink:0, animation:'ob-mascot-float 4s 0.8s ease-in-out infinite' }} />
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontSize:15, fontWeight:800, color:'#F06767' }}>Mr. Krabs</span>
                  <span style={{ padding:'2px 8px', borderRadius:99, background:'rgba(240,103,103,0.15)', color:'#F06767', fontSize:10.5, fontWeight:700 }}>Quantitative &amp; Spatial</span>
                </div>
                <div style={{ fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5 }}>
                  {krabsPointers.map((p,i) => <div key={i} style={{ marginBottom:i===0?8:0, display:'flex', gap:6 }}><span style={{ color:'#F06767', fontWeight:800 }}>•</span><span>{p}</span></div>)}
                </div>
              </div>
            </div>
          </AnimatedCard>
        </div>
      </section>

      {/* Suggested Practice */}
      <section>
        <AnimatedCard delay={0.22} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Sparkles size={18} color="var(--accent-amber)" />
            <h2 style={{ fontSize:17, fontWeight:700, margin:0, color:'var(--text-primary)' }}>Suggested For You</h2>
          </div>
          <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>Curated based on unattempted modules &amp; score boosters</span>
        </AnimatedCard>
        <div className="responsive-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
          {suggestedItems.map((item, idx) => (
            <AnimatedCard key={idx} delay={0.24 + idx * 0.07}>
              <div style={{
                background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
                padding:'18px 20px', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:14,
                height:'100%', boxSizing:'border-box', transition:'transform 0.18s ease,border-color 0.18s ease,box-shadow 0.18s ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor='rgba(255,170,0,0.3)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.boxShadow='none'; }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span className="badge badge-neutral" style={{ fontSize:10.5, fontWeight:700 }}>{item.track}</span>
                    <span className={'badge ' + item.tagClass} style={{ fontSize:11, fontWeight:700 }}>{item.tag}</span>
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6, lineHeight:1.4 }}>{item.description}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>Estimated time: <strong>{item.duration}</strong></div>
                </div>
                <button className="btn btn-secondary" onClick={() => handleLaunch(item.track, item.module)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 14px', fontSize:12.5, fontWeight:600 }}>
                  <span>Start Practice</span><ArrowRight size={14} />
                </button>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </section>
    </div>
  );
}
