import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  shoppingConnection,
  shoppingTargets,
  syncRun,
  syncSourceClaim,
  type ShoppingTargetId,
} from '~/db/schema'
import { Conflict, Forbidden, Invalid, NotFound, requireOwner, type Ctx } from './core'
import { parseInput } from './core/validation'
import { calculateShoppingNeeds, prepareShopping, shoppingSourceInput } from './shopping-needs'
import { openShoppingSecret, sealShoppingSecret } from './shopping-secrets'
import type { ShoppingDeps, ShoppingProviderResult } from './shopping-target'

const id = z.string().min(1).max(100)
export const notionConnectionInput = z
  .object({
    pageId: z.string().uuid(),
    token: z
      .string()
      .trim()
      .min(8)
      .max(5000)
      .regex(/^\S+$/, 'Het token mag geen spaties of regeleinden bevatten.'),
  })
  .strict()
export const shoppingExportInput = z
  .object({
    source: shoppingSourceInput,
    requestId: z.string().uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    target: z.enum(shoppingTargets),
    allowRepeat: z.boolean().default(false),
  })
  .strict()
export const shareOutcomeInput = z
  .object({ runId: id, outcome: z.enum(['copied', 'shared', 'cancelled']) })
  .strict()
const scopedRun = (ctx: Ctx, runId: string) =>
  and(eq(syncRun.id, runId), eq(syncRun.householdId, ctx.household.id))

async function connectionFor(ctx: Ctx, target: Exclude<ShoppingTargetId, 'share'>) {
  const [row] = await ctx.db
    .select()
    .from(shoppingConnection)
    .where(and(eq(shoppingConnection.householdId, ctx.household.id), eq(shoppingConnection.target, target)))
  return row
}
const targetKeyFor = (target: string, destination?: string) =>
  target === 'share' ? 'share' : `${target}:${destination}`
async function storeConnection(
  ctx: Ctx,
  target: Exclude<ShoppingTargetId, 'share'>,
  destinationId: string,
  value: string,
  secret: string,
) {
  await ctx.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`shopping:${ctx.household.id}`}, 0))`,
    )
    const old = await connectionFor({ ...ctx, db: tx }, target)
    if (old && old.destinationId !== destinationId)
      await tx
        .update(syncRun)
        .set({
          status: 'uncertain',
          message: 'De verbinding is gewijzigd voordat het resultaat was bevestigd.',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(syncRun.householdId, ctx.household.id),
            eq(syncRun.connectionId, old.id),
            eq(syncRun.status, 'pending'),
          ),
        )
    const fields = {
      destinationId,
      encryptedSecret: sealShoppingSecret(value, secret, ctx.household.id),
      updatedAt: new Date(),
    }
    await tx
      .insert(shoppingConnection)
      .values({ householdId: ctx.household.id, target, ...fields })
      .onConflictDoUpdate({
        target: [shoppingConnection.householdId, shoppingConnection.target],
        set: { ...fields, version: sql`${shoppingConnection.version} + 1` },
      })
  })
  return getShoppingTargets(ctx)
}
async function findRun(ctx: Ctx, runId: string) {
  const [row] = await ctx.db.select().from(syncRun).where(scopedRun(ctx, runId))
  if (!row) throw new NotFound('Boodschappenexport niet gevonden.')
  return row
}
export async function getShoppingTargets(ctx: Ctx) {
  const rows = await ctx.db
    .select({ target: shoppingConnection.target, destinationId: shoppingConnection.destinationId })
    .from(shoppingConnection)
    .where(eq(shoppingConnection.householdId, ctx.household.id))
  return {
    canManage: ctx.household.role === 'owner',
    targets: shoppingTargets.map((target) => {
      const connection = rows.find((row) => row.target === target)
      return {
        target,
        configured: target === 'share' || Boolean(connection),
        destinationId: connection?.destinationId ?? null,
        targetKey:
          target === 'share' ? 'share' : connection ? targetKeyFor(target, connection.destinationId) : null,
      }
    }),
  }
}
export async function saveNotionConnection(
  ctx: Ctx,
  input: z.input<typeof notionConnectionInput>,
  secret: string,
) {
  requireOwner(ctx)
  const data = parseInput(notionConnectionInput, input)
  return storeConnection(ctx, 'notion', data.pageId.toLowerCase(), data.token, secret)
}
export async function removeShoppingConnection(ctx: Ctx, target: Exclude<ShoppingTargetId, 'share'>) {
  requireOwner(ctx)
  parseInput(z.enum(['notion', 'ah']), target)
  await ctx.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`shopping:${ctx.household.id}`}, 0))`,
    )
    const [connection] = await tx
      .select({ id: shoppingConnection.id })
      .from(shoppingConnection)
      .where(and(eq(shoppingConnection.householdId, ctx.household.id), eq(shoppingConnection.target, target)))
    if (connection)
      await tx
        .update(syncRun)
        .set({
          status: 'uncertain',
          message: 'De verbinding is losgekoppeld voordat het resultaat was bevestigd.',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(syncRun.householdId, ctx.household.id),
            eq(syncRun.connectionId, connection.id),
            eq(syncRun.status, 'pending'),
          ),
        )
    await tx
      .delete(shoppingConnection)
      .where(and(eq(shoppingConnection.householdId, ctx.household.id), eq(shoppingConnection.target, target)))
  })
  return getShoppingTargets(ctx)
}

export async function saveAhConnection(
  ctx: Ctx,
  input: { connectionId: string; connectionKey: string },
  secret: string,
) {
  requireOwner(ctx)
  const data = parseInput(
    z
      .object({
        connectionId: z.string().uuid(),
        connectionKey: z
          .string()
          .min(32)
          .max(128)
          .regex(/^[A-Za-z0-9_-]+$/),
      })
      .strict(),
    input,
  )
  return storeConnection(ctx, 'ah', data.connectionId, data.connectionKey, secret)
}

/** Server-only use during owner connect/disconnect; never returned by a read adapter. */
export async function getAhConnectionReference(ctx: Ctx, secret: string) {
  requireOwner(ctx)
  const connection = await connectionFor(ctx, 'ah')
  return connection
    ? {
        connectionId: connection.destinationId,
        connectionKey: openShoppingSecret(connection.encryptedSecret, secret, ctx.household.id),
      }
    : null
}
/** Server-only: lets any member use the household's AH connection for read-only product search. */
export async function getAhConnectionForMember(ctx: Ctx, secret: string) {
  const connection = await connectionFor(ctx, 'ah')
  return connection
    ? {
        destinationId: connection.destinationId,
        secret: openShoppingSecret(connection.encryptedSecret, secret, ctx.household.id),
      }
    : null
}
export async function getSyncRun(ctx: Ctx, runId: string) {
  const row = await findRun(ctx, runId)
  return {
    id: row.id,
    actorName: row.actorName,
    isMine: row.actorId === ctx.user.id,
    target: row.target,
    source: row.source,
    snapshot: row.snapshot,
    status: row.status,
    externalUrl: row.externalUrl,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    checkedAt: row.checkedAt,
  }
}
export async function listSyncRuns(ctx: Ctx) {
  return ctx.db
    .select({
      id: syncRun.id,
      title: sql<string>`${syncRun.snapshot}->>'title'`,
      actorName: syncRun.actorName,
      target: syncRun.target,
      status: syncRun.status,
      sourceKeys: syncRun.sourceKeys,
      createdAt: syncRun.createdAt,
    })
    .from(syncRun)
    .where(eq(syncRun.householdId, ctx.household.id))
    .orderBy(desc(syncRun.createdAt), desc(syncRun.id))
    .limit(100)
}
export async function getShoppingPreview(ctx: Ctx, source: z.input<typeof shoppingSourceInput>) {
  const proposal = await prepareShopping(ctx, source)
  const claims = proposal.sourceKeys.length
    ? await ctx.db
        .select({
          runId: syncRun.id,
          target: syncRun.target,
          targetKey: syncSourceClaim.targetKey,
          status: syncRun.status,
          sourceKey: syncSourceClaim.sourceKey,
          createdAt: syncRun.createdAt,
        })
        .from(syncSourceClaim)
        .innerJoin(
          syncRun,
          and(eq(syncRun.id, syncSourceClaim.runId), eq(syncRun.householdId, ctx.household.id)),
        )
        .where(
          and(
            eq(syncSourceClaim.householdId, ctx.household.id),
            inArray(syncSourceClaim.sourceKey, proposal.sourceKeys),
          ),
        )
    : []
  return { proposal, ...(await getShoppingTargets(ctx)), previousExports: claims }
}

async function releaseSourceClaims(ctx: Ctx, runId: string) {
  const claims = await ctx.db
    .select()
    .from(syncSourceClaim)
    .where(and(eq(syncSourceClaim.householdId, ctx.household.id), eq(syncSourceClaim.runId, runId)))
  for (const claim of claims) {
    const [previous] = await ctx.db
      .select({ id: syncRun.id })
      .from(syncRun)
      .where(
        and(
          eq(syncRun.householdId, ctx.household.id),
          eq(syncRun.targetKey, claim.targetKey),
          ne(syncRun.id, runId),
          sql`${claim.sourceKey} = any(${syncRun.sourceKeys})`,
          inArray(syncRun.status, ['pending', 'uncertain', 'succeeded', 'copied', 'shared']),
        ),
      )
      .orderBy(desc(syncRun.createdAt), desc(syncRun.id))
      .limit(1)
    const mine = and(eq(syncSourceClaim.id, claim.id), eq(syncSourceClaim.householdId, ctx.household.id))
    if (previous) await ctx.db.update(syncSourceClaim).set({ runId: previous.id }).where(mine)
    else await ctx.db.delete(syncSourceClaim).where(mine)
  }
}

async function applyProviderResult(ctx: Ctx, runId: string, result: ShoppingProviderResult, checked = false) {
  const externalUrl =
    result.externalUrl && /^https:\/\//i.test(result.externalUrl)
      ? result.externalUrl.slice(0, 2000)
      : undefined
  await ctx.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`shopping:${ctx.household.id}`}, 0))`,
    )
    const [changed] = await tx
      .update(syncRun)
      .set({
        status: result.status,
        externalId: result.externalId,
        externalUrl,
        message: result.message?.slice(0, 1000) ?? null,
        updatedAt: new Date(),
        ...(checked ? { checkedAt: new Date() } : {}),
      })
      .where(
        and(
          scopedRun(ctx, runId),
          inArray(syncRun.status, result.status === 'pending' ? ['pending'] : ['pending', 'uncertain']),
        ),
      )
      .returning({ id: syncRun.id })
    if (changed && result.status === 'failed') await releaseSourceClaims({ ...ctx, db: tx }, runId)
  })
}
export async function startShoppingExport(
  ctx: Ctx,
  input: z.input<typeof shoppingExportInput>,
  deps: ShoppingDeps,
) {
  const data = parseInput(shoppingExportInput, input)
  const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const reservation = await ctx.db.transaction(async (tx) => {
    const txCtx: Ctx = { ...ctx, db: tx }
    // Serializes reservations and overlapping source claims for this household, without holding a lock during IO.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`shopping:${ctx.household.id}`}, 0))`,
    )
    const [existing] = await tx
      .select()
      .from(syncRun)
      .where(and(eq(syncRun.householdId, ctx.household.id), eq(syncRun.requestId, data.requestId)))
    if (existing) {
      if (existing.requestHash !== requestHash || existing.actorId !== ctx.user.id)
        throw new Conflict('Dit exportverzoek is al met andere inhoud gebruikt. Open een nieuw voorstel.')
      return { id: existing.id, fresh: false, connection: undefined }
    }
    if (!deps.targets[data.target])
      throw new Invalid('Dit boodschappendoel is nog niet beschikbaar of ingesteld.')
    const connection = data.target === 'share' ? undefined : await connectionFor(txCtx, data.target)
    if (data.target !== 'share' && !connection)
      throw new Invalid(
        'Deze verbinding is niet ingesteld. Laat de eigenaar deze bij Boodschappen › Verbindingen instellen.',
      )
    const needs = await calculateShoppingNeeds(txCtx, data.source)
    if (needs.fingerprint !== data.fingerprint)
      throw new Conflict(
        'De behoefte is gewijzigd. Open een actueel boodschappenvoorstel voordat je exporteert.',
      )
    if (!needs.lines.length) throw new Invalid('Er zijn geen boodschappen om te exporteren.')
    const targetKey = targetKeyFor(data.target, connection?.destinationId)
    const overlaps = await tx
      .select({ runId: syncRun.id, status: syncRun.status, checkedAt: syncRun.checkedAt })
      .from(syncSourceClaim)
      .innerJoin(
        syncRun,
        and(eq(syncRun.id, syncSourceClaim.runId), eq(syncRun.householdId, ctx.household.id)),
      )
      .where(
        and(
          eq(syncSourceClaim.householdId, ctx.household.id),
          eq(syncSourceClaim.targetKey, targetKey),
          inArray(syncSourceClaim.sourceKey, needs.sourceKeys),
        ),
      )
    if (overlaps.some((run) => run.status === 'pending' || (run.status === 'uncertain' && !run.checkedAt)))
      throw new Conflict(
        'Een eerdere export is nog bezig of onzeker. Open de exporthistorie en controleer eerst de status.',
      )
    if (overlaps.length && !data.allowRepeat)
      throw new Conflict(
        'Een of meer bronnen zijn al naar dit doel geëxporteerd. Controleer de eerdere export en kies alleen bewust voor opnieuw exporteren.',
      )
    const [run] = await tx
      .insert(syncRun)
      .values({
        householdId: ctx.household.id,
        requestId: data.requestId,
        requestHash,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        target: data.target,
        targetKey,
        connectionId: connection?.id ?? null,
        source: needs.source,
        sourceKeys: needs.sourceKeys,
        fingerprint: needs.fingerprint,
        snapshot: needs,
      })
      .returning({ id: syncRun.id })
    for (const sourceKey of needs.sourceKeys)
      await tx
        .insert(syncSourceClaim)
        .values({ householdId: ctx.household.id, targetKey, sourceKey, runId: run!.id })
        .onConflictDoUpdate({
          target: [syncSourceClaim.householdId, syncSourceClaim.targetKey, syncSourceClaim.sourceKey],
          set: { runId: run!.id },
        })
    return { id: run!.id, fresh: true, connection }
  })
  if (reservation.fresh) {
    const run = await findRun(ctx, reservation.id)
    let result: ShoppingProviderResult
    try {
      result = await deps.targets[data.target]!.send({
        runId: run.id,
        needs: run.snapshot,
        connection: reservation.connection
          ? {
              destinationId: reservation.connection.destinationId,
              secret: openShoppingSecret(
                reservation.connection.encryptedSecret,
                deps.secret,
                ctx.household.id,
              ),
            }
          : null,
      })
    } catch {
      result = {
        status: 'uncertain',
        message:
          'Het verzendresultaat is onzeker. Controleer de status; er wordt niet automatisch opnieuw verzonden.',
      }
    }
    await applyProviderResult(ctx, run.id, result)
  }
  return getSyncRun(ctx, reservation.id)
}

export async function confirmShoppingShare(ctx: Ctx, input: z.input<typeof shareOutcomeInput>) {
  const data = parseInput(shareOutcomeInput, input)
  await ctx.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`shopping:${ctx.household.id}`}, 0))`,
    )
    const [run] = await tx.select().from(syncRun).where(scopedRun(ctx, data.runId)).for('update')
    if (!run) throw new NotFound('Boodschappenexport niet gevonden.')
    if (run.actorId !== ctx.user.id)
      throw new Forbidden('Alleen de persoon die het deelverzoek startte kan dit resultaat bevestigen.')
    if (run.target !== 'share') throw new Invalid('Deze export gebruikt geen deelmenu of klembord.')
    if (run.status === data.outcome) return
    if (run.status !== 'pending') throw new Conflict('Deze export heeft al een ander resultaat.')
    await tx
      .update(syncRun)
      .set({ status: data.outcome, updatedAt: new Date() })
      .where(scopedRun(ctx, run.id))
    if (data.outcome === 'cancelled') await releaseSourceClaims({ ...ctx, db: tx }, run.id)
  })
  return getSyncRun(ctx, data.runId)
}

export async function checkShoppingSync(ctx: Ctx, runId: string, deps: ShoppingDeps) {
  const run = await findRun(ctx, runId)
  if (run.target === 'share')
    throw new Invalid('Een deel- of kopieeractie heeft geen externe statuscontrole.')
  if (!['pending', 'uncertain'].includes(run.status)) return getSyncRun(ctx, run.id)
  if (run.target === 'notion' && run.status === 'pending' && Date.now() - run.createdAt.getTime() < 60_000)
    return getSyncRun(ctx, run.id)
  const connection = await connectionFor(ctx, run.target)
  if (!connection || targetKeyFor(run.target, connection.destinationId) !== run.targetKey)
    throw new Invalid(
      'De oorspronkelijke verbinding is niet meer ingesteld. Herstel die verbinding om deze export te controleren.',
    )
  const provider = deps.targets[run.target]
  if (!provider?.check) throw new Invalid('Dit doel ondersteunt geen statuscontrole.')
  let result: ShoppingProviderResult
  try {
    result = await provider.check({
      runId: run.id,
      needs: run.snapshot,
      externalId: run.externalId,
      connection: {
        destinationId: connection.destinationId,
        secret: openShoppingSecret(connection.encryptedSecret, deps.secret, ctx.household.id),
      },
    })
  } catch {
    result = {
      status: 'uncertain',
      message: 'De status kon niet betrouwbaar worden gecontroleerd. Er is niets opnieuw verzonden.',
    }
  }
  // Only a completed read can make a still-unknown export eligible for a deliberate repeat.
  await applyProviderResult(
    ctx,
    run.id,
    result,
    result.verifiedAbsent === true || result.status === 'succeeded',
  )
  return getSyncRun(ctx, run.id)
}
