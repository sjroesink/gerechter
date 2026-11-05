import { and, eq, sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { beforeAll, describe, expect, test } from 'vitest'
import { NotFound, type Ctx } from '~/domain/core'
import { setupTestDb } from './db'
import { expectHidden, twoHouseholds } from './isolation'

const db = setupTestDb()

// Een tijdelijke tabel zoals latere modules die krijgen: elke rij hoort bij één huishouden.
const note = pgTable('test_note', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  text: text('text').notNull(),
})

async function getNote(ctx: Ctx, id: string) {
  const [row] = await ctx.db
    .select()
    .from(note)
    .where(and(eq(note.id, id), eq(note.householdId, ctx.household.id)))
  if (!row) throw new NotFound()
  return row
}

async function renameNote(ctx: Ctx, id: string, text: string) {
  const rows = await ctx.db
    .update(note)
    .set({ text })
    .where(and(eq(note.id, id), eq(note.householdId, ctx.household.id)))
    .returning()
  if (rows.length === 0) throw new NotFound()
}

beforeAll(async () => {
  await db.execute(
    sql`create table if not exists test_note (id text primary key, household_id text not null, text text not null)`,
  )
})

describe('afschermingshelper', () => {
  test('gegevens van huishouden A zijn onzichtbaar en onwijzigbaar vanuit B', async () => {
    const { a, b } = await twoHouseholds(db)
    const id = crypto.randomUUID()
    await db.insert(note).values({ id, householdId: a.household.id, text: 'van A' })

    expect((await getNote(a, id)).text).toBe('van A')
    await expectHidden(getNote(b, id))
    await expectHidden(renameNote(b, id, 'gekaapt'))
    expect((await getNote(a, id)).text).toBe('van A')
  })
})
