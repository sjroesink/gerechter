import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronRightIcon, PotIcon } from '~/components/icons'
import {
  DetailHeader,
  EmptyState,
  Notice,
  Page,
  SearchField,
  buttonClass,
  rowCardClass,
} from '~/components/ui'
import { formatCalendarDay } from '~/domain/calendar'
import { getCookingHistoryPage } from '~/server/cooking.functions'

export const Route = createFileRoute('/_app/meer/geschiedenis/')({
  search: { middlewares: [stripSearchParams({ query: '' })] },
  validateSearch: (search: Record<string, unknown>): { query: string; recipeId?: string } => ({
    query: typeof search.query === 'string' ? search.query.slice(0, 160) : '',
    recipeId: typeof search.recipeId === 'string' ? search.recipeId.slice(0, 100) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCookingHistoryPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Gemaakt · Gerechter' }] }),
  component: HistoryPage,
})
function HistoryPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <DetailHeader title="Gemaakt" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        <form
          key={search.query}
          role="search"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            setBusy(true)
            try {
              await navigate({ search: { ...search, query: String(form.get('query') ?? '') } })
            } finally {
              setBusy(false)
            }
          }}
        >
          <SearchField
            label="Zoek bereidingen"
            name="query"
            defaultValue={search.query}
            maxLength={160}
            disabled={busy}
            placeholder="Zoeken op gerecht"
          />
        </form>
        {search.recipeId && (
          <Link
            to="/meer/geschiedenis"
            search={{ query: '' }}
            className={buttonClass('ghost', 'self-start px-1')}
          >
            Alle gerechten tonen
          </Link>
        )}
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : result.data.length === 0 ? (
          <EmptyState icon={<PotIcon />} title="Nog geen bereidingen gevonden">
            Registreer een gemaakt gerecht vanuit je recepten of planning.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.data.map((event) => (
              <li key={event.id}>
                <Link
                  to="/meer/geschiedenis/$eventId"
                  params={{ eventId: event.id }}
                  className={rowCardClass}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">{event.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      <span className="capitalize">{formatCalendarDay(event.date)}</span> · {event.servings}{' '}
                      porties · door {event.actorName}
                    </span>
                  </span>
                  <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  )
}
