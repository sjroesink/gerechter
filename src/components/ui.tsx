import { Link, type LinkProps } from '@tanstack/react-router'
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from './icons'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-tomato text-surface hover:bg-tomato-dark disabled:opacity-60',
  secondary: 'bg-surface text-ink border border-line hover:bg-ground',
  danger: 'bg-surface text-tomato-dark border border-line hover:bg-tomato-soft',
  ghost: 'bg-transparent text-tomato hover:text-tomato-dark',
}

export function buttonClass(variant: Variant = 'primary', extra?: string) {
  return cx(
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato',
    variants[variant],
    extra,
  )
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}

/** Kop van een hoofdsectie: grote titel, optioneel een actie rechts. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pt-7 pb-3 lg:px-0 lg:pt-0">
      <h1 className="font-display text-[32px] font-bold tracking-tight lg:text-[34px]">{title}</h1>
      {action}
    </header>
  )
}

/** Kop van een detailpagina: terugknop naar de ouderpagina en een titel. */
export function DetailHeader({
  title,
  subtitle,
  back,
  backLabel,
  backParams,
  backSearch,
}: {
  title: string
  subtitle?: string
  back: LinkProps['to']
  backLabel: string
  backParams?: LinkProps['params']
  backSearch?: LinkProps['search']
}) {
  return (
    <header className="flex items-center gap-1 px-2 pt-4 pb-2 lg:px-0 lg:pt-0">
      <Link
        to={back}
        params={backParams}
        search={backSearch}
        aria-label={backLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-muted"
      >
        <ChevronLeftIcon size={24} />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-3">{subtitle}</p>}
      </div>
    </header>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-col gap-5 px-4 pb-8 lg:px-0', className)}>{children}</div>
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-ink-2">{icon}</div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="max-w-sm text-[15px] text-ink-2">{children}</p>
    </div>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success'
  children: ReactNode
}) {
  const tones = {
    info: 'bg-muted text-ink-2',
    error: 'bg-tomato-soft text-tomato-dark',
    success: 'bg-herb-soft text-herb-dark',
  }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-2xl px-4 py-3 text-[15px]', tones[tone])}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  trailing,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; trailing?: ReactNode }) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  const hintId = `${id}-hint`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          className={cx(
            'min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft',
            trailing != null && 'pr-12',
          )}
          {...props}
          id={id}
          aria-describedby={
            [props['aria-describedby'], hint ? hintId : undefined].filter(Boolean).join(' ') || undefined
          }
        />
        {trailing != null && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <span id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </span>
      )}
    </div>
  )
}

export function ListGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-col overflow-hidden rounded-2xl bg-surface">
      {children}
    </nav>
  )
}

export function ListLink({
  to,
  icon,
  title,
  detail,
}: {
  to: LinkProps['to']
  icon?: ReactNode
  title: string
  detail?: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-15 items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0 hover:bg-ground"
    >
      {icon && <span className="text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        {detail && <span className="block truncate text-[13px] text-ink-3">{detail}</span>}
      </span>
      <ChevronRightIcon size={20} className="text-ink-3" />
    </Link>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-[13px] font-bold tracking-wide text-ink-3 uppercase">{children}</h2>
}

/** Centrale kaart voor pagina's buiten de app-schil (inloggen, setup, uitnodiging). */
export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <img src="/pwa/icon-192.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
        <div className="font-display text-2xl font-bold tracking-tight text-tomato">Gerechter</div>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
        {intro && <div className="text-[15px] text-ink-2">{intro}</div>}
      </div>
      {children}
    </main>
  )
}

/** Zoekveld als pil met vergrootglas; het label is alleen voor schermlezers. */
export function SearchField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cx(
        'flex min-h-12 items-center gap-2.5 rounded-full border border-line bg-surface px-4 focus-within:border-tomato focus-within:ring-2 focus-within:ring-tomato-soft',
        className,
      )}
    >
      <SearchIcon size={20} className="shrink-0 text-ink-3" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        {...props}
      />
    </label>
  )
}

type IconButtonVariant = 'primary' | 'secondary' | 'plain'

const iconButtonVariants: Record<IconButtonVariant, string> = {
  primary: 'bg-tomato text-surface hover:bg-tomato-dark',
  secondary: 'border border-line bg-surface text-ink hover:bg-ground',
  plain: 'text-ink-2 hover:bg-muted',
}

/** Ronde knop van 44 px met alleen een icoon; geef altijd een aria-label mee. */
export function iconButtonClass(variant: IconButtonVariant = 'primary', extra?: string) {
  return cx(
    'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato disabled:opacity-50',
    iconButtonVariants[variant],
    extra,
  )
}

/** Groen label voor tags van een gerecht. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-herb-soft px-2.5 py-1 text-[13px] font-semibold text-herb-dark">
      {children}
    </span>
  )
}

/** Kleine statuslabel, bijvoorbeeld "tekort", "basis" of "in huis". */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'herb' | 'tomato' | 'amber'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-line-soft text-ink-2',
    herb: 'bg-herb-soft text-herb-dark',
    tomato: 'bg-tomato-soft text-tomato-dark',
    amber: 'bg-amber-soft text-amber-ink',
  }
  return (
    <span className={cx('shrink-0 rounded-full px-2 py-1 text-xs font-bold whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  )
}

/** Teller met min- en plusknop, zoals voor het aantal personen. */
export function Stepper({
  value,
  onChange,
  label,
  min = 1,
  max = 1000,
  step = 1,
  disabled,
  format = String,
  size = 'md',
}: {
  value: number
  onChange: (value: number) => void
  /** Zelfstandig naamwoord voor de knoplabels: "Minder <label>" en "Meer <label>". */
  label: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  format?: (value: number) => string
  size?: 'md' | 'lg'
}) {
  const button = cx(
    'inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-ground disabled:opacity-40',
    size === 'lg' ? 'size-13 text-2xl' : 'size-11 text-xl',
  )
  return (
    <div className={cx('flex items-center', size === 'lg' ? 'gap-5' : 'gap-1')}>
      <button
        type="button"
        aria-label={`Minder ${label}`}
        className={button}
        disabled={disabled || value - step < min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <output
        aria-live="polite"
        className={cx(
          'text-center font-bold tabular-nums',
          size === 'lg' ? 'min-w-24 font-display text-5xl leading-none' : 'min-w-8 text-lg',
        )}
      >
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={`Meer ${label}`}
        className={button}
        disabled={disabled || value + step > max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  )
}

/** Container voor segmentknoppen (gebruik `segmentClass` op de knoppen of links erin). */
export function SegmentGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-muted p-1"
    >
      {children}
    </div>
  )
}

export function segmentClass(active: boolean) {
  return cx(
    'flex min-h-11 items-center justify-center rounded-[10px] px-2 text-sm font-semibold transition-colors',
    active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(24,32,27,0.12)]' : 'text-ink-2 hover:text-ink',
  )
}

/** Filterchip; de actieve chip is donker gevuld. */
export function chipClass(active: boolean) {
  return cx(
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
    active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink hover:bg-ground',
  )
}

/** Witte kaart als rij in een lijst (dag in de week, gerecht in de lijst). */
export const rowCardClass =
  'flex min-h-16 items-center gap-3.5 rounded-2xl bg-surface px-3.5 py-2 text-ink transition-colors hover:bg-muted'

/** Rij binnen een gegroepeerde witte lijst met scheidingslijnen. */
export const groupRowClass =
  'flex min-h-14 items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0 hover:bg-ground'

/**
 * Actiebalk onderaan een detailscherm. Blijft op mobiel boven de tabbalk staan;
 * op desktop staat hij gewoon onder de inhoud.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(69px+max(0px,env(safe-area-inset-bottom)-12px))] z-[5] -mx-4 mt-auto flex flex-col gap-2.5 border-t border-line bg-ground px-5 pt-3 pb-5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0">
      {children}
    </div>
  )
}
