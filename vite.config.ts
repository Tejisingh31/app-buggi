/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * Regole di sicurezza (Content Security Policy) per l'app pubblicata:
 * il browser rifiuta qualsiasi collegamento verso altri siti (niente statistiche,
 * pubblicità o librerie da CDN). Solo nella build: in sviluppo Vite ha bisogno di più libertà.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ') + ';';

function sicurezzaContenuti(): Plugin {
  return {
    name: 'buggi-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="no-referrer" />`),
  };
}

export default defineConfig({
  base: '/app-buggi/',
  plugins: [
    react(),
    sicurezzaContenuti(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Buggi',
        short_name: 'Buggi',
        description: 'Gestione pagamenti, tutto salvato sul telefono',
        lang: 'it',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app-buggi/',
        scope: '/app-buggi/',
        background_color: '#15012b', // sfondo del logo: schermata di avvio su Android
        theme_color: '#6d28d9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/app-buggi/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
