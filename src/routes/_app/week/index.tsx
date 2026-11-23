import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon, ListIcon } from '~/components/icons'
import { formatWeekRange, isoWeek } from '~/components/planning-dates'
import { Notice, Page, SectionHeader, buttonClass, iconButtonClass } from '~/components/ui'
import { WeekPlanBoard } from '~/components/week-plan-board'
import { isCalendarDate, todayAmsterdam } from '~/domain/calendar'
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
        <WeekPlanBoard days={week.days} today={today} />
      </Page>
    </>
  )
}
