import React, { useState, useRef, useEffect } from 'react';
import { UserButton, useUser, useClerk } from '@clerk/react';
import Icon from '../common/Icon';

export default function TopNavigation({ onOpenSettings, onGoHome, view }) {
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?';

  return (
    <header className="top-nav">
      <div
        className="nav-brand"
        onClick={onGoHome}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onGoHome()}
      >
        <div className="nav-logo-mark" aria-hidden="true">
          <img src="/favicon.svg" alt="Cognition" className="nav-logo-img" />
        </div>
        <span className="nav-title">Cognition</span>
      </div>

      <div className="nav-actions">
        {isSignedIn ? (
          <div className="account-menu-wrap" ref={menuRef}>
            <button
              className="account-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Account menu"
            >
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="account-avatar-img" />
              ) : (
                <span className="account-avatar-initials">{initials}</span>
              )}
            </button>

            {menuOpen && (
              <div className="account-menu-dropdown">
                <div className="account-menu-header">
                  {user?.imageUrl && <img src={user.imageUrl} alt="" className="account-menu-avatar" />}
                  <div>
                    <div className="account-menu-name">{user?.fullName || user?.username || 'User'}</div>
                    <div className="account-menu-email">{user?.primaryEmailAddress?.emailAddress || ''}</div>
                  </div>
                </div>
                <div className="account-menu-sep" />
                <button className="account-menu-item" onClick={() => { setMenuOpen(false); onOpenSettings(); }}>
                  <Icon name="gear" size={15} />
                  <span>Settings</span>
                </button>
                <button className="account-menu-item" onClick={() => { setMenuOpen(false); openUserProfile(); }}>
                  <Icon name="user" size={15} />
                  <span>Manage account</span>
                </button>
                <div className="account-menu-sep" />
                <button className="account-menu-item account-menu-signout" onClick={() => { setMenuOpen(false); signOut(); }}>
                  <Icon name="back" size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="nav-signin-btn"
            onClick={() => openSignIn()}
            title="Sign in to save progress"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
