import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronRightIcon } from '~/components/icons'
import { IngredientHeader } from '~/components/ingredient-header'
import { AhProductSummary } from '~/components/ah-product-picker'
import { PantryForm } from '~/components/pantry-form'
import { Button, DetailHeader, Notice, Page, SectionTitle } from '~/components/ui'
import { measurementUnit } from '~/domain/units'
import { getPantryDetail, removePantryFn } from '~/server/pantry.functions'

export const Route = createFileRoute('/_app/voorraad/$ingredientId')({
  loader: ({ params }) => getPantryDetail({ data: params }),
  head: () => ({ meta: [{ title: 'Voorraad bijwerken · Gerechter' }] }),
  component: PantryDetail,
})
const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
const date = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })
const reasons = { count: 'Telling', correction: 'Correctie', removed: 'Verwijderd', cooked: 'Gemaakt' }
function PantryDetail() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Voorraad" back="/voorraad" backLabel="Terug naar voorraad" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const { item, ingredient, history } = result.data
  const unitDetail = [
    measurementUnit(item.baseUnit).label,
    ...ingredient.conversions.map(
      (conversion) => `1 ${conversion.unit} ≈ ${number.format(conversion.factor)} ${item.baseUnit}`,
    ),
  ].join(' · ')
  return (
    <>
      <IngredientHeader
        name={item.name}
        photo={item.photo}
        subtitle={ingredient.scope === 'global' ? 'Uit de gedeelde catalogus' : 'Eigen ingrediënt'}
        back="/voorraad"
        backLabel="Terug naar voorraad"
      />
      <Page className="lg:max-w-2xl">
        {error && <Notice tone="error">{error}</Notice>}
        {item.archived && (
          <Notice>Dit ingrediënt is gearchiveerd. Je kunt bestaande voorraad nog corrigeren.</Notice>
        )}
        {item.version > 0 && item.quantity === 0 && !item.staple && (
          <Notice>Deze regel staat niet meer in je actieve voorraad. De historie blijft bewaard.</Notice>
        )}
        <PantryForm
          key={`${item.ingredientId}-${item.version}`}
          initial={item}
          saved={async () => {
            await router.invalidate()
          }}
        />
        <nav aria-label="Details" className="flex flex-col overflow-hidden rounded-2xl bg-surface">
          <Link
            to="/meer/ingredienten/$ingredientId"
            params={{ ingredientId: item.ingredientId }}
            className="flex min-h-15 items-center justify-between gap-3 border-b border-line-soft px-4 py-2 font-semibold hover:bg-ground"
          >
            Ingrediënt bekijken
            <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
          </Link>
          {[
            { title: 'Eenheid', detail: unitDetail },
            ...(ingredient.aliases.length > 0
              ? [{ title: 'Ook bekend als', detail: ingredient.aliases.join(', ') }]
              : []),
          ].map((row) => (
            <Link
              key={row.title}
              to="/meer/ingredienten/$ingredientId"
              params={{ ingredientId: item.ingredientId }}
              className="flex min-h-15 items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0 hover:bg-ground"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{row.title}</span>
                <span className="block text-[13px] break-words text-ink-3">{row.detail}</span>
              </span>
              <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
            </Link>
          ))}
        </nav>
        <section aria-label="AH-product" className="flex flex-col gap-3">
          <SectionTitle>AH-product</SectionTitle>
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            {result.data.ahProduct ? (
              <AhProductSummary link={result.data.ahProduct} baseUnit={item.baseUnit} />
            ) : (
              <p className="text-[15px] text-ink-2">Nog geen AH-product gekoppeld.</p>
            )}
            <Link
              to="/meer/ingredienten/$ingredientId"
              params={{ ingredientId: item.ingredientId }}
              hash="ah-product"
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 font-semibold hover:bg-ground"
            >
              {result.data.ahProduct ? 'AH-product bekijken of wijzigen' : 'AH-product koppelen'}
              <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
            </Link>
            <p className="text-[13px] text-ink-3">
              Alleen voor je huishouden. Beheer de koppeling op de ingrediëntpagina; je voorraad blijft
              gelijk.
            </p>
          </div>
        </section>
        {item.version > 0 && (item.quantity > 0 || item.staple) && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                const removed = await removePantryFn({
                  data: { ingredientId: item.ingredientId, version: item.version },
                })
                if (removed.ok) await router.invalidate()
                else setError(removed.message)
              } finally {
                setBusy(false)
              }
            }}
          >
            Uit voorraad verwijderen
          </Button>
        )}
        <section className="flex flex-col gap-3" aria-label="Voorraadgeschiedenis">
          <SectionTitle>Laatste mutaties</SectionTitle>
          {history.length === 0 ? (
            <p className="px-1 text-[15px] text-ink-2">Nog geen tellingen voor dit ingrediënt.</p>
          ) : (
            <ol className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 border-b border-line-soft px-4 py-3 last:border-b-0"
                >
                  <span className="font-semibold">
                    {reasons[entry.kind]} · {number.format(entry.previousQuantity)} →{' '}
                    {number.format(entry.quantity)} {item.baseUnit}
                  </span>
                  <span className="text-[13px] text-ink-3">
                    Basisvoorraad: {entry.previousStaple ? 'aan' : 'uit'} → {entry.staple ? 'aan' : 'uit'}
                  </span>
                  {entry.note && <p className="text-[15px] whitespace-pre-wrap break-words">{entry.note}</p>}
                  <span className="text-[13px] text-ink-3">
                    {entry.actorName ?? 'Voormalig lid'} · {date.format(new Date(entry.createdAt))}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </Page>
    </>
  )
}
