import { useState } from 'react'
import type { IngredientPhoto as Photo } from '~/domain/ingredient-photo'
import { BoxIcon } from './icons'
import { buttonClass, cx } from './ui'

export function IngredientThumbnail({
  photo,
  name,
  large = false,
  small = false,
}: {
  photo?: Photo | null
  name: string
  large?: boolean
  /** Ronde mini-thumbnail voor regels in een ingrediëntenlijst. */
  small?: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const available = photo?.url && failedUrl !== photo.url
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center overflow-hidden',
        large
          ? 'aspect-square w-full max-w-64 self-center rounded-xl'
          : small
            ? 'size-9 rounded-full'
            : 'size-14 rounded-xl',
        available ? 'bg-white' : 'bg-muted text-ink-3',
      )}
    >
      {available ? (
        <img
          src={photo.url}
          alt={large ? name : ''}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cx('size-full object-contain', small ? 'p-0.5' : 'p-1')}
          onError={() => setFailedUrl(photo.url)}
        />
      ) : (
        <span className="flex flex-col items-center gap-2" aria-hidden={!large}>
          <BoxIcon size={large ? 48 : small ? 18 : 24} />
          {large && <span className="text-sm">Geen afbeelding beschikbaar</span>}
        </span>
      )}
    </span>
  )
}

export function IngredientPhoto({ photo, name }: { photo: Photo | null; name: string }) {
  if (!photo) return null
  return (
    <figure className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
      <IngredientThumbnail photo={photo} name={name} large />
      {(photo.credit || photo.sourceUrl || photo.licenseUrl) && (
        <figcaption className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-ink-2">
          {photo.sourceUrl ? (
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('ghost', 'min-w-0 max-w-full whitespace-normal')}
            >
              <span className="min-w-0 break-words">Foto: {photo.credit ?? 'bekijk bron'}</span>
            </a>
          ) : photo.credit ? (
            <span>Foto: {photo.credit}</span>
          ) : null}
          {photo.licenseUrl && (
            <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
              Gebruiksvoorwaarden
            </a>
          )}
        </figcaption>
      )}
    </figure>
  )
}
