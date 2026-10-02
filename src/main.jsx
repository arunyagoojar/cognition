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
        variables: {
          fontFamily: "'Kodchasan', -apple-system, sans-serif",
          borderRadius: '18px',
          colorPrimary: '#FF5734',
          colorBackground: '#FFFFFF',
          colorText: '#151313',
          colorInputBackground: '#F7F7F5',
          colorInputText: '#151313',
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
