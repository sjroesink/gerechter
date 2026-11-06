import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArchiveIcon, PlusIcon, PotIcon } from '~/components/icons'
import {
  EmptyState,
  Notice,
  Page,
  SearchField,
  SectionHeader,
  chipClass,
  cx,
  iconButtonClass,
  rowCardClass,
} from '~/components/ui'
import { getRecipesPage } from '~/server/recipes.functions'

export const Route = createFileRoute('/_app/gerechten/')({
  search: { middlewares: [stripSearchParams({ query: '', includeArchived: false })] },
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === 'string' ? search.query.slice(0, 160) : '',
    includeArchived: search.includeArchived === true,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getRecipesPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Gerechten · Gerechter' }] }),
  component: RecipesPage,
})

const score = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function RecipesPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState(search.query)
  const [tag, setTag] = useState<string | null>(null)
  useEffect(() => {
    const value = query.trim() ? query : ''
    if (value === search.query) return
    const timeout = setTimeout(
      () => void navigate({ search: (prev) => ({ ...prev, query: value }), replace: true }),
      350,
    )
    return () => clearTimeout(timeout)
  }, [query, search.query, navigate])
  const recipes = result.ok ? result.data : []
  const tags = [...new Set(recipes.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, 'nl'))
  const activeTag = tag && tags.includes(tag) ? tag : null
  const shown = activeTag ? recipes.filter((item) => item.tags.includes(activeTag)) : recipes
  return (
    <>
      <SectionHeader
        title="Gerechten"
        action={
          <Link to="/gerechten/nieuw" aria-label="Nieuw gerecht" className={iconButtonClass('primary')}>
            <PlusIcon size={22} strokeWidth={2} />
          </Link>
        }
      />
      <Page className="gap-3">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            void navigate({ search: { ...search, query: query.trim() ? query : '' }, replace: true })
          }}
        >
          <SearchField
            label="Zoek gerechten"
            name="query"
            value={query}
            maxLength={160}
            placeholder="Zoeken op naam of tag"
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        {tags.length > 0 && (
          <div
            role="group"
            aria-label="Filter op tag"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
          >
            {[null, ...tags].map((value) => (
              <button
                key={value ?? ''}
                type="button"
                aria-pressed={activeTag === value}
                onClick={() => setTag(value)}
                className={cx(chipClass(activeTag === value), 'min-w-11 justify-center')}
              >
                {value ?? 'Alles'}
              </button>
            ))}
          </div>
        )}
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<PotIcon />}
            title={search.query || search.includeArchived ? 'Geen gerechten gevonden' : 'Nog geen gerechten'}
          >
            Voeg je eerste gerecht toe of probeer een andere zoekterm.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {shown.map((item) => {
              const minutes =
                item.prepMinutes !== null || item.cookMinutes !== null
                  ? (item.prepMinutes ?? 0) + (item.cookMinutes ?? 0)
                  : null
              const meta = item.tags.length
                ? item.tags.join(' · ')
                : `${item.servings} porties${minutes !== null ? ` · ${minutes} min` : ''}`
              return (
                <li key={item.id}>
                  <Link
                    to="/gerechten/$recipeId"
                    params={{ recipeId: item.id }}
                    className={cx(rowCardClass, 'pl-2')}
                  >
                    <RecipeThumb name={item.name} photoUrl={item.imageUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold break-words">{item.name}</span>
                      <span className="block text-[13px] break-words text-ink-3">
                        {item.archivedAt ? `Gearchiveerd · ${meta}` : meta}
                      </span>
                    </span>
                    {item.stats && (
                      <span className="shrink-0 text-right">
                        {item.stats.averageScore !== null && (
                          <span className="block font-bold text-herb">
                            {score.format(item.stats.averageScore)}
                          </span>
                        )}
                        <span className="block text-xs text-ink-3">{item.stats.timesMade}×</span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {result.ok && (
          <Link
            to="/gerechten"
            search={{ query, includeArchived: !search.includeArchived }}
            className="flex min-h-12 items-center justify-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink"
          >
            <ArchiveIcon size={18} />
            {search.includeArchived
              ? `Archief verbergen (${recipes.filter((item) => item.archivedAt).length})`
              : 'Archief tonen'}
          </Link>
        )}
      </Page>
    </>
  )
}

function RecipeThumb({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (photoUrl && failed !== photoUrl)
    return (
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-14 shrink-0 rounded-xl bg-muted object-cover"
        onError={() => setFailed(photoUrl)}
      />
    )
  return (
    <span
      aria-hidden="true"
      className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-[22px] font-bold text-ink-2"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
