import { useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { setMyMadeRatingFn } from '~/server/cooking.functions'
import { Button, Notice, SectionTitle, cx } from './ui'

/** Cijfer 1–10 als raster van knoppen; nogmaals tikken wist de keuze. */
export function GradePicker({
  legend,
  value,
  onChange,
  disabled,
}: {
  legend: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col">
      <legend className="mb-2.5 text-[15px] font-semibold">{legend}</legend>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((grade) => (
          <button
            key={grade}
            type="button"
            aria-pressed={value === grade}
            onClick={() => onChange(value === grade ? null : grade)}
            className={cx(
              'min-h-13 rounded-[14px] border text-lg font-bold transition-colors disabled:opacity-60',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato',
              value === grade
                ? 'border-herb bg-herb text-surface'
                : 'border-line bg-surface text-ink hover:bg-ground',
            )}
          >
            {grade}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export const noteClass =
  'min-h-28 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base leading-normal text-ink outline-none placeholder:text-ink-3 focus:border-tomato focus:ring-2 focus:ring-tomato-soft'

export function MadeRatingForm({
  eventId,
  initial,
}: {
  eventId: string
  initial?: { score: number | null; note: string }
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Mijn beoordeling</SectionTitle>
      <RatingForm key={`${initial?.score}-${initial?.note}`} eventId={eventId} initial={initial} />
    </section>
  )
}

function RatingForm({
  eventId,
  initial,
}: {
  eventId: string
  initial?: { score: number | null; note: string }
}) {
  const router = useRouter()
  const [score, setScore] = useState<number | null>(initial?.score ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  async function save(score: number | null, note: string) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await setMyMadeRatingFn({ data: { eventId, score, note } })
      if (result.ok) {
        setMessage(score === null && !note ? 'Mijn beoordeling gewist.' : 'Mijn beoordeling opgeslagen.')
        await router.invalidate()
      } else setError(result.message)
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await save(score, String(form.get('note') ?? '').trim())
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-2xl bg-surface p-4">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <GradePicker legend="Mijn cijfer" value={score} onChange={setScore} disabled={busy} />
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Mijn notitie</span>
        <textarea
          name="note"
          defaultValue={initial?.note ?? ''}
          disabled={busy}
          maxLength={2000}
          rows={3}
          className={noteClass}
        />
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button type="submit" variant="secondary" disabled={busy} className="sm:flex-1">
          Mijn beoordeling opslaan
        </Button>
        {initial && (
          <Button variant="danger" disabled={busy} onClick={() => save(null, '')} className="sm:flex-1">
            Mijn beoordeling wissen
          </Button>
        )}
      </div>
    </form>
  )
}
