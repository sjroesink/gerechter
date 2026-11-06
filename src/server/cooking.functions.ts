import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  cookingSearchInput,
  getMadeEvent,
  myRatingInput,
  prepareCooking,
  prepareCookingInput,
  recordMade,
  recordMadeInput,
  searchCookingHistory,
  setMyMadeRating,
} from '~/domain/cooking'
import { sessionCtx, toResult } from './fn'

export const getCookingPreparation = createServerFn({ method: 'GET' })
  .validator(prepareCookingInput)
  .handler(({ data }) => toResult(async () => prepareCooking(await sessionCtx(), data)))
export const recordMadeFn = createServerFn({ method: 'POST' })
  .validator(recordMadeInput)
  .handler(({ data }) => toResult(async () => recordMade(await sessionCtx(), data)))
export const getCookingHistoryPage = createServerFn({ method: 'GET' })
  .validator(cookingSearchInput)
  .handler(({ data }) => toResult(async () => searchCookingHistory(await sessionCtx(), data)))
export const getMadeEventPage = createServerFn({ method: 'GET' })
  .validator(z.object({ eventId: z.string().min(1).max(100) }))
  .handler(({ data }) => toResult(async () => getMadeEvent(await sessionCtx(), data.eventId)))
export const setMyMadeRatingFn = createServerFn({ method: 'POST' })
  .validator(myRatingInput)
  .handler(({ data }) => toResult(async () => setMyMadeRating(await sessionCtx(), data)))
