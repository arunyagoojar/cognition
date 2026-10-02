import React from 'react';
import { UserButton, useUser, useClerk } from '@clerk/react';
import Icon from '../common/Icon';

export default function TopNavigation({ onOpenSettings, onGoHome, view }) {
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();

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
          <>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'clerk-user-avatar',
                },
              }}
            />
            <button
              className="nav-settings-btn"
              onClick={onOpenSettings}
              title="Settings & Appearance"
              id="open-settings-btn"
              aria-label="Open Settings"
            >
              <Icon name="gear" size={18} />
            </button>
          </>
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
