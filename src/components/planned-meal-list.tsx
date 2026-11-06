import { Link } from '@tanstack/react-router'
import type { PlanSummary } from '~/domain/planning'
import { ChevronRightIcon } from './icons'
import { Badge, cx } from './ui'

/** Geplande maaltijden van een dag als witte kaarten die naar de maaltijd leiden. */
export function PlannedMealList({ items }: { items: PlanSummary[] }) {
  return (
    <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {items.map((item) => (
        <li key={item.id} className="flex">
          <Link
            to="/week/maaltijd/$mealId"
            params={{ mealId: item.id }}
            className="flex w-full flex-col gap-3 rounded-[20px] bg-surface p-5 text-ink transition-colors hover:bg-ground"
          >
            <span
              className={cx(
                'font-display text-[26px] leading-[1.1] tracking-tight break-words',
                item.kind === 'free' ? 'font-semibold text-ink-2 italic' : 'font-bold',
              )}
            >
              {item.title}
            </span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
              {item.kind === 'recipe' ? (
                <span>
                  <strong className="text-ink">{item.effectiveServings}</strong> personen
                  {item.servings === null ? ' · huishoudstandaard' : ''}
                </span>
              ) : (
                <span>Geen gerecht</span>
              )}
              {item.recipeArchivedAt && <Badge tone="amber">Gerecht gearchiveerd</Badge>}
            </span>
            {item.note && (
              <span className="text-[15px] break-words whitespace-pre-wrap text-ink-2">{item.note}</span>
            )}
            <span className="mt-auto flex min-h-11 items-center justify-between border-t border-line-soft pt-2.5 text-[15px] font-semibold text-tomato">
              Bekijk maaltijd
              <ChevronRightIcon size={20} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
