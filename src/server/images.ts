import type { Auth } from '~/auth/auth'
import type { Db } from '~/db/client'
import { getImageForUser } from '~/domain/images'

const notFound = () =>
  new Response('Niet gevonden.', { status: 404, headers: { 'cache-control': 'no-store' } })

/** Levert een eigen afbeeldingskopie, alleen aan aangemelde leden van het huishouden ervan. */
export async function imageResponse(request: Request, imageId: string, deps: { db: Db; auth: Auth }) {
  const session = await deps.auth.api.getSession({ headers: request.headers })
  if (!session || imageId.length > 100) return notFound()
  const row = await getImageForUser(deps.db, session.user.id, imageId)
  if (!row) return notFound()
  const etag = `"${row.sha256}"`
  const headers = {
    'content-type': row.contentType,
    'cache-control': 'private, max-age=31536000, immutable',
    etag,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'cross-origin-resource-policy': 'same-origin',
  }
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
  return new Response(new Uint8Array(row.bytes), { status: 200, headers })
}
