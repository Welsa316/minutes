import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Load env from the repo root so the single root .env feeds both server and
  // client (only VITE_-prefixed vars are ever exposed to the client bundle).
  envDir: '..',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
      manifest: {
        name: 'Minutes',
        short_name: 'Minutes',
        description: 'Personal CRM and meeting notes',
        theme_color: '#0F1B2D',
        background_color: '#FBF8F3',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Don't pin navigations to a precached index.html — that's the "stale app"
        // trap where a new deploy never shows up. Serve the shell network-first
        // instead (see the first runtimeCaching rule below), so every launch
        // fetches the latest build and only falls back to cache when offline.
        navigateFallback: null,
        runtimeCaching: [
          {
            // App shell / page loads: network-first so new deploys appear on the
            // next launch. Falls back to the last cached shell when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'minutes-shell',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API calls: try the network first so data stays fresh, fall back to cache offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'minutes-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static assets: hash-busted by Vite, safe to serve from cache first.
            urlPattern: ({ request }) =>
              ['style', 'script', 'image', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'minutes-static',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
