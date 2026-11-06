import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { householdPreferences } from '~/db/schema'
import type { Ctx } from './core'
import { parseInput } from './core/validation'

export const preferencesInput = z.object({ defaultServings: z.number().int().min(1).max(1000) }).strict()
export async function getHouseholdPreferences(ctx: Ctx) {
  const [row] = await ctx.db
    .select({ defaultServings: householdPreferences.defaultServings })
    .from(householdPreferences)
    .where(eq(householdPreferences.householdId, ctx.household.id))
  return row ?? { defaultServings: 2 }
}
export async function setHouseholdPreferences(ctx: Ctx, input: z.input<typeof preferencesInput>) {
  const data = parseInput(preferencesInput, input)
  await ctx.db
    .insert(householdPreferences)
    .values({ householdId: ctx.household.id, ...data })
    .onConflictDoUpdate({ target: householdPreferences.householdId, set: data })
  return getHouseholdPreferences(ctx)
}
