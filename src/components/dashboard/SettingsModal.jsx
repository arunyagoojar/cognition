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
import { saveCredential, fetchCredentialStatus, deleteCredential } from '../../utils/api';

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
        message: res.message || 'Key saved on this device.',
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

            {/* 3. AI examiner: provider + key (saved on this device) */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>AI examiner</div>
                {credentialStatus?.configured && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-icon)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={13} /> Key saved
                  </span>
                )}
              </div>

              {/* Provider choice — Groq is the recommended default */}
              <div role="radiogroup" aria-label="AI provider" style={{ display: 'flex', gap: 6, marginTop: 10, padding: 4, background: 'var(--surface-sunken)', borderRadius: 12 }}>
                {[
                  { id: 'groq', label: 'Groq', tag: 'Recommended' },
                  { id: 'gemini', label: 'Gemini', tag: 'Backup' },
                ].map(p => {
                  const active = selectedProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleSelectProvider(p.id)}
                      style={{
                        flex: 1, padding: '9px 10px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        borderRadius: 9, border: active ? '1.5px solid #151313' : '1.5px solid transparent',
                        background: active ? 'var(--bg-card)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: active ? '0 2px 0 #151313' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: p.id === 'groq' ? 'var(--c-coral, #FF5734)' : 'var(--surface-alt)',
                        color: p.id === 'groq' ? '#fff' : 'var(--text-secondary)' }}>{p.tag}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                {selectedProvider === 'groq' ? 'Fast, with a free tier.' : 'Gemini 3.8 Flash. Slower; use if Groq is unavailable.'}{' '}
                <a
                  href={selectedProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 700, color: 'var(--c-coral, #FF5734)', textDecoration: 'none' }}
                >
                  Get a free key ↗
                </a>
              </div>

              {credentialStatus?.configured && !isReplacing ? (
                /* Stored state — never reveals the key itself */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    flex: 1, minWidth: 160, padding: '10px 12px', fontSize: 13.5, fontWeight: 600,
                    color: 'var(--text-primary)', background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-btn)', fontFamily: 'ui-monospace, monospace'
                  }}>
                    {credentialStatus.maskedSuffix || '••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsReplacing(true); setValidationStatus(null); }}
                    style={{
                      padding: '9px 14px', fontSize: 13, fontWeight: 600,
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
                      padding: '9px 14px', fontSize: 13, fontWeight: 600,
                      color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)',
                      borderRadius: 'var(--r-btn)', border: '1px solid rgba(239, 68, 68, 0.25)', cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                /* Entry state (new key or replacement) */
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={selectedProvider === 'groq' ? 'Paste Groq key (gsk_…)' : 'Paste Gemini key'}
                    autoComplete="off"
                    spellCheck="false"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
                    style={{
                      flex: 1, minWidth: 0, padding: '10px 12px', fontSize: 14,
                      background: 'var(--surface-sunken)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-btn)', color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={isValidating}
                    className="btn-coral-pill-physical"
                    style={{ padding: '9px 18px', fontSize: 13, minWidth: 80 }}
                  >
                    {isValidating ? 'Saving…' : 'Save'}
                  </button>
                  {isReplacing && (
                    <button
                      type="button"
                      onClick={() => { setIsReplacing(false); setKeyInput(''); }}
                      style={{
                        padding: '9px 12px', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-secondary)', background: 'var(--surface-alt)',
                        borderRadius: 'var(--r-btn)', border: '1px solid var(--border)', cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {validationStatus && (
                <div style={{
                  marginTop: 8, fontSize: 13, fontWeight: 600,
                  color: validationStatus.success ? 'var(--success-icon)' : 'var(--coral)',
                  display: 'flex', alignItems: 'center', gap: 6
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
