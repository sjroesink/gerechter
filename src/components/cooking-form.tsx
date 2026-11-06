import { useState, type FormEvent } from 'react'
import type { CookingPreparation } from '~/domain/cooking'
import { formatCalendarDay } from '~/domain/calendar'
import { recordMadeFn } from '~/server/cooking.functions'
import { CheckIcon, CloseIcon, InfoIcon } from './icons'
import { GradePicker, noteClass } from './made-rating-form'
import { ActionBar, Button, Field, Notice, buttonClass, iconButtonClass } from './ui'

const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
const stepButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-lg text-ink hover:bg-ground disabled:opacity-40'

type Line = CookingPreparation['deductions'][number]
const stepFor = (line: Line) =>
  line.baseUnit === 'stuk' ? 1 : (line.required ?? line.available) >= 200 ? 50 : 10

export function CookingForm({
  preparation,
  saved,
  refresh,
}: {
  preparation: CookingPreparation
  saved: (id: string) => Promise<void>
  refresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(preparation.deductions.map((line) => [line.ingredientId, String(line.proposed)])),
  )
  const [skipped, setSkipped] = useState<string[]>([])
  const visible = preparation.deductions.filter((line) => !skipped.includes(line.ingredientId))
  function setQuantity(id: string, value: string) {
    setQuantities((current) => ({ ...current, [id]: value }))
  }
  function adjust(line: Line, direction: 1 | -1) {
    const current = Number(quantities[line.ingredientId]) || 0
    const step = stepFor(line)
    const next =
      direction === 1 ? Math.floor(current / step + 1) * step : Math.ceil(current / step - 1) * step
    setQuantity(line.ingredientId, String(Math.min(line.available, Math.max(0, next))))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const result = await recordMadeFn({
        data: {
          requestId: preparation.requestId,
          recipeId: preparation.recipeId,
          recipeVersion: preparation.recipeVersion,
          plannedMealId: preparation.plannedMealId,
          plannedMealVersion: preparation.plannedMealVersion,
          servings: preparation.servings,
          date: String(form.get('date')),
          rating: { score, note: String(form.get('ratingNote') ?? '') },
          deductions: preparation.deductions.map((line) => ({
            ingredientId: line.ingredientId,
            pantryVersion: line.pantryVersion,
            quantity: skipped.includes(line.ingredientId) ? 0 : Number(quantities[line.ingredientId]),
          })),
        },
      })
      if (result.ok) await saved(result.data.id)
      else setError(result.message)
    } catch {
      setError(
        'Bevestigen is niet gelukt. Probeer dezelfde bevestiging opnieuw; die wordt maar één keer verwerkt.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}
      {error && (
        <Button variant="secondary" disabled={busy} onClick={refresh}>
          Actueel voorstel ophalen
        </Button>
      )}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
        <div className="px-1">
          <p className="text-[15px] text-ink-3">
            {preparation.name} · <span className="capitalize">{formatCalendarDay(preparation.date)}</span>
          </p>
          <h2 className="mt-1 font-display text-[32px] leading-tight font-bold tracking-tight">
            Hoe was het?
          </h2>
        </div>
        <GradePicker legend="Jouw cijfer" value={score} onChange={setScore} />
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">
            Notitie <span className="font-normal text-ink-3">(optioneel)</span>
          </span>
          <textarea
            name="ratingNote"
            maxLength={2000}
            rows={4}
            placeholder="Wat zou je de volgende keer anders doen?"
            className={noteClass}
          />
        </label>
        <Field label="Gemaakt op" name="date" type="date" required defaultValue={preparation.date} />
        <p className="px-1 text-[13px] text-ink-3">
          Andere leden van je huishouden kunnen later hun eigen cijfer en notitie toevoegen.
        </p>
      </fieldset>
      <section aria-labelledby="afboeken-titel" className="flex flex-col gap-4">
        <div className="px-1">
          <h2 id="afboeken-titel" className="font-display text-[32px] leading-tight font-bold tracking-tight">
            Van voorraad af
          </h2>
          <p className="mt-1.5 text-[15px] text-ink-2">
            Voor {preparation.servings} {preparation.servings === 1 ? 'persoon' : 'personen'}. Pas aan wat je
            echt gebruikt hebt.
          </p>
        </div>
        {visible.length > 0 && (
          <ul className="flex flex-col gap-2">
            {visible.map((line) => {
              const value = Number(quantities[line.ingredientId]) || 0
              return (
                <li key={line.ingredientId}>
                  <fieldset
                    disabled={busy}
                    className="flex min-h-16 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface py-2 pr-2 pl-4"
                  >
                    <legend className="sr-only">{line.name}</legend>
                    <div className="min-w-[8rem] flex-1">
                      <div className="font-semibold break-words">{line.name}</div>
                      <div className="text-[13px] text-ink-3">
                        Thuis {number.format(line.available)} {line.baseUnit} →{' '}
                        {number.format(Math.max(0, line.available - value))} {line.baseUnit}
                        {line.staple ? ' · basisvoorraad' : ''}
                      </div>
                      <div className="text-[13px] text-ink-3">
                        {line.required === null
                          ? 'Exact benodigd: onbekend'
                          : `Volgens het recept: ${number.format(line.required)} ${line.baseUnit}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Minder ${line.name}`}
                        className={stepButton}
                        disabled={value <= 0}
                        onClick={() => adjust(line, -1)}
                      >
                        −
                      </button>
                      <input
                        aria-label={`${line.name} afboeken (${line.baseUnit})`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={line.available}
                        step="any"
                        required
                        value={quantities[line.ingredientId]}
                        onChange={(event) => setQuantity(line.ingredientId, event.target.value)}
                        className="h-11 w-16 min-w-0 rounded-xl border border-line bg-surface px-1 text-center text-[15px] font-bold text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
                      />
                      <span className="w-6 text-[13px] text-ink-3">{line.baseUnit}</span>
                      <button
                        type="button"
                        aria-label={`Meer ${line.name}`}
                        className={stepButton}
                        disabled={value >= line.available}
                        onClick={() => adjust(line, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`${line.name} niet afboeken`}
                        className={iconButtonClass('plain')}
                        onClick={() => setSkipped((current) => [...current, line.ingredientId])}
                      >
                        <CloseIcon size={20} />
                      </button>
                    </div>
                    {line.explanation && (
                      <p className="basis-full pr-2 text-[13px] text-amber-ink">{line.explanation}</p>
                    )}
                  </fieldset>
                </li>
              )
            })}
          </ul>
        )}
        {skipped.length > 0 && (
          <button
            type="button"
            className={buttonClass('ghost', 'self-start px-1')}
            onClick={() => setSkipped([])}
          >
            {skipped.length === 1
              ? '1 overgeslagen ingrediënt terugzetten'
              : `${skipped.length} overgeslagen ingrediënten terugzetten`}
          </button>
        )}
        <div className="flex items-start gap-2.5 rounded-2xl bg-line-soft px-4 py-3 text-sm text-ink-2">
          <InfoIcon size={18} className="mt-px shrink-0" />
          <p>
            Overgeslagen ingrediënten en hoeveelheden op 0 worden niet afgeboekt. Zonder exacte hoeveelheid
            stellen we geen afboeking voor; basisvoorraad levert geen extra getelde hoeveelheid.
          </p>
        </div>
        <p className="px-1 text-[13px] text-ink-3">
          Met opslaan bewaar je deze bereiding, jouw beoordeling en precies deze voorraadafboekingen samen.
        </p>
      </section>
      <ActionBar>
        <Button type="submit" disabled={busy}>
          <CheckIcon size={20} />
          {busy ? 'Opslaan…' : 'Opslaan'}
        </Button>
      </ActionBar>
    </form>
  )
}
