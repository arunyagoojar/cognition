import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.warn('[Cognition] VITE_CLERK_PUBLISHABLE_KEY is not set — authentication disabled.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        variables: {
          fontFamily: "'Kodchasan', -apple-system, sans-serif",
          borderRadius: '16px',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
