import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { switchHouseholdFn } from '~/server/households.functions'
import type { Shell } from '~/server/session.functions'
import { BoxIcon, CalendarIcon, DotsIcon, PotIcon } from './icons'

const sections = [
  { to: '/week', label: 'Week', icon: CalendarIcon },
  { to: '/gerechten', label: 'Gerechten', icon: PotIcon },
  { to: '/voorraad', label: 'Voorraad', icon: BoxIcon },
  { to: '/meer', label: 'Meer', icon: DotsIcon },
] as const

export function AppShell({ shell, children }: { shell: Shell; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar shell={shell} />
      <main className="mx-auto w-full max-w-[1180px] pb-28 lg:px-14 lg:py-10 lg:pb-10">{children}</main>
      <TabBar />
    </div>
  )
}

function TabBar() {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface px-2 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      {sections.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ includeSearch: false }}
          className="flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-ink-3"
          activeProps={{ className: 'text-tomato! font-bold', 'aria-current': 'page' }}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Sidebar({ shell }: { shell: Shell }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-7 lg:flex">
      <div className="px-3 font-display text-2xl font-bold tracking-tight text-tomato">Gerechter</div>
      <nav aria-label="Hoofdnavigatie" className="flex flex-col gap-1">
        {sections.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ includeSearch: false }}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink-2 hover:bg-ground"
            activeProps={{ className: 'bg-tomato-soft text-tomato-dark! font-bold', 'aria-current': 'page' }}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
      {shell.household && (
        <div className="mt-auto flex flex-col gap-2 rounded-xl bg-ground p-3 text-[13px] text-ink-2">
          <div className="font-bold text-ink">{shell.household.name}</div>
          <HouseholdSwitcher shell={shell} />
        </div>
      )}
    </aside>
  )
}

/** Alleen zichtbaar bij meer dan één huishouden. */
export function HouseholdSwitcher({ shell }: { shell: Shell }) {
  const router = useRouter()
  if (!shell.household || shell.households.length < 2) return null
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] text-ink-3">Huishouden</span>
      <select
        className="min-h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink"
        value={shell.household.id}
        onChange={async (event) => {
          await switchHouseholdFn({ data: { householdId: event.target.value } })
          await router.invalidate()
        }}
      >
        {shell.households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  )
}
