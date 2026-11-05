import { defineConfig, devices } from '@playwright/test'

/**
 * Standaard: bouwt de app en start hem tegen een lege database `gerechter_e2e` (in de docker-compose Postgres).
 * Met E2E_BASE_URL (+ E2E_DATABASE_URL en E2E_ADMIN_EMAIL) draait de suite tegen een al draaiende omgeving,
 * bijvoorbeeld een verse docker-compose-stack.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const EXTERNAL = process.env.E2E_BASE_URL
const BASE_URL = EXTERNAL ?? `http://localhost:${PORT}`
const ADMIN_URL =
  process.env.E2E_ADMIN_DATABASE_URL ?? 'postgres://gerechter:gerechter@localhost:5432/gerechter'
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? ADMIN_URL.replace(/\/[^/]+$/, '/gerechter_e2e')
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'beheer@e2e.test'
export const E2E_BASE_URL = BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    ...devices['Pixel 7'],
    viewport: { width: 360, height: 780 },
  },
  webServer: EXTERNAL
    ? undefined
    : {
        // Tegen een productiebuild: stabieler dan de dev-server en test meteen build + start (met migraties).
        command: `node e2e/prepare-db.mjs && pnpm build && node scripts/start.mjs`,
        url: `${BASE_URL}/login`,
        reuseExistingServer: false,
        timeout: 300_000,
        env: {
          DATABASE_URL: E2E_DATABASE_URL,
          PUBLIC_BASE_URL: BASE_URL,
          BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0000',
          ADMIN_EMAIL: E2E_ADMIN_EMAIL,
          PORT: String(PORT),
        },
      },
})
