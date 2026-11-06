import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { BoxIcon, ChevronRightIcon, PlusIcon } from '~/components/icons'
import { IngredientAvatar } from '~/components/ingredient-header'
import { amountLabel } from '~/components/pantry-form'
import { useSearchText } from '~/components/use-search-text'
import {
  Badge,
  EmptyState,
  Notice,
  Page,
  SearchField,
  SectionHeader,
  SegmentGroup,
  cx,
  iconButtonClass,
  segmentClass,
} from '~/components/ui'
import { getPantryPage } from '~/server/pantry.functions'

export const Route = createFileRoute('/_app/voorraad/')({
  search: { middlewares: [stripSearchParams({ query: '', includeEmpty: false, basis: false })] },
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === 'string' ? search.query.slice(0, 160) : '',
    includeEmpty: search.includeEmpty === true,
    basis: search.basis === true && search.includeEmpty !== true,
  }),
  loaderDeps: ({ search: { query, includeEmpty } }) => ({ query, includeEmpty }),
  loader: ({ deps }) => getPantryPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Voorraad · Gerechter' }] }),
  component: PantryPage,
})

const filters = [
  { id: 'all', label: 'Alles', search: { basis: false, includeEmpty: false } },
  { id: 'basis', label: 'Basis', search: { basis: true, includeEmpty: false } },
  { id: 'empty', label: 'Leeg', search: { basis: false, includeEmpty: true } },
] as const

const columns = 'lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_20px] lg:gap-4'

function PantryPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { text, setText, submit } = useSearchText(search.query, (query) =>
    navigate({ search: (prev) => ({ ...prev, query }), replace: true }),
  )
  const active = search.includeEmpty ? 'empty' : search.basis ? 'basis' : 'all'

  const rows = !result.ok
    ? []
    : result.data.filter((item) =>
        active === 'basis' ? item.staple : active === 'empty' ? item.quantity === 0 && !item.staple : true,
      )
  const filtered = Boolean(search.query) || active !== 'all'
  return (
    <>
      <SectionHeader
        title="Voorraad"
        action={
          <Link
            to="/voorraad/nieuw"
            aria-label="Ingrediënt toevoegen"
            className={iconButtonClass(
              'primary',
              'lg:min-h-12 lg:w-auto lg:gap-2 lg:px-5 lg:text-[15px] lg:font-bold',
            )}
          >
            <PlusIcon size={22} />
            <span className="hidden lg:inline">Ingrediënt toevoegen</span>
          </Link>
        }
      />
      <Page>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <form
            role="search"
            className="lg:flex-[1_1_280px]"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <SearchField
              label="Zoek voorraad"
              name="query"
              maxLength={160}
              placeholder="Zoek ingrediënt of andere naam"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </form>
          <div className="lg:w-80">
            <SegmentGroup label="Filter">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={active === filter.id}
                  className={segmentClass(active === filter.id)}
                  onClick={() => void navigate({ search: (prev) => ({ ...prev, ...filter.search }) })}
                >
                  {filter.label}
                </button>
              ))}
            </SegmentGroup>
          </div>
        </div>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : rows.length === 0 ? (
          <EmptyState icon={<BoxIcon />} title={filtered ? 'Geen voorraad gevonden' : 'Nog geen voorraad'}>
            {active === 'empty'
              ? 'Er zijn geen lege of verwijderde regels.'
              : 'Voeg toe wat je in huis hebt of markeer ingrediënten als basisvoorraad.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:rounded-[20px]">
            <div
              aria-hidden="true"
              className={cx(
                'hidden items-center border-b border-line px-6 py-3.5 text-[13px] font-bold tracking-wide text-ink-3 uppercase',
                columns,
              )}
            >
              <span>Ingrediënt</span>
              <span>Thuis</span>
              <span>Basisvoorraad</span>
            </div>
            <ul aria-label="Voorraad">
              {rows.map((item) => (
                <li key={item.ingredientId} className="border-b border-line-soft last:border-b-0">
                  <Link
                    to="/voorraad/$ingredientId"
                    params={{ ingredientId: item.ingredientId }}
                    className={cx(
                      'flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-ground lg:min-h-16 lg:items-center lg:px-6',
                      columns,
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <IngredientAvatar photo={item.photo} name={item.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-base break-words lg:font-semibold">{item.name}</span>
                        {item.archivedAt && (
                          <span className="text-[13px] text-ink-3">Ingrediënt gearchiveerd</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {item.staple ? (
                        <>
                          <span className="lg:hidden">
                            <Badge>basis</Badge>
                          </span>
                          <span className="hidden text-[15px] text-ink-3 lg:inline">Altijd in huis</span>
                        </>
                      ) : (
                        <span
                          className={cx(
                            'text-[15px] font-semibold whitespace-nowrap',
                            item.quantity === 0 && 'text-ink-3',
                          )}
                        >
                          {amountLabel(item.quantity, item.baseUnit)}
                        </span>
                      )}
                    </span>
                    <span className="hidden lg:block">
                      {item.staple ? <Badge tone="herb">basis</Badge> : <span className="text-ink-3">—</span>}
                    </span>
                    <ChevronRightIcon size={18} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Page>
    </>
  )
}
