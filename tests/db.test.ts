import { sql } from 'drizzle-orm'
import { expect, test } from 'vitest'
import { setupTestDb } from './db'

const db = setupTestDb()

test('database is bereikbaar en pg_trgm staat aan', async () => {
  const one = await db.execute(sql`select 1 as one`)
  expect(one.rows[0]).toEqual({ one: 1 })
  const ext = await db.execute(sql`select extname from pg_extension where extname = 'pg_trgm'`)
  expect(ext.rows).toHaveLength(1)
})
