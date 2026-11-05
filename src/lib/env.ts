import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PUBLIC_BASE_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, '')),
  BETTER_AUTH_SECRET: z.string().min(32, 'moet minstens 32 tekens lang zijn'),
  ADMIN_EMAIL: z.string().email(),
  PORT: z.coerce.number().int().positive().default(3000),
})

export type Env = z.infer<typeof envSchema>

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Ongeldige configuratie:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
    this.name = 'EnvError'
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (result.success) return result.data
  throw new EnvError(
    result.error.issues.map((issue) => {
      const name = issue.path.join('.')
      return source[name] === undefined || source[name] === ''
        ? `${name} ontbreekt`
        : `${name}: ${issue.message}`
    }),
  )
}

let cached: Env | undefined

export function env(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
