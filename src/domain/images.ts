import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { DbOrTx } from '~/db/client'
import { image, membership } from '~/db/schema'
import { Invalid } from './core'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif'

/** Gedownloade bytes; het type volgt uit de inhoud, niet uit de header van de bron. */
export type FetchedImage = { bytes: Uint8Array; finalUrl: string }
export type FetchImage = (url: string, options?: { referer?: string }) => Promise<FetchedImage>

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end))

/** Herkent toegestane afbeeldingstypen aan de eerste bytes. SVG en andere actieve formaten vallen af. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) return 'image/gif'
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return 'image/webp'
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 12)))
    return 'image/avif'
  return null
}

/** Haalt een afbeelding op en controleert het type; geeft een Invalid met uitleg bij een fout. */
export async function downloadImage(fetchImage: FetchImage, url: string, referer?: string) {
  const fetched = await fetchImage(url, referer ? { referer } : undefined)
  const contentType = sniffImageType(fetched.bytes)
  if (!contentType)
    throw new Invalid('De foto-URL verwijst niet naar een JPEG-, PNG-, WebP-, GIF- of AVIF-afbeelding.')
  return { bytes: fetched.bytes, contentType, sourceUrl: url }
}

export type DownloadedImage = Awaited<ReturnType<typeof downloadImage>>

export async function insertImage(db: DbOrTx, householdId: string, data: DownloadedImage) {
  const bytes = Buffer.from(data.bytes)
  const [row] = await db
    .insert(image)
    .values({
      householdId,
      contentType: data.contentType,
      bytes,
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sourceUrl: data.sourceUrl,
    })
    .returning({ id: image.id })
  return row!.id
}

export async function deleteImage(db: DbOrTx, householdId: string, id: string) {
  await db.delete(image).where(and(eq(image.id, id), eq(image.householdId, householdId)))
}

export const imagePath = (id: string) => `/afbeeldingen/${encodeURIComponent(id)}`

/** Alleen leden van het huishouden van de afbeelding; anders null (geen onderscheid met niet-bestaand). */
export async function getImageForUser(db: DbOrTx, userId: string, id: string) {
  const [row] = await db
    .select({ contentType: image.contentType, bytes: image.bytes, sha256: image.sha256 })
    .from(image)
    .innerJoin(membership, and(eq(membership.householdId, image.householdId), eq(membership.userId, userId)))
    .where(eq(image.id, id))
  return row ?? null
}
