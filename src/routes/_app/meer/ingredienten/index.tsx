import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { BoxIcon, ChevronRightIcon, PlusIcon } from '~/components/icons'
import { IngredientAvatar } from '~/components/ingredient-header'
import { useSearchText } from '~/components/use-search-text'
import {
  Badge,
  DetailHeader,
  EmptyState,
  ListGroup,
  Notice,
  Page,
  SearchField,
  SegmentGroup,
  buttonClass,
  segmentClass,
} from '~/components/ui'
import { getCatalog } from '~/server/catalog.functions'

export const Route = createFileRoute('/_app/meer/ingredienten/')({
  search: { middlewares: [stripSearchParams({ query: '', includeArchived: false })] },
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === 'string' ? search.query.slice(0, 160) : '',
    includeArchived: search.includeArchived === true,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCatalog({ data: deps }),
  head: () => ({ meta: [{ title: 'Ingrediënten · Gerechter' }] }),
  component: CatalogPage,
})

function CatalogPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { text, setText, submit } = useSearchText(search.query, (query) =>
    navigate({ search: (prev) => ({ ...prev, query }), replace: true }),
  )
  return (
    <>
      <DetailHeader title="Ingrediënten" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form
            role="search"
            className="lg:flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <SearchField
              label="Zoek ingrediënten"
              name="query"
              maxLength={160}
              placeholder="Naam of andere naam"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </form>
          <div className="lg:w-64">
            <SegmentGroup label="Tonen">
              {[
                { label: 'Actief', archived: false },
                { label: 'Met archief', archived: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={search.includeArchived === option.archived}
                  className={segmentClass(search.includeArchived === option.archived)}
                  onClick={() =>
                    void navigate({ search: (prev) => ({ ...prev, includeArchived: option.archived }) })
                  }
                >
                  {option.label}
                </button>
              ))}
            </SegmentGroup>
          </div>
        </div>
        <Link to="/meer/ingredienten/nieuw" className={buttonClass('secondary', 'self-start')}>
          <PlusIcon size={20} />
          Ingrediënt toevoegen
        </Link>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : result.data.length === 0 ? (
          <EmptyState icon={<BoxIcon />} title="Geen ingrediënten gevonden">
            Probeer een andere naam of voeg een ingrediënt toe.
          </EmptyState>
        ) : (
          <ListGroup label="Ingrediënten">
            {result.data.map((item) => (
              <Link
                key={item.id}
                to="/meer/ingredienten/$ingredientId"
                params={{ ingredientId: item.id }}
                className="flex min-h-15 items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0 hover:bg-ground"
              >
                <IngredientAvatar photo={item.photo} name={item.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-semibold break-words">{item.name}</span>
                  <span className="text-[13px] text-ink-3">
                    {item.scope === 'global' ? 'Gedeelde catalogus' : 'Mijn huishouden'} · {item.baseUnit}
                  </span>
                </span>
                {item.archivedAt && <Badge>gearchiveerd</Badge>}
                <ChevronRightIcon size={18} className="shrink-0 text-ink-3" />
              </Link>
            ))}
          </ListGroup>
        )}
      </Page>
    </>
  )
}
