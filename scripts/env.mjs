import { z } from 'zod'

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    PUBLIC_BASE_URL: z
      .string()
      .url()
      .transform((url) => url.replace(/\/+$/, '')),
    BETTER_AUTH_SECRET: z.string().min(32, 'moet minstens 32 tekens lang zijn'),
    ADMIN_EMAIL: z.string().email(),
    PORT: z.coerce.number().int().positive().default(3000),
    AH_SIDECAR_URL: z
      .union([
        z.literal(''),
        z
          .string()
          .url()
          .refine((value) => /^https?:\/\//.test(value), 'gebruik een http- of https-URL'),
      ])
      .default('')
      .transform((value) => value.replace(/\/+$/, '')),
    AH_SIDECAR_SECRET: z.string().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.AH_SIDECAR_URL && data.AH_SIDECAR_SECRET.length < 32)
      ctx.addIssue({
        code: 'custom',
        path: ['AH_SIDECAR_SECRET'],
        message: 'moet bij een sidecar-URL minstens 32 tekens lang zijn',
      })
    if (data.AH_SIDECAR_SECRET && !data.AH_SIDECAR_URL)
      ctx.addIssue({
        code: 'custom',
        path: ['AH_SIDECAR_URL'],
        message: 'is verplicht bij een sidecargeheim',
      })
  })

export class EnvError extends Error {
  constructor(issues) {
    super(`Ongeldige configuratie:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
    this.issues = issues
    this.name = 'EnvError'
  }
}

/** Eén schema voor de server-start, de applicatie en de tests. */
export function parseEnv(source) {
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
