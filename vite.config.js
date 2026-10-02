import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The full public/ directory holds the local R2 upload source media (multi-GB,
// gitignored) and is never shipped. Production/deploys build against
// public-static/ (icons only) via PUBLIC_DIR_OVERRIDE.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  publicDir: process.env.PUBLIC_DIR_OVERRIDE || 'public',
}))
