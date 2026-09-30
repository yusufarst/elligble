/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Development keeps the API same-origin through the Vite proxy so the HttpOnly,
// SameSite=Strict session cookie behaves exactly as in production, where the runtime
// serves the built client and the API from one origin.
const apiTarget = process.env.ELLIGBLE_API_URL ?? 'http://127.0.0.1:3000';

// The built address of the teacher and proctor screens (one file, src/staff-screens.ts, WEB-001)
// in index.html, so "Coba Lagi" can ask for that file again under a new address after a failed
// download: an engine may keep the failed download for the page, WebKit even after a reload.
function staffScreensAddress(): Plugin {
  let base = '/';
  return {
    name: 'elligble-staff-screens-address',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const file = Object.values(ctx.bundle ?? {}).find(
          output => output.type === 'chunk' && output.facadeModuleId?.endsWith('/src/staff-screens.ts'),
        );
        if (!file) throw new Error('The build has no file of the teacher and proctor screens (src/staff-screens.ts).');
        return [{ tag: 'meta', attrs: { name: 'elligble-staff-screens', content: `${base}${file.fileName}` }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), staffScreensAddress()],
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
