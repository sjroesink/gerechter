import { sql } from 'drizzle-orm'
import type { Db } from '~/db/client'

/** 200 als de app draait en de database bereikbaar is, anders 503. */
export async function healthResponse(db: Db): Promise<Response> {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ status: 'unavailable', database: 'onbereikbaar' }, { status: 503 })
  }
}
