import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['main-pc'],
    port: Number(process.env.PORT ?? 3000),
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
})
