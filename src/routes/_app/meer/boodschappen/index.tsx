import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckIcon, ChevronRightIcon } from '~/components/icons'
import { dayTitle, formatWeekRange, isoWeek } from '~/components/planning-dates'
import { ShoppingNeedsView } from '~/components/shopping-needs-view'
import { ShoppingSourceForm, type ShoppingSearch } from '~/components/shopping-source-form'
import { shoppingStatusLabels, shoppingTargetLabels } from '~/components/shopping-labels'
import {
  ActionBar,
  Badge,
  Button,
  DetailHeader,
  ListGroup,
  ListLink,
  Notice,
  Page,
  SectionTitle,
  cx,
  groupRowClass,
} from '~/components/ui'
import { isCalendarDate, shiftDate, todayAmsterdam } from '~/domain/calendar'
import type { ShoppingSource } from '~/domain/shopping-types'
import { getShoppingPage, startShoppingExportFn } from '~/server/shopping.functions'

export const Route = createFileRoute('/_app/meer/boodschappen/')({
  validateSearch: (search: Record<string, unknown>): ShoppingSearch => ({
    kind:
      search.kind === 'recipe' || search.kind === 'day' || search.kind === 'week' ? search.kind : undefined,
    recipeId: typeof search.recipeId === 'string' ? search.recipeId.slice(0, 100) : undefined,
    date: typeof search.date === 'string' && isCalendarDate(search.date) ? search.date : undefined,
    servings:
      typeof search.servings === 'number' &&
      Number.isInteger(search.servings) &&
      search.servings >= 1 &&
      search.servings <= 1000
        ? search.servings
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getShoppingPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Boodschappen · Gerechter' }] }),
  component: ShoppingPage,
})

type Target = 'share' | 'notion' | 'ah'
const targetNames: Record<Target, string> = { share: 'Delen', notion: 'Notion', ah: 'Albert Heijn' }
const targetDetails: Record<Target, string> = {
  share: 'Kopiëren of via je telefoon delen',
  notion: 'Op je gekoppelde Notion-pagina',
  ah: 'Lijstje in de AH-app',
}
const onList = new Set(['succeeded', 'copied', 'shared'])

function sourceTitle(source: ShoppingSource, name?: string) {
  if (source.kind === 'week')
    return `Week ${isoWeek(source.date)} · ${formatWeekRange(source.date, shiftDate(source.date, 6), todayAmsterdam())}`
  if (source.kind === 'day') return dayTitle(source.date)
  return `${name ?? 'Gerecht'} · ${source.servings} personen`
}

function ShoppingPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repeat, setRepeat] = useState(false)
  const [target, setTarget] = useState<Target>('share')
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Boodschappen" back="/meer" backLabel="Terug naar Meer" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const { preview, targets } = result.data
  const needs = preview?.proposal
  const recipe =
    needs?.source.kind === 'recipe' && needs.sources[0]
      ? { id: needs.source.recipeId, name: needs.sources[0].name }
      : undefined
  const available = targets.filter((option) => option.target !== 'ah' || option.configured)
  const chosen = available.find((option) => option.target === target && option.configured)
  async function exportTo(target: Target) {
    if (!needs) return
    setBusy(true)
    setError(null)
    try {
      const exported = await startShoppingExportFn({
        data: {
          source: needs.source,
          fingerprint: needs.fingerprint,
          requestId: needs.requestId,
          target,
          allowRepeat: repeat,
        },
      })
      if (exported.ok)
        await navigate({ to: '/meer/boodschappen/historie/$runId', params: { runId: exported.data.id } })
      else setError(exported.message)
    } catch {
      setError(
        'Het antwoord is weggevallen. Open de exporthistorie of probeer exact dit verzoek opnieuw; een bestaande export wordt niet opnieuw verstuurd.',
      )
    } finally {
      setBusy(false)
    }
  }
  const previous =
    preview?.previousExports.filter(
      (run, index, all) => all.findIndex((other) => other.runId === run.runId) === index,
    ) ?? []
  const listed = (key: string) =>
    [
      ...new Set(
        preview?.previousExports
          .filter((run) => run.sourceKey === key && onList.has(run.status))
          .map((run) => targetNames[run.target]),
      ),
    ].join(', ')
  return (
    <>
      <DetailHeader
        title="Boodschappen"
        subtitle={needs ? sourceTitle(needs.source, recipe?.name) : undefined}
        back="/meer"
        backLabel="Terug naar Meer"
      />
      <Page>
        {needs && (
          <section className="flex flex-col gap-2.5" aria-label="Bronnen">
            <SectionTitle>
              {needs.source.kind === 'recipe' ? 'Welk gerecht?' : 'Welke gerechten?'}
            </SectionTitle>
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {needs.sources.map((source) => {
                const on = listed(source.key)
                return (
                  <li key={source.key} className={cx(groupRowClass, 'min-h-16 gap-3.5 hover:bg-transparent')}>
                    <CheckIcon size={20} className="shrink-0 text-herb" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold break-words">{source.name}</p>
                      <p className="text-[13px] text-ink-3">
                        {source.servings} personen{on ? ` · al op lijst (${on})` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
              {needs.sources.length === 0 && (
                <li className="px-4 py-5 text-[15px] text-ink-3">
                  Geen geplande gerechten om boodschappen voor te doen.
                </li>
              )}
            </ul>
          </section>
        )}
        <details open={!needs} className="group rounded-2xl bg-surface">
          <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
            Andere week, dag of gerecht
            <ChevronRightIcon
              size={20}
              className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="border-t border-line-soft p-4">
            <ShoppingSourceForm
              key={JSON.stringify(search)}
              initial={search}
              date={result.data.defaultDate}
              defaultServings={result.data.defaultServings}
              recipe={recipe}
              open={async (next) => {
                setError(null)
                setRepeat(false)
                await navigate({ search: next })
              }}
            />
          </div>
        </details>
        {needs ? (
          <>
            <ShoppingNeedsView
              needs={needs}
              ah={target === 'ah' && chosen ? { onLinked: () => router.invalidate() } : undefined}
            />
            {needs.lines.length > 0 && (
              <section className="flex flex-col gap-2.5" aria-label="Waarheen?">
                <SectionTitle>Waarheen?</SectionTitle>
                <div className="flex flex-col gap-2">
                  {available.map((option) => (
                    <button
                      key={option.target}
                      type="button"
                      aria-pressed={target === option.target}
                      disabled={busy || !option.configured}
                      onClick={() => setTarget(option.target)}
                      className={cx(
                        'flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-surface px-4 py-2 text-left text-ink transition-colors disabled:opacity-60',
                        target === option.target && option.configured
                          ? 'border-tomato ring-1 ring-tomato'
                          : 'border-line hover:bg-ground',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">{targetNames[option.target]}</span>
                        <span className="block text-[13px] text-ink-3">
                          {option.configured ? targetDetails[option.target] : 'Nog niet gekoppeld'}
                        </span>
                      </span>
                      {option.target === 'ah' && <Badge tone="amber">experimenteel</Badge>}
                    </button>
                  ))}
                </div>
                {(previous.length > 0 || error) && (
                  <>
                    <label className="flex items-center gap-3 rounded-2xl bg-surface py-1 pr-4 pl-1">
                      <input
                        type="checkbox"
                        checked={repeat}
                        onChange={(event) => setRepeat(event.target.checked)}
                        disabled={busy}
                        className="size-11 shrink-0 accent-tomato"
                      />
                      <span className="min-w-0 text-[15px] break-words">
                        Bewust opnieuw exporteren naar dit doel
                      </span>
                    </label>
                    <p className="px-1 text-[13px] text-ink-3">
                      Controleer eerdere exports voordat je een bron opnieuw toevoegt. Een onzekere eerdere
                      verzending moet eerst worden gecontroleerd.
                    </p>
                  </>
                )}
              </section>
            )}
            {error && (
              <>
                <Notice tone="error">{error}</Notice>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setError(null)
                    await router.invalidate()
                  }}
                >
                  Actueel voorstel ophalen
                </Button>
              </>
            )}
            {previous.length > 0 && (
              <section className="flex flex-col gap-2.5" aria-label="Eerdere exports">
                <SectionTitle>Eerdere exports van deze bronnen</SectionTitle>
                <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
                  {previous.map((run) => (
                    <li key={run.runId} className="border-b border-line-soft last:border-b-0">
                      <Link
                        to="/meer/boodschappen/historie/$runId"
                        params={{ runId: run.runId }}
                        className={cx(groupRowClass, 'border-b-0 text-[15px]')}
                      >
                        <span className="min-w-0 flex-1">
                          {shoppingTargetLabels[run.target]} · {shoppingStatusLabels[run.status]}
                        </span>
                        <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <Notice>Kies een gerecht om de boodschappenbehoefte te berekenen.</Notice>
        )}
        <ListGroup label="Boodschappen beheren">
          <ListLink
            to="/meer/boodschappen/historie"
            title="Exporthistorie"
            detail="Eerdere lijsten en hun status"
          />
          <ListLink
            to="/meer/boodschappen/verbindingen"
            title="Verbindingen"
            detail="Notion en Albert Heijn koppelen"
          />
        </ListGroup>
        {needs && needs.lines.length > 0 && (
          <ActionBar>
            <p className="text-center text-sm text-ink-2">
              {needs.lines.length === 1 ? '1 item' : `${needs.lines.length} items`} na aftrek van voorraad en
              basisvoorraad
            </p>
            <Button
              className="min-h-13 text-base"
              disabled={busy || !chosen}
              onClick={() => chosen && exportTo(chosen.target)}
            >
              {busy ? 'Bezig…' : `Zet op lijst · ${targetNames[target]}`}
            </Button>
          </ActionBar>
        )}
      </Page>
    </>
  )
}
