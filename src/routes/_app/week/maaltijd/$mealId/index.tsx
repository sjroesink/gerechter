import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckIcon, ChevronRightIcon } from '~/components/icons'
import { dayTitle } from '~/components/planning-dates'
import {
  ActionBar,
  Button,
  DetailHeader,
  Notice,
  Page,
  SectionTitle,
  Stepper,
  Tag,
  buttonClass,
} from '~/components/ui'
import type { ActionResult } from '~/server/fn'
import { getPlannedMealPage, removePlannedMealFn, updatePlannedMealFn } from '~/server/planning.functions'

export const Route = createFileRoute('/_app/week/maaltijd/$mealId/')({
  loader: ({ params }) => getPlannedMealPage({ data: params }),
  head: () => ({ meta: [{ title: 'Geplande maaltijd · Gerechter' }] }),
  component: PlannedMealPage,
})
const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 6 })
function PlannedMealPage() {
  const result = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Geplande maaltijd" back="/week" backLabel="Terug naar week" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const item = result.data.item
  const recipe = item.recipe
  const minutes = recipe ? (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) : 0
  async function run(action: () => Promise<ActionResult<unknown>>) {
    setBusy(true)
    setError(null)
    try {
      const outcome = await action()
      if (!outcome.ok) setError(outcome.message)
    } catch {
      setError('Dat is niet gelukt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <DetailHeader
        title={dayTitle(item.date)}
        back="/week/dag/$date"
        backParams={{ date: item.date }}
        backLabel="Terug naar dagplanning"
      />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}
        <section aria-labelledby="meal-title" className="flex flex-col gap-3.5 rounded-[20px] bg-surface p-5">
          {recipe && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
          <h2
            id="meal-title"
            className="font-display text-[30px] leading-[1.1] font-bold tracking-tight break-words"
          >
            {item.title}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            {recipe ? (
              <>
                <span>
                  <strong className="text-ink">{item.effectiveServings}</strong> personen
                </span>
                {minutes > 0 && (
                  <span>
                    <strong className="text-ink">{minutes}</strong> min
                  </span>
                )}
              </>
            ) : (
              <span>Geen gerecht · vrije maaltijd</span>
            )}
          </div>
          {item.note && <p className="text-[15px] break-words whitespace-pre-wrap text-ink-2">{item.note}</p>}
          {recipe && (
            <Link
              to="/gerechten/$recipeId"
              params={{ recipeId: recipe.id }}
              search={{ servings: item.effectiveServings! }}
              className="flex min-h-11 items-center justify-between border-t border-line-soft pt-2.5 text-[15px] font-semibold text-tomato hover:text-tomato-dark"
            >
              Bekijk recept
              <ChevronRightIcon size={20} />
            </Link>
          )}
        </section>
        {recipe && (
          <>
            {recipe.archivedAt && (
              <Notice>Dit gerecht is gearchiveerd en blijft in je bestaande planning beschikbaar.</Notice>
            )}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface py-2 pr-2 pl-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">Personen</p>
                <p className="text-[13px] text-ink-3">
                  {item.servings === null
                    ? `Huishoudstandaard · recept is voor ${recipe.servings}`
                    : `Recept is voor ${recipe.servings}`}
                </p>
              </div>
              <Stepper
                value={item.effectiveServings!}
                label="personen"
                disabled={busy}
                onChange={(servings) =>
                  run(async () => {
                    const saved = await updatePlannedMealFn({
                      data: {
                        mealId: item.id,
                        input: {
                          kind: 'recipe',
                          date: item.date,
                          note: item.note,
                          recipeId: recipe.id,
                          servings,
                          version: item.version,
                        },
                      },
                    })
                    if (saved.ok) await router.invalidate()
                    return saved
                  })
                }
              />
            </div>
            <section className="flex flex-col gap-2.5" aria-label="Ingrediënten geplande maaltijd">
              <SectionTitle>Ingrediënten voor {item.effectiveServings} personen</SectionTitle>
              <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
                {recipe.ingredients.map((line, index) => (
                  <li
                    key={index}
                    className="flex items-baseline gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col break-words">
                      <span>{line.name}</span>
                      {line.note && <span className="text-[13px] text-ink-3">{line.note}</span>}
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums">
                      {line.scaledQuantity === null
                        ? 'Naar smaak'
                        : `${number.format(line.scaledQuantity)} ${line.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        <Button
          variant="danger"
          disabled={busy}
          className="self-start"
          onClick={() =>
            run(async () => {
              const removed = await removePlannedMealFn({ data: { mealId: item.id, version: item.version } })
              if (removed.ok) await navigate({ to: '/week/dag/$date', params: { date: item.date } })
              return removed
            })
          }
        >
          Uit planning verwijderen
        </Button>
        <ActionBar>
          {recipe && (
            <Link
              to="/gerechten/$recipeId/gemaakt"
              params={{ recipeId: recipe.id }}
              search={{ plannedMealId: item.id }}
              className={buttonClass('primary', 'min-h-13 text-base')}
            >
              <CheckIcon size={20} />
              Gemaakt
            </Link>
          )}
          <div className="flex gap-2.5">
            {recipe && (
              <Link
                to="/meer/boodschappen"
                search={{ kind: 'day', date: item.date }}
                className={buttonClass('secondary', 'flex-1 px-3')}
              >
                Op lijst zetten
              </Link>
            )}
            <Link
              to="/week/maaltijd/$mealId/bewerken"
              params={{ mealId: item.id }}
              className={buttonClass('secondary', 'flex-1 px-3')}
            >
              Wijzigen
            </Link>
          </div>
        </ActionBar>
      </Page>
    </>
  )
}
