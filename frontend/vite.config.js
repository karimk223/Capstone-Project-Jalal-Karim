import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config.
 *
 * The dev server runs on http://localhost:5173 by default. We proxy /api/* to
 * the backend on :3001 so that during development the frontend can call
 * `/api/v1/auth/login` directly without CORS headaches and without hard-coding
 * the backend URL into every component.
 *
 * In production the frontend is built to /dist and served by any static host;
 * the proxy disappears and `VITE_API_BASE_URL` (read by src/api/client.js)
 * takes over.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
