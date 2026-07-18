import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Stamped into the bundle at build time so the admin can tell at a glance whether
// a deploy has actually gone live — instead of guessing and hammering Ctrl+F5.
// The commit is best-effort: absent (empty) if the build env has no git.
const BUILD_TIME = new Date().toISOString();
let BUILD_COMMIT = '';
try { BUILD_COMMIT = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git in build env */ }

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // main.jsx registers the SW itself (it also checks for updates on focus and
      // reloads once a new one takes over). Without this the plugin emits its own
      // registerSW.js and injects it into index.html, registering a second time.
      injectRegister: null,
      // The app shell's own images. Everything else in public/ (mascot art, guide
      // screenshots) is fetched on demand — see globPatterns below. mascot-hood is
      // here because it is the splash the PWA start_url (/app → AppLauncher) shows.
      includeAssets: ['apple-touch-icon.png', 'logo-mark.png', 'logo-adini.png', 'mascot-hood.jpg'],
      manifest: {
        name: 'CLICKI — органические просмотры',
        short_name: 'CLICKI',
        description:
          'Performance-платформа органических просмотров с оплатой за результат. Реклама через UGC-креаторов.',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#0b0a1c',
        background_color: '#0e0b20',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        // Launcher route: sends a signed-in creator/business straight to their
        // cabinet, everyone else to the login choice. See client AppLauncher.
        start_url: '/app',
        categories: ['business', 'marketing', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // SPA fallback, but never hijack the API or uploaded media.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        // No `png` here on purpose: it swept every image in public/ into the
        // precache — ~3 MB of mascot art (mascot.png alone is 1.5 MB and only ever
        // renders as a small button) plus 550 KB of guide screenshots, downloaded
        // by every first-time visitor before they touch anything. The shell images
        // we do want are listed in includeAssets; the rest load from the network,
        // where they are already cached for an hour by the static handler.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Activate a freshly-deployed SW immediately instead of waiting for all
        // tabs to close — with autoUpdate this stops the app serving stale
        // assets after a deploy (the "залипание" seen during testing).
        skipWaiting: true,
      },
      // Allow testing the installable app on `vite preview` / local prod.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    // Proxy API + uploaded media to the Express backend during development.
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep big vendors in their own long-cached chunks, separate from app code.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
        },
      },
    },
  },
});
