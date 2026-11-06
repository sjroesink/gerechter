import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AhProductPicker, AhProductSummary } from '~/components/ah-product-picker'
import { IngredientForm } from '~/components/ingredient-form'
import { IngredientHeader } from '~/components/ingredient-header'
import { IngredientPhoto } from '~/components/ingredient-photo'
import { Button, DetailHeader, Field, Notice, Page, SectionTitle } from '~/components/ui'
import { measurementUnit, UNITS } from '~/domain/units'
import { unlinkAhProductFn } from '~/server/ah-products.functions'
import type { ActionResult } from '~/server/fn'
import {
  archiveIngredientFn,
  getIngredientPage,
  removeConversionFn,
  setConversionFn,
  updateIngredientFn,
} from '~/server/catalog.functions'

export const Route = createFileRoute('/_app/meer/ingredienten/$ingredientId')({
  loader: ({ params }) => getIngredientPage({ data: params }),
  head: () => ({ meta: [{ title: 'Ingrediënt · Gerechter' }] }),
  component: IngredientPage,
})

const numbers = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 10 })

function IngredientPage() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pickingAh, setPickingAh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function run(action: () => Promise<ActionResult<unknown>>) {
    setBusy(true)
    setError(null)
    try {
      const res = await action()
      if (res.ok) await router.invalidate()
      else setError(res.message)
      return res
    } finally {
      setBusy(false)
    }
  }
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Ingrediënt" back="/meer/ingredienten" backLabel="Terug naar ingrediënten" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const item = result.data
  const base = measurementUnit(item.baseUnit)
  const conversionUnits = UNITS.filter(
    (unit) =>
      unit.dimension !== 'vague' &&
      unit.id !== item.baseUnit &&
      (unit.factor === null || unit.dimension !== base.dimension),
  )
  async function addConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const res = await run(() =>
      setConversionFn({
        data: {
          ingredientId: item.id,
          unit: String(data.get('unit')) as (typeof UNITS)[number]['id'],
          factor: Number(data.get('factor')),
        },
      }),
    )
    if (res.ok) form.reset()
  }
  return (
    <>
      <IngredientHeader
        name={item.name}
        photo={item.photo}
        subtitle={item.scope === 'global' ? 'Globale catalogus' : 'Eigen ingrediënt van je huishouden'}
        back="/meer/ingredienten"
        backLabel="Terug naar ingrediënten"
      />
      <Page className="lg:max-w-2xl">
        {error && <Notice tone="error">{error}</Notice>}
        {item.archivedAt && (
          <Notice>Dit ingrediënt is gearchiveerd. Bestaande gerechten blijven het gebruiken.</Notice>
        )}
        <dl className="flex flex-col overflow-hidden rounded-2xl bg-surface">
          <div className="flex min-h-15 flex-col justify-center border-b border-line-soft px-4 py-2 last:border-b-0">
            <dt className="text-base font-semibold">Eenheid</dt>
            <dd className="text-[13px] text-ink-3">Basiseenheid: {base.label}</dd>
          </div>
          {item.aliases.length > 0 && (
            <div className="flex min-h-15 flex-col justify-center border-b border-line-soft px-4 py-2 last:border-b-0">
              <dt className="text-base font-semibold">Ook bekend als</dt>
              <dd className="text-[13px] break-words text-ink-3">{item.aliases.join(', ')}</dd>
            </div>
          )}
        </dl>
        <IngredientPhoto photo={item.photo} name={item.name} />
        {item.canManage && (
          <>
            <Button variant="secondary" onClick={() => setEditing(!editing)}>
              {editing ? 'Wijzigen sluiten' : 'Gegevens wijzigen'}
            </Button>
            {editing && (
              <IngredientForm
                initial={item}
                save={async ({ name, aliases, photo }) => {
                  const res = await run(() =>
                    updateIngredientFn({
                      data: { ingredientId: item.id, name, aliases: aliases ?? [], photo },
                    }),
                  )
                  if (res.ok) setEditing(false)
                  return res
                }}
              />
            )}
          </>
        )}
        {item.ah && (
          <section className="flex flex-col gap-3" aria-label="AH-product">
            <SectionTitle>AH-product</SectionTitle>
            <p className="px-1 text-[15px] text-ink-2">
              Met een gekoppeld product zet een AH-export dit product met het juiste aantal op je lijst, in
              plaats van een tekstregel. Geldt alleen voor je eigen huishouden.
            </p>
            {item.ah.link && !pickingAh && (
              <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
                <AhProductSummary link={item.ah.link} baseUnit={item.baseUnit} />
                <div className="flex flex-wrap gap-2">
                  {item.ah.connected && (
                    <Button variant="secondary" disabled={busy} onClick={() => setPickingAh(true)}>
                      Ander product
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => run(() => unlinkAhProductFn({ data: { ingredientId: item.id } }))}
                  >
                    Ontkoppelen
                  </Button>
                </div>
              </div>
            )}
            {!item.ah.link && !pickingAh && item.ah.connected && (
              <Button variant="secondary" onClick={() => setPickingAh(true)}>
                AH-product koppelen
              </Button>
            )}
            {!item.ah.connected && (
              <Notice>
                Laat een eigenaar eerst AH koppelen bij Boodschappen › Verbindingen om te zoeken.
              </Notice>
            )}
            {pickingAh && (
              <AhProductPicker
                ingredientId={item.id}
                ingredientName={item.name}
                baseUnit={item.baseUnit}
                onCancel={() => setPickingAh(false)}
                onSaved={async () => {
                  setPickingAh(false)
                  await router.invalidate()
                }}
              />
            )}
          </section>
        )}
        <section className="flex flex-col gap-3">
          <SectionTitle>Omrekeningen</SectionTitle>
          <p className="px-1 text-[15px] text-ink-2">
            Massa en volume rekenen automatisch om. Leg hier bijvoorbeeld het gewicht van een blik vast. Een
            snuf of handje blijft een schatting.
          </p>
          {item.conversions.length === 0 ? (
            <Notice>Nog geen eigen omrekeningen.</Notice>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {item.conversions.map((conversion) => (
                <li
                  key={conversion.unit}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-1 last:border-b-0"
                >
                  <span>
                    1 {conversion.unit} = {numbers.format(conversion.factor)} {item.baseUnit}
                  </span>
                  {item.canManage && (
                    <Button
                      disabled={busy}
                      variant="ghost"
                      onClick={() =>
                        run(() =>
                          removeConversionFn({ data: { ingredientId: item.id, unit: conversion.unit } }),
                        )
                      }
                    >
                      Verwijderen
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {item.canManage && (
            <form onSubmit={addConversion} className="flex flex-col gap-4 rounded-[20px] bg-surface p-5">
              <label className="flex flex-col gap-2">
                <span className="font-semibold">Eenheid omrekenen</span>
                <select
                  name="unit"
                  className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink"
                >
                  {conversionUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label={`Hoeveelheid in ${base.label}`}
                name="factor"
                type="number"
                min="0.000000001"
                max="1000000000"
                step="any"
                required
                hint="Hoeveel is één van de gekozen eenheid?"
              />
              <Button type="submit" disabled={busy}>
                Omrekening opslaan
              </Button>
            </form>
          )}
        </section>
        {item.canManage && (
          <Button
            variant={item.archivedAt ? 'secondary' : 'danger'}
            disabled={busy}
            onClick={() =>
              run(() => archiveIngredientFn({ data: { ingredientId: item.id, archived: !item.archivedAt } }))
            }
          >
            {item.archivedAt ? 'Herstellen' : 'Archiveren'}
          </Button>
        )}
      </Page>
    </>
  )
}
