import { createFileRoute, Link } from '@tanstack/react-router'
import { PlannedMealList } from '~/components/planned-meal-list'
import { dayTitle } from '~/components/planning-dates'
import { ActionBar, DetailHeader, Notice, Page, buttonClass } from '~/components/ui'
import { getDayPage } from '~/server/planning.functions'

export const Route = createFileRoute('/_app/week/dag/$date')({
  loader: ({ params }) => getDayPage({ data: params }),
  head: () => ({ meta: [{ title: 'Dagplanning · Gerechter' }] }),
  component: DayPage,
})
function DayPage() {
  const result = Route.useLoaderData()
  const { date } = Route.useParams()
  return (
    <>
      <DetailHeader
        title={dayTitle(date)}
        back="/week"
        backSearch={{ week: date }}
        backLabel="Terug naar week"
      />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : result.data.items.length === 0 ? (
          <>
            <p className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-6 text-center text-[15px] text-ink-2">
              Nog niets gepland op deze dag.
            </p>
            <ActionBar>
              <Link
                to="/week/nieuw"
                search={{ date }}
                className={buttonClass('primary', 'min-h-13 text-base')}
              >
                Maaltijd plannen
              </Link>
            </ActionBar>
          </>
        ) : (
          <>
            <PlannedMealList items={result.data.items} />
            <ActionBar>
              <div className="flex gap-2.5">
                <Link
                  to="/meer/boodschappen"
                  search={{ kind: 'day', date }}
                  className={buttonClass('secondary', 'flex-1 px-3')}
                >
                  Op lijst zetten
                </Link>
                <Link to="/week/nieuw" search={{ date }} className={buttonClass('secondary', 'flex-1 px-3')}>
                  Maaltijd toevoegen
                </Link>
              </div>
            </ActionBar>
          </>
        )}
      </Page>
    </>
  )
}
