import { expect, test } from 'vitest'
import { createDb } from '~/db/client'
import { setupTestDb } from '../../tests/db'
import { healthResponse } from './health'

const db = setupTestDb()

test('200 als de database bereikbaar is', async () => {
  const res = await healthResponse(db)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok' })
})

test('503 als de database onbereikbaar is', async () => {
  const unreachable = createDb('postgres://niemand:niets@127.0.0.1:1/bestaat_niet')
  const res = await healthResponse(unreachable)
  expect(res.status).toBe(503)
  await unreachable.$pool.end()
})
