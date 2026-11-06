import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildPwa } from './src/pwa/build'

const { worker } = buildPwa()

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['main-pc'],
    port: Number(process.env.PORT ?? 3000),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Nitro 3 virtual handlers are bundled into the actual production server.
      handlers: [{ route: '/sw.js', handler: '#gerechter-pwa-worker' }],
      virtual: {
        '#gerechter-pwa-worker': `export default () => new Response(${JSON.stringify(worker)}, { headers: ${JSON.stringify(
          {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'no-cache, no-store',
            'cloudflare-cdn-cache-control': 'no-store',
            'service-worker-allowed': '/',
            'x-content-type-options': 'nosniff',
          },
        )} })`,
      },
      routeRules: {
        '/manifest.webmanifest': {
          headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'no-cache',
          },
        },
      },
    }),
    viteReact(),
  ],
})
