import React from 'react';
import { useUser, useClerk } from '@clerk/react';
import Icon from '../common/Icon';

export default function TopNavigation({ onOpenSettings, onGoHome, view }) {
  const { isSignedIn, user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const email = user?.primaryEmailAddress?.emailAddress || '';

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
                <span className="account-avatar-initials">{email.charAt(0).toUpperCase()}</span>
              )}
            </button>

            {menuOpen && (
              <div className="account-menu-dropdown">
                <div className="account-menu-header">
                  <div className="account-menu-email-full">{email}</div>
                </div>
                <div className="account-menu-sep" />
                <button className="account-menu-item" onClick={() => { setMenuOpen(false); signOut(); }}>
                  <Icon name="back" size={14} />
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
