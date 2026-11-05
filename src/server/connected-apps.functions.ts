import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listConnectedApps, revokeConnectedApp } from '~/domain/connected-apps'
import { sessionUserCtx, toResult } from './fn'

export const getConnectedApps = createServerFn({ method: 'GET' }).handler(() =>
  toResult(async () => listConnectedApps(await sessionUserCtx())),
)

export const revokeConnectedAppFn = createServerFn({ method: 'POST' })
  .validator(z.object({ consentId: z.string().max(100) }))
  .handler(({ data }) => toResult(async () => revokeConnectedApp(await sessionUserCtx(), data.consentId)))
