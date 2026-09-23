import React, { useState, useEffect } from 'react';
import { 
  Settings, Type, Moon, Sun, Key, Check, X, 
  ExternalLink, Eye, EyeOff, Trash2, CheckCircle2 
} from 'lucide-react';
import { getAppSettings, saveAppSettings } from '../../utils/storage';

const FONT_SIZES = [
  { id: '100%', label: '100%', desc: 'Standard' },
  { id: '115%', label: '115%', desc: 'Medium' },
  { id: '130%', label: '130%', desc: 'Large' },
  { id: '145%', label: '145%', desc: 'Extra' },
];

export default function SettingsModal({ isOpen, onClose, onSettingsChanged }) {
  const [settings, setSettings] = useState(() => getAppSettings());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getAppSettings());
      setSaved(false);
      setShowKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isKeyConfigured = Boolean(settings.apiKey && settings.apiKey.trim().length > 5);

  const handleFontChange = (fontSize) => {
    const updated = { ...settings, fontSize };
    setSettings(updated);
    saveAppSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleThemeChange = (theme) => {
    const updated = { ...settings, theme };
    setSettings(updated);
    saveAppSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleSave = () => {
    const updated = saveAppSettings(settings);
    setSaved(true);
    if (onSettingsChanged) onSettingsChanged(updated);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClearKey = () => {
    const updated = { ...settings, apiKey: '' };
    setSettings(updated);
    saveAppSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: 490, 
          padding: '24px 26px',
          borderRadius: 20
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)'
            }}>
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Settings
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Preferences & AI Configuration
              </p>
            </div>
          </div>

          <button 
            className="nav-icon-btn" 
            onClick={onClose} 
            style={{ width: 32, height: 32, borderRadius: '50%' }}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Apple Inset Group 1: Appearance */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 14
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)', marginBottom: 8 }}>
            Appearance
          </div>

          <div className="segmented-control" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button
              type="button"
              className={`segmented-btn ${settings.theme !== 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
              style={{ justifyContent: 'center', padding: '7px 12px' }}
            >
              <Moon size={14} color={settings.theme !== 'light' ? 'var(--accent-purple)' : 'currentColor'} />
              <span>Dark Canvas</span>
            </button>

            <button
              type="button"
              className={`segmented-btn ${settings.theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
              style={{ justifyContent: 'center', padding: '7px 12px' }}
            >
              <Sun size={14} color={settings.theme === 'light' ? 'var(--accent-amber)' : 'currentColor'} />
              <span>Light Paper</span>
            </button>
          </div>
        </div>

        {/* Apple Inset Group 2: Font Scaling */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>
              Text Scale
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {settings.fontSize}
            </span>
          </div>

          <div className="segmented-control" style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {FONT_SIZES.map(f => {
              const isActive = settings.fontSize === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`segmented-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleFontChange(f.id)}
                  style={{
                    justifyContent: 'center',
                    padding: '6px 4px',
                    fontSize: 12
                  }}
                >
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Clean live preview line */}
          <div style={{
            marginTop: 10,
            padding: '7px 12px',
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--app-font-size, 14px)',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Sample: The quick brown fox jumps over the lazy dog.
          </div>
        </div>

        {/* Apple Inset Group 3: Gemini AI Engine */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 18
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>
              Gemini AI Engine
            </div>
            <span 
              className={`badge ${isKeyConfigured ? 'badge-green' : 'badge-neutral'}`}
              style={{ fontSize: 10.5, padding: '1px 8px' }}
            >
              {isKeyConfigured ? '● AI Activated' : '○ Built-in Rule Engine'}
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
            Powers nuanced evaluation for IELTS Writing & Speaking and GRE AWA essays.
          </p>

          {/* Unified Apple Text Input Field */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '0 10px',
            height: 42,
            transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
          }}>
            <Key size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginRight: 8 }} />
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="AIzaSy... (Gemini API Key)"
              value={settings.apiKey || ''}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                padding: 0,
                outline: 'none',
                boxShadow: 'none'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
              <button
                type="button"
                onClick={() => setShowKey(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              {settings.apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-red)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Remove saved API key"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Stored locally in browser
            </span>
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
                fontSize: 11.5
              }}
            >
              <span>Get free key</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 13, padding: '7px 14px' }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              fontSize: 13,
              padding: '7px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {saved ? <Check size={14} /> : <CheckCircle2 size={14} />}
            <span>{saved ? 'Saved!' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
