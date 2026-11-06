import { Link } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import type { RecipeDetail, RecipeInput } from '~/domain/recipes'
import { INSTRUCTION_SECTIONS, type InstructionSection } from '~/domain/instructions'
import { UNITS, type Unit } from '~/domain/units'
import type { ActionResult } from '~/server/fn'
import { IngredientPicker } from './ingredient-picker'
import { InstructionEditor, recipeAreaClass, recipeInputClass } from './instruction-editor'
import { ActionBar, Button, Field, Notice, SectionTitle, buttonClass } from './ui'

type LineDraft = {
  key: number
  ingredientId: string
  name: string
  quantity: string
  unit: Unit
  note: string
}

export function RecipeForm({
  initial,
  save,
}: {
  initial?: RecipeDetail
  save: (input: RecipeInput) => Promise<ActionResult<unknown>>
}) {
  const nextKey = useRef(1000)
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial
      ? initial.ingredients.map((line, index) => ({
          key: index,
          ingredientId: line.ingredientId,
          name: line.name,
          quantity: line.quantity === null ? '' : String(line.quantity),
          unit: line.unit,
          note: line.note,
        }))
      : [{ key: 0, ingredientId: '', name: '', quantity: '', unit: 'g', note: '' }],
  )
  const [sections, setSections] = useState<InstructionSection[]>(initial?.sections ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (lines.some((line) => !line.ingredientId)) {
      setError('Kies voor elke regel een ingrediënt uit de catalogus.')
      return
    }
    const form = new FormData(event.currentTarget)
    const optionalNumber = (name: string) =>
      String(form.get(name) ?? '').trim() ? Number(form.get(name)) : null
    const optionalUrl = (name: string) => String(form.get(name) ?? '').trim() || null
    const data: RecipeInput = {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      servings: Number(form.get('servings')),
      prepMinutes: optionalNumber('prepMinutes'),
      cookMinutes: optionalNumber('cookMinutes'),
      sourceUrl: optionalUrl('sourceUrl'),
      photoUrl: optionalUrl('photoUrl'),
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      ingredients: lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity.trim() ? Number(line.quantity) : null,
        unit: line.unit,
        note: line.note,
      })),
      sections: sections.filter((section) => section.text.trim() || section.openUi),
    }
    setBusy(true)
    try {
      const result = await save(data)
      if (!result.ok) setError(result.message)
    } catch {
      setError('Opslaan is niet gelukt. Controleer de verbinding en probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-4">
        <legend className="px-1 text-[17px] font-bold">Over het gerecht</legend>
        <Field
          label="Naam van het gerecht"
          name="name"
          required
          maxLength={160}
          defaultValue={initial?.name}
        />
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Beschrijving</span>
          <textarea
            name="description"
            defaultValue={initial?.description}
            maxLength={5000}
            className={recipeAreaClass}
          />
        </label>
        <Field
          label="Porties"
          name="servings"
          type="number"
          min={1}
          max={1000}
          step={1}
          required
          defaultValue={initial?.servings ?? 2}
        />
        <Field
          label="Voorbereiding (minuten)"
          name="prepMinutes"
          type="number"
          min={0}
          max={10080}
          step={1}
          defaultValue={initial?.prepMinutes ?? ''}
        />
        <Field
          label="Bereiding (minuten)"
          name="cookMinutes"
          type="number"
          min={0}
          max={10080}
          step={1}
          defaultValue={initial?.cookMinutes ?? ''}
        />
        <Field
          label="Tags"
          name="tags"
          maxLength={1800}
          defaultValue={initial?.tags.join(', ')}
          hint="Gescheiden door komma’s, bijvoorbeeld vegetarisch, snel."
        />
        <Field
          label="Bron (URL)"
          name="sourceUrl"
          type="url"
          maxLength={2000}
          defaultValue={initial?.sourceUrl ?? ''}
          placeholder="https://…"
        />
        <Field
          label="Foto (URL)"
          name="photoUrl"
          type="url"
          maxLength={2000}
          defaultValue={initial?.photoUrl ?? ''}
          placeholder="https://…"
        />
      </fieldset>
      <section className="flex flex-col gap-3" aria-label="Ingrediënten bewerken">
        <SectionTitle>Ingrediënten</SectionTitle>
        {lines.map((line, index) => (
          <fieldset
            key={line.key}
            disabled={busy}
            className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4"
          >
            <legend className="px-1 text-[15px] font-bold">Ingrediënt {index + 1}</legend>
            <IngredientPicker
              selected={line.ingredientId ? { id: line.ingredientId, name: line.name } : undefined}
              choose={(choice) => updateLine(line.key, { ingredientId: choice.id, name: choice.name })}
            />
            <label className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Hoeveelheid</span>
              <input
                type="number"
                min="0.000000001"
                max={1e9}
                step="any"
                value={line.quantity}
                onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                placeholder="Leeg = naar smaak"
                className={recipeInputClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Eenheid</span>
              <select
                value={line.unit}
                onChange={(event) => updateLine(line.key, { unit: event.target.value as Unit })}
                className={recipeInputClass}
              >
                {UNITS.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Notitie bij ingrediënt</span>
              <input
                value={line.note}
                onChange={(event) => updateLine(line.key, { note: event.target.value })}
                maxLength={500}
                className={recipeInputClass}
                placeholder="Bijvoorbeeld fijngesneden"
              />
            </label>
            {lines.length > 1 && (
              <Button
                variant="danger"
                aria-label={`Verwijder ingrediënt ${index + 1}`}
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              >
                Regel verwijderen
              </Button>
            )}
          </fieldset>
        ))}
        <Button
          variant="secondary"
          disabled={busy || lines.length >= 200}
          onClick={() =>
            setLines((current) => [
              ...current,
              { key: nextKey.current++, ingredientId: '', name: '', quantity: '', unit: 'g', note: '' },
            ])
          }
        >
          Ingrediëntregel toevoegen
        </Button>
        <Link to="/meer/ingredienten/nieuw" target="_blank" className={buttonClass('ghost')}>
          Nieuw ingrediënt toevoegen (nieuw tabblad)
        </Link>
      </section>
      <section className="flex flex-col gap-3" aria-label="Instructies bewerken">
        <SectionTitle>Instructies</SectionTitle>
        {INSTRUCTION_SECTIONS.map(({ id, label }) => (
          <InstructionEditor
            key={id}
            label={label}
            disabled={busy}
            initial={initial?.sections.find((section) => section.id === id) ?? { id, text: '', openUi: '' }}
            change={(next) =>
              setSections((current) => [...current.filter((section) => section.id !== next.id), next])
            }
          />
        ))}
      </section>
      <ActionBar>
        <Button type="submit" disabled={busy}>
          {busy ? 'Opslaan…' : 'Gerecht opslaan'}
        </Button>
      </ActionBar>
    </form>
  )
}
