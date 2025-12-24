import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // ✅ Tells Vite to skip bundling these native C++ modules
      external: ['sqlite3', 'bcrypt']
    }
  }
})