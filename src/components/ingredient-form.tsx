import { useState, type FormEvent } from 'react'
import type { IngredientInput } from '~/domain/catalog'
import type { IngredientPhoto } from '~/domain/ingredient-photo'
import { BASE_UNITS, measurementUnit } from '~/domain/units'
import type { ActionResult } from '~/server/fn'
import { Button, Field, Notice } from './ui'

type IngredientFields = {
  name: string
  aliases: string[]
  baseUnit: IngredientInput['baseUnit']
  photo?: IngredientPhoto | null
}
export function IngredientForm({
  initial,
  canCreateGlobal,
  save,
}: {
  initial?: IngredientFields
  canCreateGlobal?: boolean
  save: (input: IngredientInput) => Promise<ActionResult<unknown>>
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await save({
        name: String(form.get('name') ?? ''),
        aliases: String(form.get('aliases') ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        baseUnit: initial?.baseUnit ?? (String(form.get('baseUnit')) as IngredientInput['baseUnit']),
        scope: form.get('scope') === 'global' ? 'global' : 'household',
        photo: String(form.get('photoUrl') ?? '').trim()
          ? {
              url: String(form.get('photoUrl')).trim(),
              sourceUrl: String(form.get('photoSourceUrl') ?? '').trim() || null,
              credit: String(form.get('photoCredit') ?? '').trim() || null,
              licenseUrl: String(form.get('photoLicenseUrl') ?? '').trim() || null,
            }
          : null,
      })
      if (!result.ok) setError(result.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[20px] bg-surface p-5">
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Naam" name="name" maxLength={160} required defaultValue={initial?.name} />
      <Field
        label="Andere namen"
        name="aliases"
        defaultValue={initial?.aliases.join(', ')}
        hint="Gescheiden door komma’s, bijvoorbeeld paprika, rode peper."
      />
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Basiseenheid</span>
        <select
          name="baseUnit"
          defaultValue={initial?.baseUnit ?? 'g'}
          disabled={Boolean(initial)}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink disabled:bg-ground disabled:text-ink-3"
        >
          {BASE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {measurementUnit(unit).label}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-ink-3">De basiseenheid blijft na aanmaken vast.</span>
      </label>
      {!initial && canCreateGlobal && (
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Beschikbaar voor</span>
          <select
            name="scope"
            defaultValue="household"
            className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink disabled:bg-ground disabled:text-ink-3"
          >
            <option value="household">Mijn huishouden</option>
            <option value="global">Alle huishoudens (globaal)</option>
          </select>
        </label>
      )}
      <details open={Boolean(initial?.photo)} className="rounded-2xl border border-line px-4 py-1">
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold">
          Afbeelding (optioneel)
        </summary>
        <div className="flex flex-col gap-4 pt-2 pb-4">
          <Field
            label="Foto-URL"
            name="photoUrl"
            type="url"
            maxLength={2000}
            defaultValue={initial?.photo?.url}
            hint="Een directe link naar de afbeelding. Maak dit veld leeg om de foto te verwijderen."
          />
          <Field
            label="Bronpagina van de foto"
            name="photoSourceUrl"
            type="url"
            maxLength={2000}
            defaultValue={initial?.photo?.sourceUrl ?? ''}
          />
          <Field
            label="Fotograaf / bron"
            name="photoCredit"
            maxLength={300}
            defaultValue={initial?.photo?.credit ?? ''}
          />
          <Field
            label="Licentie- of voorwaarden-URL"
            name="photoLicenseUrl"
            type="url"
            maxLength={2000}
            defaultValue={initial?.photo?.licenseUrl ?? ''}
          />
        </div>
      </details>
      <Button type="submit" disabled={busy}>
        {busy ? 'Opslaan…' : 'Opslaan'}
      </Button>
    </form>
  )
}
