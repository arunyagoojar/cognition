import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Icon from '../common/Icon';
import { saveCredential, fetchCredentialStatus, hasApiAuth } from '../../utils/api';
import { invalidateCredentialStatusCache } from '../../utils/storage';

// ─── First-run onboarding ────────────────────────────────────────────────────
// Seven concise screens after login: welcome → what you get → target band →
// how AI works → Gemini API key → theme → final. Typographic motion, minimal chrome.
// Completion/skip is persisted per user by the caller via onComplete.

const STEPS = ['welcome', 'features', 'target', 'ai', 'apikey', 'theme', 'final'];

// Word-by-word typographic entrance (the primary onboarding motion)
function AnimatedWords({ text, className, delayBase = 0.1, as: Tag = 'span' }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');
  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="ob-word"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: delayBase + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}

const fadeItem = (reduceMotion, delay = 0) => ({
  initial: { opacity: 0, y: reduceMotion ? 0 : 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
});

// ── Step 1: Welcome ──
function WelcomeStep() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="ob-step ob-step-welcome">
      <AnimatedWords text="Cognition" className="ob-brand" delayBase={0.15} as="h1" />
      <AnimatedWords
        text="Your IELTS Academic preparation workspace."
        className="ob-tagline"
        delayBase={0.55}
        as="p"
      />
      <motion.p className="ob-support" {...fadeItem(reduceMotion, 1.15)}>
        Practice. Learn. Get evaluated. Understand where you can improve.
      </motion.p>
    </div>
  );
}

// ── Step 2: What you get ──
const FEATURE_ITEMS = [
  { icon: 'target', label: 'Verified IELTS question sets' },
  { icon: 'book', label: 'Reading & Listening practice' },
  { icon: 'pen', label: 'Writing practice' },
  { icon: 'mic', label: 'Speaking practice' },
  { icon: 'play', label: 'Learning videos' },
  { icon: 'sparkles', label: 'Tips & Tricks' },
  { icon: 'clock', label: 'Full mock exams' },
  { icon: 'check', label: 'Performance tracking' },
  { icon: 'zap', label: 'AI-powered evaluation, where it helps' },
];

function FeaturesStep() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="ob-step ob-step-features">
      <h1 className="ob-heading" tabIndex={-1}>What you get</h1>
      <motion.ul className="ob-feature-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
        {FEATURE_ITEMS.map(item => (
          <motion.li
            key={item.label}
            className="ob-feature-item"
            variants={reduceMotion ? {} : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
          >
            <span className="ob-feature-icon" aria-hidden="true"><Icon name={item.icon} size={15} /></span>
            <span>{item.label}</span>
          </motion.li>
        ))}
      </motion.ul>
      <p className="ob-support">Structured practice with an authentic exam-style experience.</p>
    </div>
  );
}

// ── Step 3: Target Band ──
const TARGET_OPTIONS = [
  { band: '6.0', label: 'Band 6.0', desc: 'Competent User' },
  { band: '6.5', label: 'Band 6.5', desc: 'Good Foundation' },
  { band: '7.0', label: 'Band 7.0', desc: 'Good User · Most University Targets' },
  { band: '7.5', label: 'Band 7.5', desc: 'Advanced Academic' },
  { band: '8.0', label: 'Band 8.0', desc: 'Very Good User · High Proficiency' },
  { band: '8.5', label: 'Band 8.5+', desc: 'Expert User' },
];

function TargetStep({ targetBand, onChangeTargetBand }) {
  const reduceMotion = useReducedMotion();
  const currentBand = String(targetBand || '8.0');

  return (
    <div className="ob-step ob-step-target">
      <h1 className="ob-heading" tabIndex={-1}>What band score are you aiming for?</h1>
      <p className="ob-step-lede">
        Cognition personalizes your evaluation criteria, benchmark gaps, and study recommendations to your target score.
      </p>

      <motion.div
        className="ob-target-grid"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      >
        {TARGET_OPTIONS.map(opt => {
          const isSelected = currentBand === opt.band || (opt.band === '8.5' && parseFloat(currentBand) >= 8.5);
          return (
            <motion.button
              key={opt.band}
              type="button"
              className={`ob-target-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onChangeTargetBand?.(opt.band)}
              variants={reduceMotion ? {} : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
            >
              <div className="ob-target-score">{opt.band}</div>
              <div className="ob-target-meta">
                <div className="ob-target-label">{opt.label}</div>
                <div className="ob-target-desc">{opt.desc}</div>
              </div>
              {isSelected && (
                <span className="ob-target-check" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
      <p className="ob-support">You can adjust your target band score anytime in Settings.</p>
    </div>
  );
}

// ── Step 4: How AI works ──
const SPEAKING_PIPELINE = [
  { label: 'You speak', text: 'Answer the examiner’s questions out loud.' },
  { label: 'Recorded', text: 'Cognition records your response locally.' },
  { label: 'Transcribed', text: 'Your speech is converted into text.' },
  { label: 'Sent securely', text: 'The response goes to the AI evaluator over an encrypted connection.' },
  { label: 'Analyzed', text: 'The evaluator reviews fluency, vocabulary, grammar and pronunciation.' },
  { label: 'Structured feedback', text: 'You receive band-level feedback per criterion.' },
];

function AiStep() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="ob-step ob-step-ai">
      <h1 className="ob-heading" tabIndex={-1}>How AI works here</h1>
      <p className="ob-step-lede">Speaking, step by step:</p>
      <motion.ol
        className="ob-pipeline"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {SPEAKING_PIPELINE.map((step, i) => (
          <motion.li
            key={step.label}
            className="ob-pipeline-step"
            variants={reduceMotion ? {} : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
          >
            <span className="ob-pipeline-num" aria-hidden="true">{i + 1}</span>
            <span className="ob-pipeline-body">
              <span className="ob-pipeline-label">{step.label}</span>
              <span className="ob-pipeline-text">{step.text}</span>
            </span>
            {i < SPEAKING_PIPELINE.length - 1 && (
              <span className="ob-pipeline-arrow" aria-hidden="true"><Icon name="arrowRight" size={12} /></span>
            )}
          </motion.li>
        ))}
      </motion.ol>
      <motion.div className="ob-ai-notes" {...fadeItem(reduceMotion, 0.5)}>
        <p><strong>Writing</strong> gets the same AI treatment — criterion-based evaluation of your essays.</p>
        <p><strong>Reading &amp; Listening</strong> are scored deterministically against answer keys. AI only assists with genuinely ambiguous free-text answers.</p>
      </motion.div>
    </div>
  );
}

// ── Step 4: API key ──
function ApiKeyStep() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(() => (hasApiAuth() ? 'checking' : 'noauth')); // checking | missing | configured | saving | saved | noauth
  const [keyInput, setKeyInput] = useState('');
  const [message, setMessage] = useState(null); // { success, text }

  useEffect(() => {
    let alive = true;
    if (!hasApiAuth()) {
      return undefined;
    }
    fetchCredentialStatus('gemini')
      .then(s => { if (alive) setPhase(s?.configured ? 'configured' : 'missing'); })
      .catch(() => { if (alive) setPhase('missing'); });
    return () => { alive = false; };
  }, []);

  const handleSave = async () => {
    const key = keyInput.trim();
    if (!key) {
      setMessage({ success: false, text: 'Paste your Gemini API key first.' });
      return;
    }
    setPhase('saving');
    setMessage(null);
    const res = await saveCredential('gemini', key);
    setKeyInput('');
    invalidateCredentialStatusCache();
    if (res.ok) {
      setPhase('configured');
      setMessage({
        success: true,
        text: res.local
          ? res.message
          : 'Your key is connected.',
      });
    } else {
      setPhase('missing');
      setMessage({
        success: false,
        text: res.message || 'Could not save the key. Please try again.',
      });
    }
  };

  return (
    <div className="ob-step ob-step-apikey">
      <h1 className="ob-heading" tabIndex={-1}>Connect your Gemini API key</h1>
      <p className="ob-step-lede">
        Your key allows Cognition to provide AI-powered evaluation for your Writing and Speaking practice.
      </p>

      <motion.ul className="ob-checklist" {...fadeItem(reduceMotion, 0.15)}>
        {['Writing feedback', 'Speaking analysis', 'Criterion-based evaluation', 'Personalized feedback'].map(item => (
          <li key={item}><Icon name="check" size={14} /><span>{item}</span></li>
        ))}
      </motion.ul>

      <motion.div className="ob-apikey-zone" {...fadeItem(reduceMotion, 0.25)}>
        {phase === 'checking' && <p className="ob-apikey-note">Checking your key status…</p>}

        {phase === 'configured' && (
          <div className="ob-apikey-connected" role="status">
            <Icon name="check" size={16} />
            <span>Your Gemini key is connected{message?.text ? ` — ${message.text}` : '.'} You’re all set.</span>
          </div>
        )}

        {(phase === 'missing' || phase === 'saving') && (
          <>
            <div className="ob-apikey-row">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Paste your Gemini API key…"
                autoComplete="off"
                spellCheck="false"
                aria-label="Gemini API key"
              />
              <button type="button" className="btn-coral-pill-physical ob-primary-btn" onClick={handleSave} disabled={phase === 'saving'}>
                {phase === 'saving' ? 'Saving…' : 'Save API Key'}
              </button>
            </div>
            <a className="ob-apikey-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              Get a free Gemini API key ↗
            </a>
          </>
        )}

        {phase === 'noauth' && (
          <p className="ob-apikey-note">Sign-in isn’t available in this environment. You can add your key later from Settings.</p>
        )}

        {message && (
          <div className={`ob-apikey-message ${message.success ? 'ok' : 'err'}`} role="status">
            <Icon name={message.success ? 'check' : 'alertCircle'} size={14} />
            <span>{message.text}</span>
          </div>
        )}
      </motion.div>

      <motion.p className="ob-security-note" {...fadeItem(reduceMotion, 0.35)}>
        <Icon name="eyeOff" size={13} />
        Your key is stored encrypted on the server, never in your public app data. If secure cloud storage is unavailable, it stays only in this browser.
        {(phase === 'missing' || phase === 'noauth') && ' You can skip for now — add it later from Settings. Nothing is blocked.'}
      </motion.p>
    </div>
  );
}

// ── Step 5: Theme ──
function ThemeStep({ theme, onChangeTheme }) {
  const options = [
    { id: 'light', label: 'Light', desc: 'Bright and focused' },
    { id: 'dark', label: 'Dark', desc: 'Calm and easy on the eyes' },
  ];
  const groupRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = theme === 'light' ? 'dark' : 'light';
    onChangeTheme(next);
    const buttons = groupRef.current?.querySelectorAll('[role="radio"]');
    buttons?.[next === 'light' ? 0 : 1]?.focus();
  };

  return (
    <div className="ob-step ob-step-theme">
      <h1 className="ob-heading" tabIndex={-1}>How do you want Cognition to look?</h1>
      <div
        className="ob-theme-group"
        role="radiogroup"
        aria-label="Theme"
        ref={groupRef}
        onKeyDown={handleKeyDown}
      >
        {options.map(opt => {
          const selected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`ob-theme-card ${selected ? 'selected' : ''}`}
              onClick={() => onChangeTheme(opt.id)}
            >
              <span className={`ob-theme-preview ob-theme-preview-${opt.id}`} aria-hidden="true">
                <span className="ob-preview-nav" />
                <span className="ob-preview-card">
                  <span className="ob-preview-line is-title" />
                  <span className="ob-preview-line" />
                  <span className="ob-preview-line is-short" />
                </span>
                <span className="ob-preview-pill" />
              </span>
              <span className="ob-theme-label">
                <span className="ob-theme-name">{opt.label}</span>
                <span className="ob-theme-desc">{opt.desc}</span>
              </span>
              {selected && (
                <span className="ob-theme-check" aria-hidden="true"><Icon name="check" size={13} /></span>
              )}
            </button>
          );
        })}
      </div>
      <p className="ob-support">You can change this anytime in Settings.</p>
    </div>
  );
}

// ── Step 6: Final ──
function FinalStep() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="ob-step ob-step-final">
      <AnimatedWords text="That’s the big picture." className="ob-brand ob-brand-md" delayBase={0.1} as="h1" />
      <motion.p className="ob-support" {...fadeItem(reduceMotion, 0.6)}>
        There’s plenty more waiting inside Cognition — small details, useful tools,
        and little things you’ll discover as you practice.
      </motion.p>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export default function Onboarding({ theme, onChangeTheme, targetBand = '8.0', onChangeTargetBand, onComplete }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();

  const isFinal = index === STEPS.length - 1;

  const goTo = useCallback((nextIndex) => {
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
  }, [index]);

  const finish = useCallback(() => onComplete(), [onComplete]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { finish(); return; }
      if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
        if (isFinal) finish();
        else goTo(index + 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, isFinal, goTo, finish]);

  const screenVariants = {
    enter: (dir) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 48, scale: 0.99 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * -48, scale: 0.99 }),
  };

  return (
    <motion.div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Cognition"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="onboarding-topbar">
        <span className="onboarding-progress" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((step, i) => (
            <button
              key={step}
              type="button"
              className={`ob-dot ${i === index ? 'active' : ''} ${i < index ? 'seen' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </span>
        {!isFinal && (
          <button type="button" className="ob-skip" onClick={finish}>
            Skip intro
          </button>
        )}
      </div>

      <div className="onboarding-stage">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={STEPS[index]}
            className="onboarding-screen"
            custom={direction}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            {index === 0 && <WelcomeStep />}
            {index === 1 && <FeaturesStep />}
            {index === 2 && <TargetStep targetBand={targetBand} onChangeTargetBand={onChangeTargetBand} />}
            {index === 3 && <AiStep />}
            {index === 4 && <ApiKeyStep />}
            {index === 5 && <ThemeStep theme={theme} onChangeTheme={onChangeTheme} />}
            {index === 6 && <FinalStep />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="onboarding-actions">
        {index > 0 && !isFinal ? (
          <button type="button" className="ob-back-btn" onClick={() => goTo(index - 1)}>
            <Icon name="arrowLeft" size={13} />
            <span>Back</span>
          </button>
        ) : <span />}
        {isFinal ? (
          <button type="button" className="btn-coral-pill-physical ob-primary-btn ob-start-btn" onClick={finish}>
            <span>Start Learning</span>
            <Icon name="arrowRight" size={14} />
          </button>
        ) : (
          <button type="button" className="btn-coral-pill-physical ob-primary-btn" onClick={() => goTo(index + 1)}>
            <span>Continue</span>
            <Icon name="arrowRight" size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
