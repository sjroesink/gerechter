import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  acceptInvite,
  bootstrapAdmin,
  createPasswordResetLink,
  isSetupAvailable,
  listUsers,
  registerWithInvite,
  resetPassword,
} from '~/domain/accounts'
import { createHouseholdInvite, inspectInvite, inviteProblemMessages, inviteUrl } from '~/domain/invites'
import { appDeps, sessionUserCtx, toResult } from './fn'

const credentials = z.object({
  name: z.string().max(100),
  email: z.string().email('Vul een geldig e-mailadres in.'),
  password: z.string().max(200),
})

export const getSetupStatus = createServerFn({ method: 'GET' }).handler(async () => ({
  available: await isSetupAvailable(appDeps().db),
}))

export const runSetup = createServerFn({ method: 'POST' })
  .validator(credentials)
  .handler(({ data }) => toResult(async () => void (await bootstrapAdmin(appDeps(), data))))

export const getInvite = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().max(200) }))
  .handler(async ({ data }) => {
    const info = await inspectInvite(appDeps().db, data.token)
    if (!info.ok) return { ok: false as const, message: inviteProblemMessages[info.problem] }
    return { ok: true as const, kind: info.kind, householdName: info.householdName }
  })

export const registerViaInvite = createServerFn({ method: 'POST' })
  .validator(credentials.extend({ token: z.string().max(200) }))
  .handler(({ data }) =>
    toResult(async () => {
      const { token, ...rest } = data
      await registerWithInvite(appDeps(), token, rest)
    }),
  )

export const acceptInviteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(200) }))
  .handler(({ data }) => toResult(async () => void (await acceptInvite(await sessionUserCtx(), data.token))))

export const resetPasswordFn = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(500), password: z.string().max(200) }))
  .handler(({ data }) => toResult(() => resetPassword(appDeps(), data.token, data.password)))

export const adminOverview = createServerFn({ method: 'GET' }).handler(() =>
  toResult(async () => ({ users: await listUsers(await sessionUserCtx()) })),
)

export const adminCreateResetLink = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: z.string().max(100) }))
  .handler(({ data }) =>
    toResult(async () => createPasswordResetLink(appDeps(), await sessionUserCtx(), data.userId)),
  )

export const adminCreateHouseholdInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ householdName: z.string().max(100) }))
  .handler(({ data }) =>
    toResult(async () => {
      const created = await createHouseholdInvite(await sessionUserCtx(), data.householdName)
      return { url: inviteUrl(appDeps().env.PUBLIC_BASE_URL, created.token), expiresAt: created.expiresAt }
    }),
  )
