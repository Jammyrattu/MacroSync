import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // import.meta.dirname, not __dirname — Vite 8's native config loader
      // does not provide the CJS globals.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
