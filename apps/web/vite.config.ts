import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW personalizado (push + notificationclick + caché del boleto + bg-sync).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Precachear el shell; el HTML lo sirve navigateFallback en runtime.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'maskable-512.png',
        'apple-touch-icon.png',
        'og-default.png',
        'offline.html',
        // Manifest dedicado del administrador (marca Sortea, abre directo en /admin).
        // El manifest público lo genera vite-plugin-pwa; este es estático.
        'admin.webmanifest',
      ],
      manifest: {
        name: 'Rifas y sorteos',
        short_name: 'Rifas',
        description: 'Aparta tus boletos, paga fácil y recibe tu boleto digital con QR.',
        theme_color: '#2751fb',
        background_color: '#070b18',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es-MX',
        icons: [
          // PNG (instalación real en iOS/Android, instalabilidad de Lighthouse).
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          // SVG escalable como extra para navegadores que lo soporten.
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@bismark/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy de la API en desarrollo para compartir cookies same-origin.
      // El backend monta sus rutas bajo /api (mismo path que en producción).
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Archivos subidos (imágenes) servidos por la API.
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      '/demo-assets': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
