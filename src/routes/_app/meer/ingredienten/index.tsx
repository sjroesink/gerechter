import { createFileRoute, Link, stripSearchParams, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AhProductPicker } from '~/components/ah-product-picker'
import { BoxIcon, ChevronRightIcon, PlusIcon } from '~/components/icons'
import { IngredientAvatar } from '~/components/ingredient-header'
import { useSearchText } from '~/components/use-search-text'
import {
  Badge,
  Button,
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
import { getCatalogPage } from '~/server/catalog.functions'

export const Route = createFileRoute('/_app/meer/ingredienten/')({
  search: { middlewares: [stripSearchParams({ query: '', includeArchived: false })] },
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === 'string' ? search.query.slice(0, 160) : '',
    includeArchived: search.includeArchived === true,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCatalogPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Ingrediënten · Gerechter' }] }),
  component: CatalogPage,
})

function CatalogPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [picking, setPicking] = useState<string | null>(null)
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
        ) : result.data.items.length === 0 ? (
          <EmptyState icon={<BoxIcon />} title="Geen ingrediënten gevonden">
            Probeer een andere naam of voeg een ingrediënt toe.
          </EmptyState>
        ) : (
          <ListGroup label="Ingrediënten">
            {result.data.items.map((item) => {
              const canPick = result.data.ah?.connected
              return (
                <div key={item.id} className="border-b border-line-soft last:border-b-0">
                  <div className="flex items-center">
                    <Link
                      to="/meer/ingredienten/$ingredientId"
                      params={{ ingredientId: item.id }}
                      className="flex min-h-15 min-w-0 flex-1 items-center gap-3 px-4 py-2 hover:bg-ground"
                    >
                      <IngredientAvatar photo={item.photo} name={item.name} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-base font-semibold break-words">{item.name}</span>
                        <span className="text-[13px] text-ink-3">
                          {item.scope === 'global' ? 'Gedeelde catalogus' : 'Mijn huishouden'} ·{' '}
                          {item.baseUnit}
                        </span>
                        {item.ahProduct && (
                          <span className="text-[13px] break-words text-ink-2">
                            AH: {item.ahProduct.title}
                            {item.ahProduct.unitSize ? ` · ${item.ahProduct.unitSize}` : ''}
                          </span>
                        )}
                      </span>
                      {item.archivedAt && <Badge>gearchiveerd</Badge>}
                      {!canPick && <ChevronRightIcon size={18} className="shrink-0 text-ink-3" />}
                    </Link>
                    {canPick && (
                      <Button
                        variant="ghost"
                        className="min-h-11 shrink-0 px-4"
                        aria-label={`${item.ahProduct ? 'Wissel AH-product' : 'Koppel AH-product'} voor ${item.name}`}
                        aria-expanded={picking === item.id}
                        onClick={() => setPicking(picking === item.id ? null : item.id)}
                      >
                        {item.ahProduct ? 'Wissel' : 'Koppel AH'}
                      </Button>
                    )}
                  </div>
                  {picking === item.id && (
                    <div className="px-2 pb-2">
                      <AhProductPicker
                        ingredientId={item.id}
                        ingredientName={item.name}
                        baseUnit={item.baseUnit}
                        onCancel={() => setPicking(null)}
                        onSaved={async () => {
                          setPicking(null)
                          await router.invalidate()
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </ListGroup>
        )}
      </Page>
    </>
  )
}
