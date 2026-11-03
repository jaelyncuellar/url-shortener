import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    // The UI calls "/api/..." on its own origin; forward those calls to the
    // ASP.NET Core API (backend/) running on port 8080.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
