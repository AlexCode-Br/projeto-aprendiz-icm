// Ficheiro: vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // Legacy API paths are still public contracts; do not send them to SPA fallback.
      '^/(api|alunos|cursos|professores|frequencia|dev-mail)(/|\\?|$)': 'http://127.0.0.1:4180',
    },
  },
})
