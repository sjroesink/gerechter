import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { IngredientPhoto } from '~/domain/ingredient-photo'
import { ChevronLeftIcon } from './icons'
import { IngredientThumbnail } from './ingredient-photo'
import { cx } from './ui'

/** Ronde ingrediëntfoto voor lijstrijen (36 px) en de kop van een ingrediënt (80 px). */
export function IngredientAvatar({
  photo,
  name,
  size = 'sm',
}: {
  photo?: IngredientPhoto | null
  name: string
  size?: 'sm' | 'lg'
}) {
  return (
    <span
      className={cx(
        'flex shrink-0 overflow-hidden rounded-full bg-muted *:size-full *:rounded-none',
        size === 'lg' ? 'size-20' : 'size-9 lg:size-10',
      )}
    >
      <IngredientThumbnail photo={photo} name={name} small={size === 'sm'} />
    </span>
  )
}

/** Kop van een ingrediëntscherm: terugknop, ronde foto, grote naam en een ondertitel. */
export function IngredientHeader({
  name,
  subtitle,
  photo,
  back,
  backLabel,
  children,
}: {
  name: string
  subtitle?: ReactNode
  photo?: IngredientPhoto | null
  back: LinkProps['to']
  backLabel: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-1 px-2 pt-4 pb-2 lg:px-0 lg:pt-0">
      <Link
        to={back}
        aria-label={backLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-muted"
      >
        <ChevronLeftIcon size={24} />
      </Link>
      <div className="flex items-center gap-4 px-3 lg:px-0">
        <IngredientAvatar photo={photo} name={name} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-[30px] leading-tight font-bold tracking-tight break-words lg:text-[34px]">
            {name}
          </h1>
          {subtitle && <p className="text-sm text-ink-3">{subtitle}</p>}
          {children}
        </div>
      </div>
    </header>
  )
}
