import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Icon from '../common/Icon';
import {
  getLegacyLocalKeys,
  removeLegacyLocalKeys,
  invalidateCredentialStatusCache,
  getActiveAiProvider,
  setActiveAiProvider,
  removeLocalGeminiKey,
  removeLocalGroqKey
} from '../../utils/storage';
import { saveCredential, fetchCredentialStatus, deleteCredential, hasApiAuth } from '../../utils/api';

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  targetBand,
  onChangeTargetBand,
  onResetScores,
}) {
  const [selectedProvider, setSelectedProvider] = useState(() => getActiveAiProvider());
  const [credentialStatus, setCredentialStatus] = useState(null); // { configured, maskedSuffix }
  const [keyInput, setKeyInput] = useState('');
  const [isReplacing, setIsReplacing] = useState(false); // reveal input to replace a stored key
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null); // { success, message }
  const [legacyKeys, setLegacyKeys] = useState(null); // { gemini, groq } | null
  const [resetMessage, setResetMessage] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValidationStatus(null);
    setKeyInput('');
    setIsReplacing(false);
    setResetMessage(false);
    setLegacyKeys(() => {
      const legacy = getLegacyLocalKeys();
      return (legacy.gemini || legacy.groq) ? legacy : null;
    });
    let alive = true;
    fetchCredentialStatus(selectedProvider).then((status) => {
      if (alive) setCredentialStatus(status);
    }).catch(() => {
      if (alive) setCredentialStatus({ configured: false });
    });
    return () => { alive = false; };
  }, [isOpen, selectedProvider]);

  const handleSelectProvider = (prov) => {
    setActiveAiProvider(prov);
    setSelectedProvider(prov);
    setValidationStatus(null);
    setKeyInput('');
    setIsReplacing(false);
    fetchCredentialStatus(prov).then((status) => {
      setCredentialStatus(status);
    }).catch(() => {
      setCredentialStatus({ configured: false });
    });
  };

  const handleSaveKey = async () => {
    const key = keyInput.trim();
    if (!key) {
      setValidationStatus({
        success: false,
        message: `Paste your ${selectedProvider === 'groq' ? 'Groq' : 'Gemini'} API key first.`
      });
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);

    const res = await saveCredential(selectedProvider, key);
    setIsValidating(false);
    setKeyInput('');
    setIsReplacing(false);
    invalidateCredentialStatusCache();

    if (res.ok) {
      setCredentialStatus({ configured: true, maskedSuffix: res.maskedSuffix, local: res.local });
      setValidationStatus({
        success: true,
        message: res.local
          ? `✓ ${res.message}`
          : `✓ ${selectedProvider === 'groq' ? 'Groq' : 'Gemini'} key saved — encrypted on the server`,
      });
      setLegacyKeys((prev) => {
        if (prev?.gemini || prev?.groq) {
          removeLegacyLocalKeys();
        }
        return null;
      });
    } else {
      setValidationStatus({ success: false, message: res.message || 'Could not save the key. Please try again.' });
    }
  };

  const handleDeleteKey = async () => {
    setIsValidating(true);
    const wasLocal = Boolean(credentialStatus?.local);
    if (selectedProvider === 'gemini') removeLocalGeminiKey();
    if (selectedProvider === 'groq') removeLocalGroqKey();
    const res = await deleteCredential(selectedProvider);
    setIsValidating(false);
    invalidateCredentialStatusCache();
    if (res.ok || wasLocal) {
      setCredentialStatus({ configured: false });
      const provLabel = selectedProvider === 'groq' ? 'Groq' : 'Gemini';
      setValidationStatus({
        success: true,
        message: wasLocal ? `${provLabel} key removed from this device.` : `${provLabel} key removed from the server.`,
      });
    } else {
      setValidationStatus({ success: false, message: 'Could not remove the key. Please try again.' });
    }
  };

  const handleMigrateLegacy = async () => {
    setIsValidating(true);
    const legacy = legacyKeys;
    if (legacy?.gemini) {
      const res = await saveCredential('gemini', legacy.gemini);
      if (res.ok) {
        setCredentialStatus({ configured: true, maskedSuffix: res.maskedSuffix });
        setValidationStatus({ success: true, message: '✓ Key moved to encrypted server storage' });
      } else {
        setValidationStatus({
          success: false,
          message: `${res.message || 'Migration failed.'} The local plaintext copy was removed anyway.`,
        });
      }
    }
    removeLegacyLocalKeys();
    invalidateCredentialStatusCache();
    setLegacyKeys(null);
    setIsValidating(false);
  };

  const handleDiscardLegacy = () => {
    removeLegacyLocalKeys();
    setLegacyKeys(null);
    setValidationStatus({ success: true, message: 'Local plaintext key removed.' });
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

  const signedIn = hasApiAuth();

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

            {/* 3. AI Configuration (Provider Choice: Gemini vs Groq) */}
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>AI Provider &amp; Model</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Select your preferred AI engine for Writing &amp; Speaking evaluation and hybrid answer verification.
                  </div>
                </div>
                {credentialStatus?.configured && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-icon)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={12} /> {credentialStatus.local ? 'Configured (device)' : 'Configured'}
                  </span>
                )}
              </div>

              {/* Provider Selection Tabs */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSelectProvider('gemini')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--r-btn)',
                    cursor: 'pointer',
                    border: selectedProvider === 'gemini' ? '2px solid var(--c-coral, #D97757)' : '1px solid var(--border)',
                    background: selectedProvider === 'gemini' ? 'var(--surface-sunken)' : 'var(--surface-alt)',
                    color: selectedProvider === 'gemini' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>Google Gemini</span>
                  {selectedProvider === 'gemini' && (
                    <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--c-coral, #D97757)', color: '#fff', borderRadius: 3, fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectProvider('groq')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--r-btn)',
                    cursor: 'pointer',
                    border: selectedProvider === 'groq' ? '2px solid var(--c-coral, #D97757)' : '1px solid var(--border)',
                    background: selectedProvider === 'groq' ? 'var(--surface-sunken)' : 'var(--surface-alt)',
                    color: selectedProvider === 'groq' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>Groq (GPT-OSS 120B)</span>
                  {selectedProvider === 'groq' && (
                    <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--c-coral, #D97757)', color: '#fff', borderRadius: 3, fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  )}
                </button>
              </div>

              {/* Provider details & free key link */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {selectedProvider === 'groq'
                    ? 'Groq AI with GPT-OSS 120B / Qwen 27B provides ultra-fast evaluation with a generous free tier (30 requests/min, 14,400 requests/day). No credit card required.'
                    : 'Google Gemini 2.5 Flash / 2.0 Flash provides high reasoning fidelity. Keys are encrypted (AES-256-GCM) on the server or stored securely on this device.'}
                </div>
                <a
                  href={selectedProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey'}
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
                >
                  {selectedProvider === 'groq' ? 'Get free Groq API key (14,400 free reqs/day) ↗' : 'Get free Gemini API key ↗'}
                </a>
              </div>

              {!signedIn ? (
                <div style={{
                  marginTop: 8, padding: '10px 12px', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-secondary)', background: 'var(--surface-alt)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-btn)'
                }}>
                  Sign in to configure your personal AI evaluation key.
                </div>
              ) : credentialStatus?.configured && !isReplacing ? (
                /* Stored state — never reveals the key itself */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    flex: 1, minWidth: 180, padding: '9px 12px', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary)', background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-btn)'
                  }}>
                    {selectedProvider === 'groq' ? 'Groq GPT-OSS 120B' : 'Gemini 2.5 Flash'} · {credentialStatus.maskedSuffix || '••••'}{credentialStatus.local ? ' (on this device)' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsReplacing(true); setValidationStatus(null); }}
                    style={{
                      padding: '8px 14px', fontSize: 12, fontWeight: 600,
                      color: 'var(--text-primary)', background: 'var(--surface-alt)',
                      borderRadius: 'var(--r-btn)', border: '1px solid var(--border)', cursor: 'pointer'
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    disabled={isValidating}
                    style={{
                      padding: '8px 14px', fontSize: 12, fontWeight: 600,
                      color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)',
                      borderRadius: 'var(--r-btn)', border: '1px solid rgba(239, 68, 68, 0.25)', cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                /* Entry state (new key or replacement) */
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={selectedProvider === 'groq' ? 'Paste Groq API key (starts with gsk_)…' : 'Paste Google Gemini API key…'}
                    autoComplete="off"
                    spellCheck="false"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '9px 12px',
                      fontSize: 13,
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-btn)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={isValidating}
                    className="btn-coral-pill-physical"
                    style={{ padding: '8px 16px', fontSize: 12, minWidth: 90 }}
                  >
                    {isValidating ? 'Saving…' : 'Save Key'}
                  </button>
                  {isReplacing && (
                    <button
                      type="button"
                      onClick={() => { setIsReplacing(false); setKeyInput(''); }}
                      style={{
                        padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        color: 'var(--text-secondary)', background: 'var(--surface-alt)',
                        borderRadius: 'var(--r-btn)', border: '1px solid var(--border)', cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {credentialStatus?.configured && credentialStatus.local && !isReplacing && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  Stored locally on this device only — never sent to Cognition&apos;s servers. AI evaluation runs directly from this browser.
                </div>
              )}

              {isReplacing && credentialStatus?.configured && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  The stored key stays active until a replacement is saved.
                </div>
              )}

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

              {/* Legacy plaintext key migration (one-time) */}
              {legacyKeys && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', fontSize: 12,
                  color: 'var(--text-primary)', background: 'var(--surface-alt)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-btn)'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    A plaintext API key was found in this browser's local storage.
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Move it to encrypted server storage and remove the local copy.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleMigrateLegacy}
                      disabled={isValidating}
                      className="btn-coral-pill-physical"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      Secure &amp; remove
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardLegacy}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        color: 'var(--text-secondary)', background: 'var(--surface-alt)',
                        borderRadius: 'var(--r-btn)', border: '1px solid var(--border)', cursor: 'pointer'
                      }}
                    >
                      Remove without saving
                    </button>
                  </div>
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
