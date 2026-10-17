import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Serve the same small asset directory in development and production.
// Media is resolved through R2; public/ may hold a local upload archive.
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

export default defineConfig({
  plugins: [react(), tailwindcss(), dropUnusedOrtWasm],
  publicDir: process.env.PUBLIC_DIR_OVERRIDE || 'public-static',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  // Production builds are same-origin: the Worker serves the SPA and /api/*.
  // .env's absolute VITE_API_BASE_URL is for `vite dev` only — force it out.
  define: process.env.PUBLIC_DIR_OVERRIDE
    ? { 'import.meta.env.VITE_API_BASE_URL': '""' }
    : {},
})
