import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  changeMemberRole,
  getMembers,
  leaveHousehold,
  removeMember,
  switchHousehold,
} from '~/domain/households'
import { createMemberInvite, inviteUrl, listOpenInvites, revokeInvite } from '~/domain/invites'
import { appDeps, sessionCtx, sessionUserCtx, toResult } from './fn'

const id = z.string().max(100)

export const getHouseholdPage = createServerFn({ method: 'GET' }).handler(() =>
  toResult(async () => {
    const ctx = await sessionCtx()
    return {
      household: ctx.household,
      members: await getMembers(ctx),
      invites: ctx.household.role === 'owner' ? await listOpenInvites(ctx) : [],
    }
  }),
)

export const createInviteFn = createServerFn({ method: 'POST' }).handler(() =>
  toResult(async () => {
    const created = await createMemberInvite(await sessionCtx())
    return { url: inviteUrl(appDeps().env.PUBLIC_BASE_URL, created.token), expiresAt: created.expiresAt }
  }),
)

export const revokeInviteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ inviteId: id }))
  .handler(({ data }) => toResult(async () => revokeInvite(await sessionCtx(), data.inviteId)))

export const changeRoleFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: id, role: z.enum(['owner', 'member']) }))
  .handler(({ data }) => toResult(async () => changeMemberRole(await sessionCtx(), data.userId, data.role)))

export const removeMemberFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: id }))
  .handler(({ data }) => toResult(async () => removeMember(await sessionCtx(), data.userId)))

export const leaveHouseholdFn = createServerFn({ method: 'POST' }).handler(() =>
  toResult(async () => leaveHousehold(await sessionCtx())),
)

export const switchHouseholdFn = createServerFn({ method: 'POST' })
  .validator(z.object({ householdId: id }))
  .handler(({ data }) => toResult(async () => switchHousehold(await sessionUserCtx(), data.householdId)))
