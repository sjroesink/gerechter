import { and, desc, eq } from 'drizzle-orm'
import type { DbOrTx } from '~/db/client'
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from '~/db/schema'
import { NotFound, type UserCtx } from './core'

/** MCP-clients (agents) waaraan de gebruiker toegang heeft gegeven. */
export async function listConnectedApps(ctx: UserCtx) {
  const rows = await ctx.db
    .select({
      id: oauthConsent.id,
      clientId: oauthConsent.clientId,
      name: oauthClient.name,
      scopes: oauthConsent.scopes,
      createdAt: oauthConsent.createdAt,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, ctx.user.id))
    .orderBy(desc(oauthConsent.createdAt))
  return rows.map((r) => ({ ...r, name: r.name ?? 'Onbekende app' }))
}

/** Trekt de toegang van een client in: toestemming en alle tokens van deze gebruiker voor die client. */
export async function revokeConnectedApp(ctx: UserCtx, consentId: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const [consent] = await tx
      .select({ clientId: oauthConsent.clientId })
      .from(oauthConsent)
      .where(and(eq(oauthConsent.id, consentId), eq(oauthConsent.userId, ctx.user.id)))
    if (!consent) throw new NotFound('Verbonden app niet gevonden.')
    const mine = (table: typeof oauthAccessToken | typeof oauthRefreshToken) =>
      and(eq(table.userId, ctx.user.id), eq(table.clientId, consent.clientId))
    await tx.delete(oauthAccessToken).where(mine(oauthAccessToken))
    await tx.delete(oauthRefreshToken).where(mine(oauthRefreshToken))
    await tx.delete(oauthConsent).where(eq(oauthConsent.id, consentId))
  })
}

/**
 * Toegangstokens zijn JWT's en blijven cryptografisch geldig tot ze verlopen. De MCP-adapter controleert
 * daarom per aanroep of de toestemming nog bestaat, zodat intrekken direct werkt.
 */
export async function hasConsent(db: DbOrTx, userId: string, clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: oauthConsent.id })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
  return row !== undefined
}
