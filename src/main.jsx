import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

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
          form: 'cognition-auth-form',
          formField: 'cognition-auth-field',
          formFieldLabel: 'cognition-auth-label',
          formFieldInput: 'cognition-auth-input',
          formButtonPrimary: 'cognition-auth-submit',
          footer: 'cognition-auth-footer',
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
