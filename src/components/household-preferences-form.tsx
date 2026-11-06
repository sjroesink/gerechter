import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { setPreferencesFn } from '~/server/pantry.functions'
import { Button, Field, Notice, SectionTitle } from './ui'

export function HouseholdPreferencesForm({ defaultServings }: { defaultServings: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Porties</SectionTitle>
      <form
        key={defaultServings}
        className="flex flex-col gap-4 rounded-[20px] bg-surface p-5"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          setBusy(true)
          setError(null)
          setMessage(null)
          try {
            const result = await setPreferencesFn({
              data: { defaultServings: Number(form.get('defaultServings')) },
            })
            if (result.ok) {
              setMessage('Standaardporties opgeslagen.')
              await router.invalidate()
            } else setError(result.message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <Field
          label="Standaardporties"
          name="defaultServings"
          type="number"
          min={1}
          max={1000}
          step={1}
          required
          defaultValue={defaultServings}
          disabled={busy}
          hint="Voor het hele huishouden. Je kunt per gerecht of geplande maaltijd andere porties kiezen."
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Standaardporties opslaan
        </Button>
      </form>
    </section>
  )
}
