/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Development keeps the API same-origin through the Vite proxy so the HttpOnly,
// SameSite=Strict session cookie behaves exactly as in production, where the runtime
// serves the built client and the API from one origin.
const apiTarget = process.env.ELLIGBLE_API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Stylesheets stay out of component tests; the design system guard reads them as text.
    css: { include: [/\.css\?raw$/] },
  },
});
