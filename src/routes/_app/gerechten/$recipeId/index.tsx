import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { CookingMode } from '~/components/cooking-mode'
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, PencilIcon, PotIcon } from '~/components/icons'
import { IngredientThumbnail } from '~/components/ingredient-photo'
import { RecipeInstructions } from '~/components/recipe-instructions'
import {
  ActionBar,
  Badge,
  DetailHeader,
  Notice,
  Page,
  SectionTitle,
  Stepper,
  Tag,
  buttonClass,
  cx,
  groupRowClass,
  iconButtonClass,
} from '~/components/ui'
import { archiveRecipeFn, getRecipePage } from '~/server/recipes.functions'

export const Route = createFileRoute('/_app/gerechten/$recipeId/')({
  validateSearch: (search: Record<string, unknown>): { servings?: number } => ({
    servings:
      typeof search.servings === 'number' &&
      Number.isInteger(search.servings) &&
      search.servings > 0 &&
      search.servings <= 1000
        ? search.servings
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getRecipePage({ data: { ...params, ...deps } }),
  head: () => ({ meta: [{ title: 'Gerecht · Gerechter' }] }),
  component: RecipePage,
})

type Recipe = Extract<Awaited<ReturnType<typeof getRecipePage>>, { ok: true }>['data']

const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 6 })
const score = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const shortDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatShortDate = (value: string) => shortDate.format(new Date(`${value}T12:00:00.000Z`))

function RecipePage() {
  const result = Route.useLoaderData()
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Gerecht" back="/gerechten" backLabel="Terug naar gerechten" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  return <RecipeDetail item={result.data} />
}

function RecipeDetail({ item }: { item: Recipe }) {
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ base: number; value: number } | null>(null)
  const servings = pending && pending.base === item.viewServings ? pending.value : item.viewServings
  const factor = servings / item.viewServings
  const stats = item.stats
  const [cooking, setCooking] = useState(false)
  const closeCooking = useCallback(() => setCooking(false), [])
  const actions = (
    <>
      {!item.archivedAt && (
        <Link to="/week/nieuw" search={{ recipeId: item.id }} className={buttonClass('primary', 'flex-1')}>
          Inplannen
        </Link>
      )}
      <Link
        to="/meer/boodschappen"
        search={{ kind: 'recipe', recipeId: item.id, servings }}
        className={buttonClass('secondary', 'flex-1')}
      >
        Op lijst zetten
      </Link>
    </>
  )
  return (
    <Page className="lg:gap-5 lg:[&>:last-child]:hidden">
      <nav aria-label="Kruimelpad" className="hidden text-sm text-ink-3 lg:block">
        <Link
          to="/gerechten"
          search={{ query: '', includeArchived: false }}
          className="font-semibold text-ink-2 hover:text-ink"
        >
          Gerechten
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{item.name}</span>
      </nav>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <section className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_340px]">
          <Hero item={item} />
          <div className="flex flex-col gap-2 px-1 lg:px-0">
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}
            <h1 className="font-display text-[30px] leading-[1.05] font-bold tracking-tight break-words lg:text-[40px]">
              {item.name}
            </h1>
            <p className="text-sm text-ink-2 lg:hidden">
              {stats ? (
                <>
                  {stats.averageScore !== null && (
                    <>
                      <strong className="text-herb">{score.format(stats.averageScore)}</strong> gemiddeld
                      ·{' '}
                    </>
                  )}
                  <strong className="text-ink">{stats.timesMade}×</strong> gemaakt
                  {stats.lastMade && ` · laatst ${formatShortDate(stats.lastMade)}`}
                </>
              ) : (
                'Nog niet gemaakt'
              )}
            </p>
            {stats ? (
              <dl className="mt-2 hidden grid-cols-3 gap-2 lg:grid">
                {[
                  {
                    label: 'gemiddeld',
                    value: stats.averageScore === null ? '–' : score.format(stats.averageScore),
                    tone: 'text-herb',
                  },
                  { label: 'gemaakt', value: `${stats.timesMade}×` },
                  { label: 'laatst', value: stats.lastMade ? formatShortDate(stats.lastMade) : '–' },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="flex flex-col-reverse rounded-[14px] bg-surface px-3.5 py-3"
                  >
                    <dt className="text-[13px] text-ink-3">{tile.label}</dt>
                    <dd className={cx('font-display text-2xl font-bold', tile.tone)}>{tile.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="hidden text-sm text-ink-2 lg:block">Nog niet gemaakt</p>
            )}
            <p className="text-[13px] text-ink-3">
              Recept voor {item.servings} porties
              {item.prepMinutes !== null ? ` · ${item.prepMinutes} min voorbereiden` : ''}
              {item.cookMinutes !== null ? ` · ${item.cookMinutes} min bereiden` : ''}
            </p>
            {item.description && (
              <p className="text-[15px] whitespace-pre-wrap break-words text-ink-2">{item.description}</p>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {item.archivedAt && (
            <Notice>Dit gerecht is gearchiveerd. Bestaande planning en geschiedenis blijven behouden.</Notice>
          )}
          <div className="hidden flex-wrap gap-2.5 lg:flex">{actions}</div>
        </section>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-[1.3_1_420px]">
          <Ingredients
            item={item}
            servings={servings}
            factor={factor}
            change={(value) => {
              setPending({ base: item.viewServings, value })
              void navigate({ search: { servings: value }, replace: true, resetScroll: false })
            }}
          />
          <button
            type="button"
            onClick={() => setCooking(true)}
            className={buttonClass('secondary', 'w-full gap-2')}
          >
            <PotIcon size={20} />
            Kookmodus
          </button>
          <RecipeInstructions key={`${item.id}-${item.version}`} sections={item.sections} />
          <section aria-label="Meer bij dit gerecht" className="flex flex-col gap-2">
            <SectionTitle>Meer</SectionTitle>
            <div className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              <Link
                to="/gerechten/$recipeId/gemaakt"
                params={{ recipeId: item.id }}
                search={{ servings }}
                className={groupRowClass}
              >
                <span className="flex-1 font-semibold">Gemaakt registreren</span>
                <ChevronRightIcon size={20} className="text-ink-3" />
              </Link>
              <Link
                to="/meer/geschiedenis"
                search={{ query: '', recipeId: item.id }}
                className={groupRowClass}
              >
                <span className="flex-1 font-semibold">Eerdere bereidingen</span>
                {stats && (
                  <span className="text-sm text-ink-3">
                    {stats.ratingCount === 1 ? '1 cijfer' : `${stats.ratingCount} cijfers`}
                  </span>
                )}
                <ChevronRightIcon size={20} className="text-ink-3" />
              </Link>
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={groupRowClass}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">Bekijk de bron</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {sourceHost(item.sourceUrl)}
                    </span>
                  </span>
                  <ChevronRightIcon size={20} className="text-ink-3" />
                </a>
              )}
              <button
                type="button"
                disabled={busy}
                className={cx(
                  groupRowClass,
                  'w-full text-left font-semibold disabled:opacity-60',
                  item.archivedAt ? 'text-ink' : 'text-tomato-dark',
                )}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    const res = await archiveRecipeFn({
                      data: { recipeId: item.id, archived: !item.archivedAt },
                    })
                    if (res.ok) await router.invalidate()
                    else setError(res.message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {item.archivedAt ? 'Gerecht herstellen' : 'Gerecht archiveren'}
              </button>
            </div>
          </section>
        </div>
      </div>
      <ActionBar>
        <div className="flex gap-2.5">{actions}</div>
      </ActionBar>
      {cooking && (
        <CookingMode
          name={item.name}
          servings={servings}
          sections={item.sections}
          onClose={closeCooking}
          lines={item.ingredients.map((line) => {
            const quantity = line.scaledQuantity === null ? null : line.scaledQuantity * factor
            return {
              name: line.name,
              amount: quantity === null ? 'naar smaak' : `${number.format(quantity)} ${line.unit}`,
              note: line.note,
              photo: line.photo,
            }
          })}
        />
      )}
    </Page>
  )
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Hero({ item }: { item: Recipe }) {
  const [failed, setFailed] = useState<string | null>(null)
  const photo = item.imageUrl && failed !== item.imageUrl ? item.imageUrl : null
  const overlay = 'absolute top-4 bg-surface text-ink shadow-[0_1px_3px_rgba(24,32,27,0.18)] hover:bg-ground'
  return (
    <div
      className={cx(
        'relative -mx-4 flex items-center justify-center overflow-hidden bg-muted lg:mx-0 lg:rounded-[20px]',
        photo ? 'h-60 lg:h-70' : 'h-40 lg:h-56',
      )}
    >
      {photo ? (
        <img
          src={photo}
          alt={item.name}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(photo)}
        />
      ) : (
        <ImageIcon size={56} strokeWidth={1.25} className="text-ink-3" />
      )}
      <Link
        to="/gerechten"
        search={{ query: '', includeArchived: false }}
        aria-label="Terug naar gerechten"
        className={cx(iconButtonClass('plain'), overlay, 'left-3 lg:hidden')}
      >
        <ChevronLeftIcon size={24} />
      </Link>
      <Link
        to="/gerechten/$recipeId/bewerken"
        params={{ recipeId: item.id }}
        aria-label="Gerecht bewerken"
        className={cx(iconButtonClass('plain'), overlay, 'right-3')}
      >
        <PencilIcon size={20} />
      </Link>
    </div>
  )
}

function Ingredients({
  item,
  servings,
  factor,
  change,
}: {
  item: Recipe
  servings: number
  factor: number
  change: (servings: number) => void
}) {
  const required = new Map<string, number | null>()
  for (const line of item.ingredients) {
    const previous = required.get(line.ingredientId)
    required.set(
      line.ingredientId,
      previous === null || line.baseQuantity === null ? null : (previous ?? 0) + line.baseQuantity * factor,
    )
  }
  const seen = new Set<string>()
  return (
    <section
      aria-label="Ingrediëntenlijst"
      className="flex flex-col gap-3 lg:rounded-[20px] lg:bg-surface lg:px-6 lg:py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-surface py-2 pr-2 pl-4 lg:p-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold lg:text-lg lg:font-bold">Ingrediënten</h2>
          <p className="text-[13px] text-ink-3">Hoeveelheden schalen mee</p>
        </div>
        <div role="group" aria-label="Personen" className="flex items-center gap-1.5">
          <span className="text-sm text-ink-3">Personen</span>
          <Stepper label="personen" value={servings} min={1} max={1000} onChange={change} />
        </div>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:grid lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] lg:gap-x-6 lg:rounded-none">
        {item.ingredients.map((line, index) => {
          const first = !seen.has(line.ingredientId)
          seen.add(line.ingredientId)
          const quantity = line.scaledQuantity === null ? null : line.scaledQuantity * factor
          const amount = quantity === null ? 'naar smaak' : `${number.format(quantity)} ${line.unit}`
          return (
            <li
              key={index}
              className="flex min-h-14 items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0 lg:px-0"
            >
              <IngredientThumbnail photo={line.photo} name={line.name} small />
              <span className="w-[4.5rem] shrink-0 text-[15px] font-bold break-words lg:hidden">
                {amount}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words">
                  <strong className="hidden lg:inline">{amount} </strong>
                  {line.name}
                </span>
                {line.note && <span className="block text-[13px] break-words text-ink-3">{line.note}</span>}
                {line.archived && (
                  <span className="block text-[13px] text-ink-3">Ingrediënt gearchiveerd</span>
                )}
              </span>
              {first && <StockBadge item={item} line={line} required={required.get(line.ingredientId)} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function StockBadge({
  item,
  line,
  required,
}: {
  item: Recipe
  line: Recipe['ingredients'][number]
  required: number | null | undefined
}) {
  const stock = item.stock.find((entry) => entry.ingredientId === line.ingredientId)
  if (!stock) return null
  if (stock.staple) return <Badge>basis</Badge>
  if (required === null || required === undefined) return null
  if (stock.quantity >= required) return <Badge tone="herb">in huis</Badge>
  return (
    <Badge tone="tomato">
      {number.format(required - stock.quantity)} {line.baseUnit} tekort
    </Badge>
  )
}
