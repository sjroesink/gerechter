import { useBlocker } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import type { PantryDetail } from '~/domain/pantry'
import type { ActionResult } from '~/server/fn'
import { setPantryFn } from '~/server/pantry.functions'
import { IngredientPicker } from './ingredient-picker'
import { ActionBar, Button, Field, Notice, Stepper } from './ui'

const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })

/** Leesbare hoeveelheid: grote aantallen gram en milliliter als kilo en liter. */
export function formatAmount(quantity: number, baseUnit: string) {
  if (baseUnit === 'g' && quantity >= 1000) return { value: number.format(quantity / 1000), unit: 'kg' }
  if (baseUnit === 'ml' && quantity >= 1000) return { value: number.format(quantity / 1000), unit: 'l' }
  if (baseUnit === 'stuk') return { value: number.format(quantity), unit: quantity === 1 ? 'stuk' : 'stuks' }
  return { value: number.format(quantity), unit: baseUnit }
}

export function amountLabel(quantity: number, baseUnit: string) {
  const { value, unit } = formatAmount(quantity, baseUnit)
  return `${value} ${unit}`
}

/** Basisvoorraad als schakelaar; het onzichtbare vinkje dekt het hele aanraakvlak. */
function StapleSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId()
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-line-soft pt-3">
      <span className="min-w-0 flex-1">
        <span id={`${id}-title`} className="block text-base font-semibold">
          Basisvoorraad
        </span>
        <span id={`${id}-hint`} className="block text-[13px] text-ink-3">
          Zoals zout of olie
        </span>
      </span>
      <span className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center">
        <input
          name="staple"
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-herb peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tomato peer-disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2 size-5 -translate-y-1/2 rounded-full bg-surface shadow-[0_1px_2px_rgba(24,32,27,0.25)] transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}

export function PantryForm({
  initial,
  saved,
}: {
  initial?: PantryDetail
  saved: (item: PantryDetail) => Promise<void>
}) {
  const [selected, setSelected] = useState(
    initial ? { id: initial.ingredientId, name: initial.name } : undefined,
  )
  const [item, setItem] = useState(initial)
  const [amount, setAmount] = useState(initial ? String(initial.quantity) : '')
  const [staple, setStaple] = useState(initial?.staple ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('count')
  const [note, setNote] = useState('')
  const [savedDraft, setSavedDraft] = useState({
    amount: initial ? String(initial.quantity) : '',
    staple: initial?.staple ?? false,
    reason: 'count',
    note: '',
  })
  const dirty =
    amount !== savedDraft.amount ||
    staple !== savedDraft.staple ||
    reason !== savedDraft.reason ||
    note !== savedDraft.note
  useBlocker({
    disabled: !initial || !dirty,
    enableBeforeUnload: dirty,
    shouldBlockFn: () =>
      !window.confirm('Niet-opgeslagen voorraadwijzigingen gaan verloren. Toch verdergaan?'),
  })
  const quantity = Number(amount) || 0
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!item) {
      setError('Kies eerst een ingrediënt.')
      return
    }
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const result: ActionResult<PantryDetail> = await setPantryFn({
        data: {
          ingredientId: item.ingredientId,
          quantity,
          unit: item.baseUnit,
          staple,
          version: item.version,
          reason: form.get('reason') === 'correction' ? 'correction' : 'count',
          note: String(form.get('note') ?? ''),
        },
      })
      if (result.ok) {
        setSavedDraft({ amount, staple, reason, note })
        await saved(result.data)
      } else setError(result.message)
    } catch {
      setError('Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setLoading(false)
    }
  }
  const display = item ? formatAmount(quantity, item.baseUnit) : null
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      {error && <Notice tone="error">{error}</Notice>}
      <fieldset disabled={loading} className="flex min-w-0 flex-1 flex-col gap-5">
        {!initial && (
          <div className="rounded-[20px] bg-surface p-5">
            <IngredientPicker
              selected={selected}
              choose={async (choice) => {
                setSelected(choice)
                setLoading(true)
                setError(null)
                setItem(undefined)
                try {
                  const { getPantryDetail } = await import('~/server/pantry.functions')
                  const result = await getPantryDetail({ data: { ingredientId: choice.id } })
                  if (result.ok) {
                    setItem(result.data.item)
                    setAmount(String(result.data.item.quantity))
                    setStaple(result.data.item.staple)
                  } else setError(result.message)
                } catch {
                  setError('Voorraad ophalen is niet gelukt. Probeer het ingrediënt opnieuw te kiezen.')
                } finally {
                  setLoading(false)
                }
              }}
            />
          </div>
        )}
        {item && display && (
          <>
            <section aria-label="Thuis" className="flex min-w-0 flex-col gap-4 rounded-[20px] bg-surface p-5">
              {staple ? (
                <p className="py-3 text-center text-[15px] text-ink-2">
                  Altijd in huis. Bij boodschappen telt dit ingrediënt als aanwezig; er wordt geen hoeveelheid
                  verzonnen.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-sm font-semibold text-ink-3">Thuis</span>
                  <Stepper
                    size="lg"
                    label={item.name}
                    value={quantity}
                    min={0}
                    max={1e12}
                    step={item.baseUnit === 'stuk' ? 1 : 50}
                    format={() => display.value}
                    onChange={(value) => setAmount(String(value))}
                  />
                  <span className="-mt-1 text-sm text-ink-3">{display.unit}</span>
                  <label className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ground py-1 pr-1 pl-4">
                    <span className="text-[15px] font-semibold">Hoeveelheid ({item.baseUnit})</span>
                    <input
                      name="quantity"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={1e12}
                      step="any"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="min-h-11 w-28 min-w-0 rounded-xl border border-line bg-surface px-3 text-right text-base text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
                    />
                  </label>
                  <p className="text-center text-[13px] text-ink-3">
                    Vul de volledige hoeveelheid in die je nu in huis hebt.
                  </p>
                </div>
              )}
              <StapleSwitch checked={staple} onChange={setStaple} />
            </section>
            <section
              aria-label="Over deze telling"
              className="flex flex-col gap-4 rounded-[20px] bg-surface p-5"
            >
              <label className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">Reden</span>
                <select
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink"
                >
                  <option value="count">Nieuwe telling</option>
                  <option value="correction">Correctie</option>
                </select>
              </label>
              <Field
                label="Notitie"
                name="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                placeholder="Bijvoorbeeld na boodschappen of opruimen"
              />
            </section>
          </>
        )}
        <ActionBar>
          <Button type="submit" disabled={!item}>
            {loading ? 'Opslaan…' : 'Voorraad opslaan'}
          </Button>
        </ActionBar>
      </fieldset>
    </form>
  )
}
