import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { calendarDateInput, todayAmsterdam } from '~/domain/calendar'
import { getHouseholdPreferences } from '~/domain/preferences'
import {
  checkShoppingSync,
  confirmShoppingShare,
  getShoppingPreview,
  getShoppingTargets,
  getSyncRun,
  listSyncRuns,
  notionConnectionInput,
  removeShoppingConnection,
  saveNotionConnection,
  shareOutcomeInput,
  shoppingExportInput,
  startShoppingExport,
} from '~/domain/shopping-sync'
import { sessionCtx, toResult } from './fn'
import { shoppingDeps } from './shopping-targets'
import { getAhSetup } from './shopping-targets/ah-setup'

const idInput = z.object({ runId: z.string().min(1).max(100) })
const shoppingPageInput = z.object({
  kind: z.enum(['recipe', 'day', 'week']).optional(),
  recipeId: z.string().min(1).max(100).optional(),
  date: calendarDateInput.optional(),
  servings: z.number().int().min(1).max(1000).optional(),
})
export const getShoppingPage = createServerFn({ method: 'GET' })
  .validator(shoppingPageInput)
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      const kind = data.kind ?? 'week',
        date = data.date ?? todayAmsterdam()
      const source =
        kind === 'recipe'
          ? data.recipeId
            ? { kind, recipeId: data.recipeId, servings: data.servings }
            : null
          : { kind, date }
      return {
        preview: source ? await getShoppingPreview(ctx, source) : null,
        ...(await getShoppingTargets(ctx)),
        defaultDate: date,
        defaultServings: (await getHouseholdPreferences(ctx)).defaultServings,
      }
    }),
  )
export const startShoppingExportFn = createServerFn({ method: 'POST' })
  .validator(shoppingExportInput)
  .handler(({ data }) => toResult(async () => startShoppingExport(await sessionCtx(), data, shoppingDeps())))
export const confirmShoppingShareFn = createServerFn({ method: 'POST' })
  .validator(shareOutcomeInput)
  .handler(({ data }) => toResult(async () => confirmShoppingShare(await sessionCtx(), data)))
export const getShoppingTargetsPage = createServerFn({ method: 'GET' }).handler(() =>
  toResult(async () => ({ ...(await getShoppingTargets(await sessionCtx())), ah: await getAhSetup() })),
)
export const saveNotionConnectionFn = createServerFn({ method: 'POST' })
  .validator(notionConnectionInput)
  .handler(({ data }) =>
    toResult(async () => saveNotionConnection(await sessionCtx(), data, shoppingDeps().secret)),
  )
export const removeShoppingConnectionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ target: z.literal('notion') }))
  .handler(({ data }) => toResult(async () => removeShoppingConnection(await sessionCtx(), data.target)))
export const getShoppingRunsPage = createServerFn({ method: 'GET' }).handler(() =>
  toResult(async () => listSyncRuns(await sessionCtx())),
)
export const getShoppingRunPage = createServerFn({ method: 'GET' })
  .validator(idInput)
  .handler(({ data }) => toResult(async () => getSyncRun(await sessionCtx(), data.runId)))
export const checkShoppingSyncFn = createServerFn({ method: 'POST' })
  .validator(idInput)
  .handler(({ data }) =>
    toResult(async () => checkShoppingSync(await sessionCtx(), data.runId, shoppingDeps())),
  )
