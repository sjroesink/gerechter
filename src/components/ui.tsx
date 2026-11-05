import { Link, type LinkProps } from '@tanstack/react-router'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-tomato text-white hover:bg-tomato-dark disabled:opacity-60',
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
}: {
  title: string
  subtitle?: string
  back: LinkProps['to']
  backLabel: string
}) {
  return (
    <header className="flex items-center gap-1 px-2 pt-4 pb-2 lg:px-0 lg:pt-0">
      <Link
        to={back}
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
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[15px] font-semibold">{label}</span>
      <input
        className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
        {...props}
      />
      {hint && <span className="text-[13px] text-ink-3">{hint}</span>}
    </label>
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
      <div className="font-display text-2xl font-bold tracking-tight text-tomato">Gerechter</div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
        {intro && <div className="text-[15px] text-ink-2">{intro}</div>}
      </div>
      {children}
    </main>
  )
}
