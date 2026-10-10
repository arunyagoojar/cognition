import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'
import { CLERK_PUBLISHABLE_KEY as PUBLISHABLE_KEY } from './config.js'
import { pruneStaleClientData } from './utils/clientDataRetention.js'

// Drop expired in-progress state, stale AI cache entries and orphaned
// recordings before the app reads any stored state.
pruneStaleClientData()

function Root() {
  // Without a Clerk key, render without auth — the app is fully functional
  if (!PUBLISHABLE_KEY) {
    console.warn('[Cognition] VITE_CLERK_PUBLISHABLE_KEY is not set — authentication disabled.')
    return <App />
  }
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
          showOptionalFields: false,
          logoPlacement: 'none',
          // Production currently runs on Clerk's development instance; hide its
          // "Development mode" badge until a live (pk_live_) key is configured.
          unsafe_disableDevelopmentModeWarnings: true,
        },
        variables: {
          fontFamily: "'Kodchasan', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: '16px',
          colorPrimary: '#FF5734',
          colorText: '#151313',
          colorBackground: '#FFFFFF',
          colorInputBackground: '#F0EEE9',
          colorInputText: '#151313',
          fontSize: '13.5px',
        },
        elements: {
          modalBackdrop: 'cognition-auth-backdrop',
          modalContent: 'cognition-auth-modal',
          cardBox: 'cognition-auth-cardbox',
          card: 'cognition-auth-card',
          header: 'cognition-auth-header',
          headerTitle: 'cognition-auth-title',
          headerSubtitle: 'cognition-auth-subtitle',
          socialButtonsBlockButton: 'cognition-auth-social-btn',
          socialButtonsBlockButtonText: 'cognition-auth-social-text',
          socialButtonsProviderIcon: 'cognition-auth-social-icon',
          dividerRow: 'cognition-auth-divider',
          dividerLine: 'cognition-auth-divider-line',
          dividerText: 'cognition-auth-divider-text',
          main: 'cognition-auth-main',
          form: 'cognition-auth-form',
          formField: 'cognition-auth-field',
          formFieldLabel: 'cognition-auth-label',
          formFieldInput: 'cognition-auth-input',
          formButtonPrimary: 'cognition-auth-submit',
          footer: 'cognition-auth-footer',
          footerItem: 'cognition-auth-footer-item',
          footerAction: 'cognition-auth-footer-action',
          footerActionText: 'cognition-auth-footer-text',
          footerActionLink: 'cognition-auth-footer-link',
        },
      }}
    >
      <App />
    </ClerkProvider>
  )
}

// The app manages its own scroll position between screens; stop the browser
// from restoring a stale offset on reload / back-forward.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
