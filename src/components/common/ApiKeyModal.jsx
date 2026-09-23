import React, { useState, useEffect } from 'react';
import { Key, Sparkles, Check, X, ShieldCheck, ExternalLink, Cpu, CheckCircle2, Eye, EyeOff, Trash2, Zap } from 'lucide-react';
import { getApiKey, saveApiKey } from '../../utils/storage';

export default function ApiKeyModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getApiKey() || '');
      setSaved(false);
      setShowKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    saveApiKey(trimmed);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleClear = () => {
    saveApiKey('');
    setApiKey('');
    setSaved(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 560, background: '#18181b', border: '1px solid var(--border-default)', padding: 26 }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: isConfigured 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.1))'
                : 'linear-gradient(135deg, rgba(82, 156, 202, 0.2), rgba(144, 101, 176, 0.2))',
              border: isConfigured ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConfigured ? 'var(--accent-green)' : 'var(--accent-blue)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>AI Examiner & Model Settings</h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Inspect current AI engine and manage your evaluation credentials
              </p>
            </div>
          </div>

          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6, borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Section 1: See What Model Is Being Used */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 18px',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={16} color="var(--accent-purple)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Active AI Model In Use
              </span>
            </div>
            <span 
              className={`badge ${isConfigured ? 'badge-green' : 'badge-neutral'}`}
              style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {isConfigured ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  AI is Activated
                </>
              ) : (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  Awaiting Key
                </>
              )}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6,
            padding: '10px 14px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Google Gemini 3.8 Flash
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', background: 'rgba(168, 85, 247, 0.12)', padding: '1px 6px', borderRadius: 4 }}>
                  gemini-3.8-flash
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Primary Examiner for Writing (Task 1 & 2) and Speaking (Parts 1, 2, & 3)
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
              <div>Context: <strong>1M Tokens</strong></div>
              <div style={{ color: 'var(--accent-green)' }}>Default Primary Evaluator</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-amber)" />
              <span>Sentence-level grammar rewrites</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-amber)" />
              <span>Band 8+ lexical collocations</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-amber)" />
              <span>Task 1 overview presence detection</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-amber)" />
              <span>Speech transcription analysis</span>
            </div>
          </div>
        </div>

        {/* Section 2: Change or Update API Key */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={14} color="var(--accent-blue)" />
              Change or Update API Key
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 12
              }}
            >
              <span>Get Free Key (Google AI Studio)</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy... (Paste your Google Gemini API key)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  paddingRight: 40,
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowKey(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: 6,
                  color: 'var(--text-muted)'
                }}
                title={showKey ? 'Hide key' : 'Reveal key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {apiKey && (
              <button
                className="btn btn-secondary"
                onClick={handleClear}
                style={{ fontSize: 12, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-red)' }}
                title="Remove saved API key"
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Keys are encrypted locally in your browser's <code style={{ fontSize: 11 }}>localStorage</code> and never sent to external third parties.
          </div>
        </div>

        {/* Built-in Engine Fallback Guarantee */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: 22,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 12,
          color: 'var(--text-muted)'
        }}>
          <ShieldCheck size={16} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {isConfigured 
              ? 'Gemini 3.8 Flash is active by default to evaluate and provide granular feedback on all Writing and Speaking tasks.' 
              : 'If no API key is provided, OmniPrep automatically evaluates tests using its built-in Cambridge rule-based scoring engine.'}
          </span>
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              background: saved 
                ? 'linear-gradient(135deg, var(--accent-green), #16a34a)' 
                : 'linear-gradient(135deg, var(--accent-blue), #2563eb)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {saved ? <Check size={15} /> : <Key size={15} />}
            <span>{saved ? 'Saved & Activated!' : isConfigured ? 'Update Key' : 'Save & Activate AI'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
