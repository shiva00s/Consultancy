import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // ✅ FIX: Use relative paths for Electron
  build: {
    outDir: 'dist',
    rollupOptions: {
      // ✅ Tells Vite to skip bundling these native C++ modules
      external: ['sqlite3', 'bcrypt']
    }
  },
  server: {
    port: 5173,
  }
})
