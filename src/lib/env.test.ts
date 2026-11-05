import { describe, expect, test } from 'vitest'
import { EnvError, parseEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/gerechter',
  PUBLIC_BASE_URL: 'http://localhost:3000/',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ADMIN_EMAIL: 'admin@example.com',
}

describe('parseEnv', () => {
  test('accepteert een geldige configuratie en normaliseert de basis-URL', () => {
    const env = parseEnv(valid)
    expect(env.PUBLIC_BASE_URL).toBe('http://localhost:3000')
    expect(env.PORT).toBe(3000)
  })

  test.each(Object.keys(valid))('noemt %s als die ontbreekt', (name) => {
    const source: Record<string, string | undefined> = { ...valid, [name]: undefined }
    expect(() => parseEnv(source)).toThrowError(EnvError)
    expect(() => parseEnv(source)).toThrowError(`${name} ontbreekt`)
  })

  test('meldt een te kort geheim', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'kort' })).toThrowError(/BETTER_AUTH_SECRET/)
  })
})
