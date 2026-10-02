import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Icon from '../common/Icon';
import { getApiKey, saveApiKey, getGroqApiKey, saveGroqApiKey } from '../../utils/storage';
import { AIProvider } from '../../utils/ai/aiProvider';

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  targetBand,
  onChangeTargetBand,
  onResetScores
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isGroqValidating, setIsGroqValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null); // { success: boolean, message: string }
  const [groqValidationStatus, setGroqValidationStatus] = useState(null);
  const [resetMessage, setResetMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getApiKey();
      setApiKeyInput(stored || '');
      const storedGroq = getGroqApiKey();
      setGroqKeyInput(storedGroq || '');
      setValidationStatus(null);
      setGroqValidationStatus(null);
      setResetMessage(false);
    }
  }, [isOpen]);

  const handleSaveKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      saveApiKey('');
      setValidationStatus({ success: false, message: 'Gemini API key cleared' });
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);

    const check = await AIProvider.healthCheck('gemini', key);
    setIsValidating(false);

    if (check.success) {
      saveApiKey(key);
      setValidationStatus({ success: true, message: '✓ Gemini connected' });
    } else {
      setValidationStatus({ success: false, message: check.message || 'Gemini connection failed' });
    }
  };

  const handleSaveGroqKey = async () => {
    const key = groqKeyInput.trim();
    if (!key) {
      saveGroqApiKey('');
      setGroqValidationStatus({ success: false, message: 'Groq API key cleared' });
      return;
    }

    setIsGroqValidating(true);
    setGroqValidationStatus(null);

    const check = await AIProvider.healthCheck('groq', key);
    setIsGroqValidating(false);

    if (check.success) {
      saveGroqApiKey(key);
      setGroqValidationStatus({ success: true, message: '✓ Groq connected' });
    } else {
      setGroqValidationStatus({ success: false, message: check.message || 'Groq connection failed' });
    }
  };

  const handleClearKey = () => {
    saveApiKey('');
    setApiKeyInput('');
    setValidationStatus({ success: false, message: 'Gemini key cleared' });
  };

  const handleClearGroqKey = () => {
    saveGroqApiKey('');
    setGroqKeyInput('');
    setGroqValidationStatus({ success: false, message: 'Groq key cleared' });
  };

  const handleResetScoresClick = () => {
    if (onResetScores) {
      onResetScores();
    }
    setResetMessage(true);
    setTimeout(() => {
      setResetMessage(false);
    }, 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            style={{ maxWidth: 520 }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h3>
              <button
                onClick={onClose}
                style={{ padding: 6, borderRadius: 'var(--r-btn)', background: 'var(--surface-alt)', border: 'none', cursor: 'pointer' }}
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* 1. Interface Theme */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Interface Theme</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Switch between Light and Dark mode</div>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--surface-alt)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-btn)',
                  cursor: 'pointer',
                  minWidth: 120,
                  boxSizing: 'border-box',
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
                id="theme-toggle-btn"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            {/* 2. Target Band Setting */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Target Band Score</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Your overall preparation goal</div>
              </div>
              <select
                value={targetBand}
                onChange={(e) => onChangeTargetBand(e.target.value)}
                style={{
                  padding: '8px 14px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'var(--surface-alt)',
                  color: 'var(--coral)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-btn)',
                  cursor: 'pointer',
                  minWidth: 120,
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              >
                {['5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 3. AI Configuration (Gemini API Key) */}
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>AI Configuration</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gemini API key for Writing & Speaking evaluation</div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--c-coral, #D97757)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 4
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    Get free Gemini API key ↗
                  </a>
                </div>
                {getApiKey() && !validationStatus && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-icon)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={12} /> Configured
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter Google Gemini API key..."
                    autoComplete="off"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      fontSize: 13,
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-btn)',
                      color: 'var(--text-primary)',
                      fontFamily: showKey ? 'monospace' : 'inherit'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? 'Hide key' : 'Show key'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Icon name={showKey ? 'eyeOff' : 'eye'} size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={isValidating}
                  className="btn-coral-pill-physical"
                  style={{ padding: '8px 16px', fontSize: 12, minWidth: 90 }}
                >
                  {isValidating ? 'Checking...' : 'Save Key'}
                </button>

                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-alt)',
                      borderRadius: 'var(--r-btn)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {validationStatus && (
                <div style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: validationStatus.success ? 'var(--success-icon)' : 'var(--coral)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Icon name={validationStatus.success ? 'check' : 'alertCircle'} size={14} />
                  {validationStatus.message}
                </div>
              )}
            </div>

            {/* 3b. AI Fallback Configuration (Groq API Key) */}
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Groq Fallback & Whisper STT</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Independent fallback provider (Llama 3.3 / Qwen / Whisper)</div>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--c-coral, #D97757)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 4
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    Get free Groq API key ↗
                  </a>
                </div>
                {getGroqApiKey() && !groqValidationStatus && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-icon)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={12} /> Configured
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKeyInput}
                    onChange={(e) => setGroqKeyInput(e.target.value)}
                    placeholder="Enter Groq API key (gsk_...)"
                    autoComplete="off"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      fontSize: 13,
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-btn)',
                      color: 'var(--text-primary)',
                      fontFamily: showGroqKey ? 'monospace' : 'inherit'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    title={showGroqKey ? 'Hide key' : 'Show key'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Icon name={showGroqKey ? 'eyeOff' : 'eye'} size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGroqKey}
                  disabled={isGroqValidating}
                  className="btn-coral-pill-physical"
                  style={{ padding: '8px 16px', fontSize: 12, minWidth: 90 }}
                >
                  {isGroqValidating ? 'Checking...' : 'Save Key'}
                </button>

                {groqKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearGroqKey}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-alt)',
                      borderRadius: 'var(--r-btn)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {groqValidationStatus && (
                <div style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: groqValidationStatus.success ? 'var(--success-icon)' : 'var(--coral)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Icon name={groqValidationStatus.success ? 'check' : 'alertCircle'} size={14} />
                  {groqValidationStatus.message}
                </div>
              )}
            </div>

            {/* 4. Reset Practice Scores */}
            <div style={{ paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Reset Practice Scores</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Clear recorded scores across all skills and history</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {resetMessage && (
                  <motion.span
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-icon)' }}
                  >
                    ✓ Performance data reset
                  </motion.span>
                )}
                <button
                  id="reset-scores-btn"
                  onClick={handleResetScoresClick}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#EF4444',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: 'var(--r-btn)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  Reset Scores
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
