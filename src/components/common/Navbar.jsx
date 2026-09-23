import React, { useState } from 'react';
import { Info, Settings, Menu, X } from 'lucide-react';

export default function Navbar({
  activeTrack = 'IELTS',
  setActiveTrack,
  onGoHome,
  onOpenMockTest,
  onOpenApiKeyModal,
  onOpenDmatGuidelines,
  hasApiKey = false,
  isInMockExam
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isInMockExam) {
    return null;
  }

  const tracks = [
    { id: 'HOME', label: 'Home', subtitle: 'Scholar Hub & Analytics' },
    { id: 'IELTS', label: 'IELTS', subtitle: 'IELTS Academic' },
    { id: 'GRE', label: 'GRE', subtitle: 'GRE General Test' },
    { id: 'DMAT', label: 'DMAT', subtitle: 'DMAT Assessment' },
  ];

  const handleBrandClick = () => {
    setMobileMenuOpen(false);
    if (onGoHome) {
      onGoHome();
    } else {
      setActiveTrack('HOME');
    }
  };

  const handleTrackSelect = (trackId) => {
    setActiveTrack(trackId);
    setMobileMenuOpen(false);
  };

  const handleOpenSettings = () => {
    setMobileMenuOpen(false);
    onOpenApiKeyModal();
  };

  const handleOpenRegulations = () => {
    setMobileMenuOpen(false);
    if (onOpenDmatGuidelines) onOpenDmatGuidelines();
  };

  return (
    <header className="navbar-glass">
      <div className="nav-brand" onClick={handleBrandClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src="/images/logo.svg"
          alt="Cognition Logo"
          style={{
            width: 44,
            height: 44,
            objectFit: 'contain',
            filter: 'drop-shadow(0 3px 10px rgba(0, 0, 0, 0.4))',
            flexShrink: 0
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="nav-title" style={{ fontSize: 18, lineHeight: 1.15, fontWeight: 800 }}>Cognition</div>
          <div className="nav-subtitle" style={{ fontSize: 11.5, marginTop: 2 }}>
            {activeTrack === 'HOME' ? 'Scholar Intelligence Hub' : activeTrack === 'IELTS' ? 'IELTS Academic' : activeTrack === 'GRE' ? 'GRE General Test' : 'DMAT Assessment'}
          </div>
        </div>
      </div>

      {/* Desktop Segmented Control */}
      <nav className="nav-center desktop-nav-center">
        <div className="segmented-control">
          {tracks.map(t => {
            const isActive = activeTrack === t.id;
            return (
              <button
                key={t.id}
                className={`segmented-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTrackSelect(t.id)}
                style={{ minWidth: 70, padding: '4px 14px', justifyContent: 'center' }}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Actions */}
      <div className="nav-actions desktop-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {activeTrack === 'DMAT' && (
          <button
            className="btn btn-secondary"
            onClick={onOpenDmatGuidelines}
            title="Exam Regulations & Instructions for dMAT"
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Info size={14} color="var(--accent-blue)" />
            <span>Exam Regulations</span>
          </button>
        )}

        {/* Minimalist Apple HIG Settings Button */}
        <button
          className="nav-icon-btn"
          onClick={onOpenApiKeyModal}
          aria-label="Settings"
          title="Settings & Preferences"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Mobile Burger Menu Button */}
      <div className="mobile-nav-toggle-wrap">
        <button
          className="nav-icon-btn mobile-burger-btn"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          title="Navigation Menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 8 }}>
            Select Assessment Track
          </div>
          <div className="mobile-track-list">
            {tracks.map(t => {
              const isActive = activeTrack === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTrackSelect(t.id)}
                  className={`mobile-track-btn ${isActive ? 'active' : ''}`}
                >
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</span>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{t.subtitle}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTrack === 'DMAT' && (
              <button
                className="mobile-action-btn"
                onClick={handleOpenRegulations}
              >
                <Info size={16} color="var(--accent-blue)" />
                <span>Exam Regulations & Instructions</span>
              </button>
            )}

            <button
              className="mobile-action-btn"
              onClick={handleOpenSettings}
            >
              <Settings size={16} />
              <span>Settings & Preferences</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

