import { useState, type FormEvent } from 'react'
import type { PlannedMealDetail, PlannedMealInput } from '~/domain/planning'
import type { ActionResult } from '~/server/fn'
import { PlusIcon } from './icons'
import { RecipePicker } from './recipe-picker'
import { ActionBar, Button, Field, Notice, SectionTitle, Stepper, chipClass, cx } from './ui'

const presets = ['Bestellen', 'Uit eten', 'Restjes']

export function PlannedMealForm({
  initial,
  date,
  defaultServings,
  selectedRecipe,
  save,
}: {
  initial?: PlannedMealDetail
  date: string
  defaultServings: number
  selectedRecipe?: { id: string; name: string }
  save: (input: PlannedMealInput) => Promise<ActionResult<unknown>>
}) {
  const [kind, setKind] = useState<'recipe' | 'free' | null>(
    initial?.kind ?? (selectedRecipe ? 'recipe' : null),
  )
  const [recipe, setRecipe] = useState(
    initial?.recipeId ? { id: initial.recipeId, name: initial.title } : selectedRecipe,
  )
  const [title, setTitle] = useState(initial?.kind === 'free' ? initial.title : '')
  const [servings, setServings] = useState<number | null>(initial?.servings ?? null)
  const [picking, setPicking] = useState(kind === null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function chooseFree(text: string) {
    setKind('free')
    setTitle(text)
    setPicking(false)
    if (!text) requestAnimationFrame(() => document.getElementById('planned-meal-title')?.focus())
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (kind === null || (kind === 'recipe' && !recipe)) {
      setError('Kies een gerecht of iets als Restjes of Bestellen.')
      return
    }
    const form = new FormData(event.currentTarget)
    const common = { date: String(form.get('date')), note: String(form.get('note') ?? '') }
    const input: PlannedMealInput =
      kind === 'recipe' ? { ...common, kind, recipeId: recipe!.id, servings } : { ...common, kind, title }
    setBusy(true)
    try {
      const result = await save(input)
      if (!result.ok) setError(result.message)
    } catch {
      setError('Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error && <Notice tone="error">{error}</Notice>}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
        {picking ? (
          <RecipePicker
            choose={(choice) => {
              setKind('recipe')
              setRecipe(choice)
              setPicking(false)
            }}
          >
            <section className="flex flex-col gap-2.5" aria-label="Geen gerecht">
              <SectionTitle>Geen gerecht</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={cx(chipClass(false), 'px-4 text-[15px] font-medium italic')}
                    onClick={() => chooseFree(preset)}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-line px-4 text-[15px] font-medium text-ink-2 transition-colors hover:bg-surface"
                  onClick={() => chooseFree('')}
                >
                  <PlusIcon size={16} />
                  Eigen tekst
                </button>
              </div>
            </section>
            {kind !== null && (
              <Button variant="ghost" className="self-start px-1" onClick={() => setPicking(false)}>
                Huidige keuze houden
              </Button>
            )}
          </RecipePicker>
        ) : (
          <section aria-label="Gekozen maaltijd" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            {kind === 'recipe' ? (
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] text-ink-3">Gerecht</span>
                <span className="text-[17px] font-semibold break-words">{recipe?.name}</span>
              </div>
            ) : (
              <Field
                id="planned-meal-title"
                label="Vrije maaltijd"
                name="title"
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Bijvoorbeeld Restjes of Bestellen"
              />
            )}
            <Button variant="secondary" className="self-start" onClick={() => setPicking(true)}>
              Iets anders kiezen
            </Button>
          </section>
        )}
        <section className="flex flex-col gap-2.5" aria-label="Details">
          <SectionTitle>Details</SectionTitle>
          <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
            <Field label="Datum" name="date" type="date" required defaultValue={initial?.date ?? date} />
            {kind === 'recipe' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">Personen</p>
                    <p className="text-[13px] text-ink-3">
                      {servings === null
                        ? `Huishoudstandaard (${defaultServings})`
                        : 'Vast aantal voor deze maaltijd'}
                    </p>
                  </div>
                  <Stepper value={servings ?? defaultServings} label="personen" onChange={setServings} />
                </div>
                {servings !== null && (
                  <Button variant="ghost" className="self-start px-1" onClick={() => setServings(null)}>
                    Huishoudstandaard gebruiken
                  </Button>
                )}
              </div>
            )}
            <label className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Notitie bij maaltijd</span>
              <textarea
                name="note"
                defaultValue={initial?.note}
                maxLength={2000}
                className="min-h-24 rounded-2xl border border-line bg-surface p-3 text-base text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
              />
            </label>
          </div>
        </section>
        <ActionBar>
          <Button type="submit" className="min-h-13 text-base">
            {busy ? 'Opslaan…' : 'Maaltijd opslaan'}
          </Button>
        </ActionBar>
      </fieldset>
    </form>
  )
}
