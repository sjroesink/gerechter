import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon, ListIcon, PlusIcon } from '~/components/icons'
import { dayOfMonth, formatWeekRange, isoWeek, weekdayShort } from '~/components/planning-dates'
import { Notice, Page, SectionHeader, buttonClass, cx, iconButtonClass, rowCardClass } from '~/components/ui'
import { formatCalendarDay, isCalendarDate, todayAmsterdam } from '~/domain/calendar'
import type { PlanSummary } from '~/domain/planning'
import { getWeekPage } from '~/server/planning.functions'

export const Route = createFileRoute('/_app/week/')({
  validateSearch: (search: Record<string, unknown>): { week?: string } => ({
    week: typeof search.week === 'string' && isCalendarDate(search.week) ? search.week : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWeekPage({ data: { date: deps.week } }),
  head: () => ({ meta: [{ title: 'Week · Gerechter' }] }),
  component: WeekPage,
})
function WeekPage() {
  const result = Route.useLoaderData()
  if (!result.ok)
    return (
      <>
        <SectionHeader title="Week" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const week = result.data
  const today = todayAmsterdam()
  const current = week.start <= today && today <= week.end
  const title = `Week ${isoWeek(week.start)}`
  const shopping = { kind: 'week' as const, date: week.start }
  return (
    <>
      <div className="lg:hidden">
        <SectionHeader
          title="Week"
          action={
            <Link
              to="/meer/boodschappen"
              search={shopping}
              aria-label="Boodschappen voor deze week"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[15px] font-semibold text-ink hover:bg-ground"
            >
              <ListIcon size={18} />
              Boodschappen
            </Link>
          }
        />
      </div>
      <Page>
        <nav
          aria-label="Weeknavigatie"
          className="-mx-1 -mt-3 flex items-center justify-between gap-2 lg:mx-0 lg:mt-0 lg:mb-2 lg:flex-wrap lg:justify-start"
        >
          <Link
            to="/week"
            search={{ week: week.previous }}
            aria-label="Vorige week"
            className={iconButtonClass('plain', 'lg:border lg:border-line lg:bg-surface lg:text-ink')}
          >
            <ChevronLeftIcon size={22} />
          </Link>
          <div className="order-2 flex min-w-0 flex-col items-center text-center lg:order-3 lg:ml-2 lg:items-start lg:text-left">
            <p className="text-[17px] font-bold lg:hidden">{title}</p>
            <h1 className="hidden font-display text-[34px] leading-tight font-bold tracking-tight lg:block">
              {title}
            </h1>
            <p className="text-sm text-ink-3 lg:text-[15px]">
              {formatWeekRange(week.start, week.end, today)}
            </p>
            {!current && (
              <Link
                to="/week"
                search={{}}
                className="inline-flex min-h-11 items-center text-[13px] font-semibold text-tomato hover:text-tomato-dark"
              >
                Naar deze week
              </Link>
            )}
          </div>
          <Link
            to="/week"
            search={{ week: week.next }}
            aria-label="Volgende week"
            className={iconButtonClass(
              'plain',
              'order-3 lg:order-2 lg:border lg:border-line lg:bg-surface lg:text-ink',
            )}
          >
            <ChevronRightIcon size={22} />
          </Link>
          <Link
            to="/meer/boodschappen"
            search={shopping}
            aria-label="Boodschappen voor deze week"
            className={buttonClass('primary', 'order-4 ml-auto max-lg:hidden')}
          >
            <ListIcon size={18} />
            Boodschappen
          </Link>
        </nav>
        <ul
          aria-label="Dagen"
          className="flex flex-col gap-2 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] lg:gap-3"
        >
          {week.days.map((day) => (
            <li key={day.date} className="flex">
              <DayCard date={day.date} items={day.items} today={day.date === today} />
            </li>
          ))}
        </ul>
      </Page>
    </>
  )
}

function DayCard({ date, items, today }: { date: string; items: PlanSummary[]; today: boolean }) {
  const label = (
    <span className="sr-only">
      {formatCalendarDay(date)}
      {today ? ', vandaag' : ''}:{' '}
    </span>
  )
  const dateBlock = (
    <span
      aria-hidden="true"
      className={cx(
        'flex w-10 shrink-0 flex-col items-center justify-center text-center lg:w-auto lg:flex-row lg:justify-start lg:gap-1 lg:text-xs lg:font-bold',
        today
          ? 'h-12 rounded-xl bg-tomato text-surface lg:h-auto lg:rounded-none lg:bg-transparent lg:text-tomato'
          : 'lg:text-ink-3',
      )}
    >
      <span className={cx('text-xs font-semibold lg:font-bold', !today && 'text-ink-3')}>
        {weekdayShort(date)}
      </span>
      <span className="text-lg leading-tight font-bold lg:text-xs">{dayOfMonth(date)}</span>
      {today && <span className="hidden lg:inline">· VANDAAG</span>}
    </span>
  )
  if (items.length === 0)
    return (
      <Link
        to="/week/nieuw"
        search={{ date }}
        className={cx(
          'flex min-h-16 w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-3.5 py-2 text-ink-2 transition-colors hover:bg-surface lg:min-h-36 lg:flex-col lg:justify-center lg:gap-2',
          today ? 'border-tomato' : 'border-line',
        )}
      >
        {label}
        {dateBlock}
        <span className="flex flex-1 items-center gap-1.5 text-[15px] font-medium lg:flex-none lg:font-semibold">
          <PlusIcon size={18} />
          Plan iets
        </span>
      </Link>
    )
  const [only] = items
  const target =
    items.length === 1
      ? ({ to: '/week/maaltijd/$mealId', params: { mealId: only!.id } } as const)
      : ({ to: '/week/dag/$date', params: { date } } as const)
  return (
    <Link
      {...target}
      className={cx(
        rowCardClass,
        'w-full lg:min-h-36 lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-3.5 lg:py-3',
        today && 'min-h-18 ring-2 ring-tomato',
      )}
    >
      {label}
      {dateBlock}
      <span className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-none">
        {today && (
          <span aria-hidden="true" className="text-[13px] font-bold text-tomato lg:hidden">
            Vandaag
          </span>
        )}
        {items.map((item) => (
          <span key={item.id} className="flex min-w-0 flex-col">
            <span
              className={cx(
                'text-base break-words lg:text-[15px] lg:leading-snug',
                item.kind === 'free' ? 'font-medium text-ink-2 italic' : 'font-semibold',
              )}
            >
              {item.title}
            </span>
            {item.kind === 'recipe' && (
              <span className="text-[13px] text-ink-3">
                {item.effectiveServings} personen{item.recipeArchivedAt ? ' · gearchiveerd' : ''}
              </span>
            )}
          </span>
        ))}
      </span>
      {today && <ChevronRightIcon size={20} className="shrink-0 text-ink-3 lg:hidden" />}
    </Link>
  )
}
