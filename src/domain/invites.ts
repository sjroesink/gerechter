import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import type { DbOrTx } from '~/db/client'
import { household, invite, type InviteKind } from '~/db/schema'
import { Invalid, NotFound, requireAdmin, requireOwner, type Ctx, type UserCtx } from './core'

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

export function inviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/uitnodiging/${token}`
}

export type CreatedInvite = { id: string; token: string; expiresAt: Date }

/** Eigenaar nodigt iemand uit voor het eigen huishouden. */
export async function createMemberInvite(ctx: Ctx, now = new Date()): Promise<CreatedInvite> {
  requireOwner(ctx)
  const token = newToken()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS)
  const [row] = await ctx.db
    .insert(invite)
    .values({
      tokenHash: hashToken(token),
      kind: 'member',
      householdId: ctx.household.id,
      createdBy: ctx.user.id,
      expiresAt,
    })
    .returning({ id: invite.id })
  return { id: row!.id, token, expiresAt }
}

/** Platformbeheerder nodigt iemand uit om een nieuw huishouden te starten. */
export async function createHouseholdInvite(
  ctx: UserCtx,
  proposedHouseholdName: string,
  now = new Date(),
): Promise<CreatedInvite> {
  requireAdmin(ctx)
  const name = proposedHouseholdName.trim()
  if (!name) throw new Invalid('Geef het huishouden een naam.')
  const token = newToken()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS)
  const [row] = await ctx.db
    .insert(invite)
    .values({
      tokenHash: hashToken(token),
      kind: 'new_household',
      proposedHouseholdName: name,
      createdBy: ctx.user.id,
      expiresAt,
    })
    .returning({ id: invite.id })
  return { id: row!.id, token, expiresAt }
}

export type InviteProblem = 'unknown' | 'expired' | 'used' | 'revoked'

export type InviteInfo =
  | { ok: true; id: string; kind: InviteKind; householdId: string | null; householdName: string }
  | { ok: false; problem: InviteProblem }

/** Leest een uitnodiging zonder hem te verbruiken (voor de uitnodigingspagina). */
export async function inspectInvite(db: DbOrTx, token: string, now = new Date()): Promise<InviteInfo> {
  const [row] = await db
    .select({
      id: invite.id,
      kind: invite.kind,
      householdId: invite.householdId,
      proposedName: invite.proposedHouseholdName,
      householdName: household.name,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      revokedAt: invite.revokedAt,
    })
    .from(invite)
    .leftJoin(household, eq(household.id, invite.householdId))
    .where(eq(invite.tokenHash, hashToken(token)))
  if (!row) return { ok: false, problem: 'unknown' }
  if (row.revokedAt) return { ok: false, problem: 'revoked' }
  if (row.usedAt) return { ok: false, problem: 'used' }
  if (row.expiresAt <= now) return { ok: false, problem: 'expired' }
  return {
    ok: true,
    id: row.id,
    kind: row.kind,
    householdId: row.householdId,
    householdName: row.householdName ?? row.proposedName ?? 'Nieuw huishouden',
  }
}

export const inviteProblemMessages: Record<InviteProblem, string> = {
  unknown: 'Deze uitnodiging bestaat niet.',
  expired: 'Deze uitnodiging is verlopen. Vraag om een nieuwe link.',
  used: 'Deze uitnodiging is al gebruikt.',
  revoked: 'Deze uitnodiging is ingetrokken.',
}

/**
 * Verbruikt een uitnodiging atomair: slaagt alleen als hij op dit moment nog geldig is.
 * Roep aan binnen dezelfde transactie die het lidmaatschap of huishouden aanmaakt.
 */
export async function consumeInvite(db: DbOrTx, token: string, userId: string, now = new Date()) {
  const [row] = await db
    .update(invite)
    .set({ usedAt: now, usedBy: userId })
    .where(
      and(
        eq(invite.tokenHash, hashToken(token)),
        isNull(invite.usedAt),
        isNull(invite.revokedAt),
        gt(invite.expiresAt, now),
      ),
    )
    .returning({
      id: invite.id,
      kind: invite.kind,
      householdId: invite.householdId,
      proposedHouseholdName: invite.proposedHouseholdName,
    })
  if (!row) {
    const info = await inspectInvite(db, token, now)
    throw new Invalid(inviteProblemMessages[info.ok ? 'used' : info.problem])
  }
  return row
}

/** Eigenaar trekt een openstaande uitnodiging van het eigen huishouden in. */
export async function revokeInvite(ctx: Ctx, inviteId: string, now = new Date()): Promise<void> {
  requireOwner(ctx)
  const rows = await ctx.db
    .update(invite)
    .set({ revokedAt: now })
    .where(and(eq(invite.id, inviteId), eq(invite.householdId, ctx.household.id), isNull(invite.usedAt)))
    .returning({ id: invite.id })
  if (rows.length === 0) throw new NotFound('Uitnodiging niet gevonden.')
}

/** Openstaande uitnodigingen van het actieve huishouden. */
export async function listOpenInvites(ctx: Ctx, now = new Date()) {
  return ctx.db
    .select({ id: invite.id, createdAt: invite.createdAt, expiresAt: invite.expiresAt })
    .from(invite)
    .where(
      and(
        eq(invite.householdId, ctx.household.id),
        isNull(invite.usedAt),
        isNull(invite.revokedAt),
        gt(invite.expiresAt, now),
      ),
    )
    .orderBy(desc(invite.createdAt))
}
