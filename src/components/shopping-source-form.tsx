import { useState } from 'react'
import { RecipePicker } from './recipe-picker'
import { Button, Field, SegmentGroup, Stepper, segmentClass } from './ui'

export type ShoppingSearch = {
  kind?: 'recipe' | 'day' | 'week'
  recipeId?: string
  servings?: number
  date?: string
}
const kinds = [
  { kind: 'week', label: 'Week' },
  { kind: 'day', label: 'Dag' },
  { kind: 'recipe', label: 'Gerecht' },
] as const
export function ShoppingSourceForm({
  initial,
  date,
  defaultServings,
  recipe,
  open,
}: {
  initial: ShoppingSearch
  date: string
  defaultServings: number
  recipe?: { id: string; name: string }
  open: (search: ShoppingSearch) => Promise<void>
}) {
  const [kind, setKind] = useState(initial.kind ?? 'week')
  const [selected, setSelected] = useState(recipe)
  const [picking, setPicking] = useState(!recipe)
  const [servings, setServings] = useState(initial.servings ?? defaultServings)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        if (kind === 'recipe' && !selected) return
        setBusy(true)
        try {
          await open(
            kind === 'recipe'
              ? { kind, recipeId: selected!.id, servings }
              : { kind, date: String(form.get('date')) },
          )
        } finally {
          setBusy(false)
        }
      }}
    >
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <SegmentGroup label="Boodschappen voor">
          {kinds.map((option) => (
            <button
              key={option.kind}
              type="button"
              aria-pressed={kind === option.kind}
              className={segmentClass(kind === option.kind)}
              onClick={() => setKind(option.kind)}
            >
              {option.label}
            </button>
          ))}
        </SegmentGroup>
        {kind === 'recipe' ? (
          <>
            {selected && !picking ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 font-semibold break-words">{selected.name}</span>
                <Button variant="ghost" className="px-1" onClick={() => setPicking(true)}>
                  Ander gerecht
                </Button>
              </div>
            ) : (
              <RecipePicker
                choose={(choice) => {
                  setSelected(choice)
                  setPicking(false)
                }}
              />
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold">Personen</span>
              <Stepper value={servings} label="personen" onChange={setServings} />
            </div>
          </>
        ) : (
          <Field
            label={kind === 'week' ? 'Datum in de week' : 'Geplande datum'}
            name="date"
            type="date"
            required
            defaultValue={initial.date ?? date}
          />
        )}
        <Button type="submit" variant="secondary" disabled={kind === 'recipe' && !selected}>
          {busy ? 'Berekenen…' : 'Behoefte berekenen'}
        </Button>
      </fieldset>
    </form>
  )
}
