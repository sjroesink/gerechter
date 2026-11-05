// Alleen voor `pnpm auth:generate`: de Better Auth CLI leest deze export om het schema te genereren.
import { createDb } from '~/db/client'
import { parseEnv } from '~/lib/env'
import { createAuth } from './auth'

const env = parseEnv({
  DATABASE_URL: 'postgres://gerechter:gerechter@localhost:5432/gerechter',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'schema-generation-only-secret-000000',
  ADMIN_EMAIL: 'admin@example.com',
})

export const auth = createAuth(createDb(env.DATABASE_URL), env)
