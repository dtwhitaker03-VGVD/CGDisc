import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'CGDisc',
        short_name: 'CGDisc',
        description: 'Track disc golf rounds, ratings, and handicaps with friends.',
        theme_color: '#0f4438',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Course map images (public/course-maps/*) are large reference
        // images, not core app-shell assets -- exclude them from the
        // install-time precache regardless of extension (some are .png,
        // which would otherwise match globPatterns above).
        globIgnores: ['course-maps/**'],
        // They're also opened as direct full-page navigations
        // (<a target="_blank">). Without this, the SPA's navigate-fallback
        // intercepts that navigation and serves index.html instead of the
        // image, showing a blank app shell.
        navigateFallbackDenylist: [/\/course-maps\//],
      },
    }),
  ],
})
