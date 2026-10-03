import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The full public/ directory holds the local R2 upload source media (multi-GB,
// gitignored) and is never shipped. Production/deploys build against
// public-static/ (icons only) via PUBLIC_DIR_OVERRIDE.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  publicDir: process.env.PUBLIC_DIR_OVERRIDE || 'public',
  // Production builds are same-origin: the Worker serves the SPA and /api/*.
  // .env's absolute VITE_API_BASE_URL is for `vite dev` only — force it out.
  define: process.env.PUBLIC_DIR_OVERRIDE
    ? { 'import.meta.env.VITE_API_BASE_URL': '""' }
    : {},
}))
