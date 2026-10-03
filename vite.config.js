import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The full public/ directory holds the local R2 upload source media (multi-GB,
// gitignored) and is never shipped. Production/deploys build against
// public-static/ (icons only) via PUBLIC_DIR_OVERRIDE.
// transformers.js (on-device speech model) loads the ONNX Runtime engine from
// the jsDelivr CDN at runtime (env.backends.onnx.wasm.wasmPaths). The bundler
// still emits onnxruntime-web's own ~27 MB .wasm fallback, which is never
// fetched and exceeds Cloudflare's 25 MiB static-asset limit — drop it.
const dropUnusedOrtWasm = {
  name: 'drop-unused-ort-wasm',
  generateBundle(_, bundle) {
    for (const file of Object.keys(bundle)) {
      if (/ort-wasm[\w.-]*\.wasm$/.test(file)) delete bundle[file];
    }
  },
};

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), dropUnusedOrtWasm],
  publicDir: process.env.PUBLIC_DIR_OVERRIDE || 'public',
  // Production builds are same-origin: the Worker serves the SPA and /api/*.
  // .env's absolute VITE_API_BASE_URL is for `vite dev` only — force it out.
  define: process.env.PUBLIC_DIR_OVERRIDE
    ? { 'import.meta.env.VITE_API_BASE_URL': '""' }
    : {},
}))
