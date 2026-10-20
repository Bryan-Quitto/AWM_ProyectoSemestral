import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const carpeta = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({
  root: carpeta, plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: /^(?:\.\.\/)+api\/generated\/api\/api$/, replacement: resolve(carpeta, 'apiSimulada.ts') },
    { find: /^(?:\.\.\/)+lib\/supabase$/, replacement: resolve(carpeta, 'sesionSimulada.ts') },
  ] },
  server: { host: '127.0.0.1', port: 55441, strictPort: true, fs: { allow: [resolve(carpeta, '../..')] } },
})
