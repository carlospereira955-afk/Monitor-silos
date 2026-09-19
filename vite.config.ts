import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Monitor de Silos',
        short_name: 'Silos',
        description:
          'Monitorização do nível de ração em silos via sensores SenseCAP (LoRaWAN/SenseCraft).',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App-shell offline: os dados vivos (MQTT) não passam por aqui,
        // mas a app deve continuar a abrir e a mostrar as últimas leituras
        // guardadas mesmo sem rede.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: true,
  },
})
