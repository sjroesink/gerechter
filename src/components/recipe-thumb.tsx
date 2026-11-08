import { useState } from 'react'
import { cx } from './ui'

/** Square recipe photo with the first letter as fallback when there is no (working) image. */
export function RecipeThumb({
  name,
  photoUrl,
  className = 'size-14 rounded-xl text-[22px]',
}: {
  name: string
  photoUrl: string | null
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (photoUrl && failed !== photoUrl)
    return (
      <img
        ref={(image) => {
          // An SSR image can fail before hydration attaches React's onError handler.
          if (image?.complete && image.naturalWidth === 0) setFailed(photoUrl)
        }}
        src={photoUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cx('shrink-0 bg-muted object-cover', className)}
        onError={() => setFailed(photoUrl)}
      />
    )
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center bg-muted font-display font-bold text-ink-2',
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Wide recipe photo for cards and detail pages; renders nothing without a (working) image. */
export function RecipeBanner({ photoUrl, className }: { photoUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!photoUrl || failed === photoUrl) return null
  return (
    <img
      src={photoUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cx('w-full bg-muted object-cover', className)}
      onError={() => setFailed(photoUrl)}
    />
  )
}
