import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { parseWorkerAppUrl } from './apps/pages/app-url.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  // miniapp build: full React app (root index.html + Telegram SDK + Tailwind) → dist-miniapp/
  if (command === 'build' && mode === 'miniapp') {
    return {
      root,
      envDir: root,
      base: './',
      plugins: [react(), tailwindcss()],
      build: { outDir: fileURLToPath(new URL('./dist-miniapp', import.meta.url)), emptyOutDir: true },
    };
  }
  if (command === 'build' && mode !== 'legacy') {
    const env = loadEnv(mode, root, 'VITE_');
    const appUrl = parseWorkerAppUrl(env.VITE_AEL_APP_URL);
    if (process.env.REQUIRE_AEL_APP_URL === '1' && !appUrl) {
      throw new Error('Set VITE_AEL_APP_URL to the approved Worker URL before publishing Pages.');
    }
    return {
      root: fileURLToPath(new URL('./apps/pages', import.meta.url)),
      envDir: root,
      base: './',
      publicDir: false,
      plugins: [react()],
      build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
    };
  }

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist-legacy' },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});