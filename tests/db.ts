import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, inject } from 'vitest'
import { createDb, type Db } from '~/db/client'
import { runMigrations } from '../scripts/migrate.mjs'

/** Database voor integratietests: een echte Postgres (Testcontainers) met alle migraties. */
export function setupTestDb(): Db {
  const db = createDb(inject('databaseUrl'))
  afterAll(async () => {
    await db.$pool.end()
  })
  return db
}

/** Een eigen, lege database (met migraties) voor tests die een lege gebruikerstabel nodig hebben. */
export function setupFreshDb(): { get: () => Db } {
  let db: Db | undefined
  const baseUrl = inject('databaseUrl')
  beforeAll(async () => {
    const name = `t_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = createDb(baseUrl)
    await admin.execute(sql.raw(`create database ${name}`))
    await admin.$pool.end()
    const url = new URL(baseUrl)
    url.pathname = `/${name}`
    await runMigrations(url.toString())
    db = createDb(url.toString())
  })
  afterAll(async () => {
    await db?.$pool.end()
  })
  return {
    get: () => {
      if (!db) throw new Error('Database nog niet klaar')
      return db
    },
  }
}
