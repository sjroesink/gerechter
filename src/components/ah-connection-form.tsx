import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { connectAhFn, disconnectAhFn } from '~/server/ah.functions'
import { Button, Field, Notice, SectionTitle, buttonClass } from './ui'

export function AhConnectionForm({
  setup,
  canManage,
  configured,
}: {
  setup: { enabled: boolean; reachable: boolean; authorizationUrl: string }
  canManage: boolean
  configured: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Albert Heijn · experimenteel</SectionTitle>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <Notice>
        {configured
          ? 'Een AH-verbinding is ingesteld voor dit huishouden.'
          : 'Nog geen AH-verbinding ingesteld.'}
      </Notice>
      {!setup.enabled ? (
        <p className="text-sm text-ink-2">
          AH is niet ingeschakeld op deze installatie. Delen en Notion blijven beschikbaar.
        </p>
      ) : !setup.reachable ? (
        <Notice>De AH-service is nu niet bereikbaar. Probeer later opnieuw.</Notice>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Deze onofficiële koppeling zet gecontroleerde tekstregels op je AH-boodschappenlijst. Je kiest
            zelf producten en rekent zelf af in AH. De koppeling kan veranderen als AH zijn dienst aanpast.
          </p>
          {canManage ? (
            <>
              <a
                href={setup.authorizationUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClass('secondary')}
              >
                Aanmelden bij AH (nieuw tabblad)
              </a>
              <p className="text-sm text-ink-2">
                Meld je aan bij AH. Kopieer daarna de volledige appie://login-exit-adresregel of de code
                daaruit, ook als de browser die pagina niet kan openen. Vul nooit je AH-wachtwoord in
                Gerechter in.
              </p>
              <form
                className="flex flex-col gap-4 rounded-[20px] bg-surface p-5"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const element = event.currentTarget,
                    form = new FormData(element)
                  setBusy(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const result = await connectAhFn({ data: { code: String(form.get('code') ?? '') } })
                    if (result.ok) {
                      element.reset()
                      setMessage(result.data.message)
                      await router.invalidate()
                    } else setError(result.message)
                  } catch {
                    setError(
                      'Het aanmeldresultaat kon niet worden bevestigd. Controleer de verbinding en gebruik zo nodig een nieuwe code.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Field
                  label="AH-aanmeldcode of callback-URL"
                  name="code"
                  type="password"
                  required
                  maxLength={4096}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
                <Button type="submit" disabled={busy}>
                  AH verbinden
                </Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-2">Vraag een eigenaar van dit huishouden om AH te koppelen.</p>
          )}
        </>
      )}
      {configured && canManage && (
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            setMessage(null)
            try {
              const result = await disconnectAhFn()
              if (result.ok) {
                setMessage(result.data.message)
                await router.invalidate()
              }
              if (!result.ok) setError(result.message)
            } catch {
              setError('Loskoppelen kon niet worden bevestigd. Probeer opnieuw.')
            } finally {
              setBusy(false)
            }
          }}
        >
          AH loskoppelen
        </Button>
      )}
    </section>
  )
}
