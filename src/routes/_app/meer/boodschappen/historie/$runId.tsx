import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { shoppingStatusLabels, shoppingTargetLabels } from '~/components/shopping-labels'
import { Button, DetailHeader, Notice, Page, buttonClass } from '~/components/ui'
import { copyText } from '~/lib/clipboard'
import { checkShoppingSyncFn, confirmShoppingShareFn, getShoppingRunPage } from '~/server/shopping.functions'

export const Route = createFileRoute('/_app/meer/boodschappen/historie/$runId')({
  loader: ({ params }) => getShoppingRunPage({ data: params }),
  head: () => ({ meta: [{ title: 'Boodschappenexport · Gerechter' }] }),
  component: RunPage,
})
const noSubscribe = () => () => {}
function RunPage() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const field = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [outcome, setOutcome] = useState<'copied' | 'shared' | 'cancelled' | null>(null)
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  )
  const pollRunId = result.ok ? result.data.id : null
  const pollAh = result.ok && result.data.target === 'ah' && result.data.status === 'pending'
  useEffect(() => {
    if (!pollAh || !pollRunId) return
    let live = true,
      checking = false,
      attempts = 0
    const timer = window.setInterval(async () => {
      if (checking || !live) return
      if (++attempts > 120) {
        window.clearInterval(timer)
        return
      }
      checking = true
      try {
        const checked = await checkShoppingSyncFn({ data: { runId: pollRunId } })
        if (live && checked.ok) await router.invalidate()
      } catch {
        /* A manual read-only check remains available. */
      } finally {
        checking = false
      }
    }, 3000)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [pollRunId, pollAh, router])
  async function finish(value: 'copied' | 'shared' | 'cancelled') {
    if (!result.ok) return
    setOutcome(value)
    setBusy(true)
    setError(null)
    try {
      const saved = await confirmShoppingShareFn({ data: { runId: result.data.id, outcome: value } })
      if (saved.ok) {
        setOutcome(null)
        setManual(false)
        await router.invalidate()
      } else setError(saved.message)
    } catch {
      setError(
        'Het resultaat opslaan is niet gelukt. Bevestig het resultaat opnieuw; de deelactie zelf wordt niet herhaald.',
      )
    } finally {
      setBusy(false)
    }
  }
  if (!result.ok)
    return (
      <>
        <DetailHeader
          title="Boodschappenexport"
          back="/meer/boodschappen/historie"
          backLabel="Terug naar exporthistorie"
        />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const run = result.data
  const canFinish = run.target === 'share' && run.status === 'pending' && run.isMine
  return (
    <>
      <DetailHeader
        title="Boodschappenexport"
        back="/meer/boodschappen/historie"
        backLabel="Terug naar exporthistorie"
      />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-xl font-bold break-words">{run.snapshot.title}</h2>
          <p>
            {shoppingTargetLabels[run.target]} · <strong>{shoppingStatusLabels[run.status]}</strong>
          </p>
          <p className="text-sm text-ink-2">
            Gestart door {run.actorName} op{' '}
            {new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(run.createdAt),
            )}
          </p>
          {run.message && <p className="text-sm text-ink-2">{run.message}</p>}
        </section>
        {run.target === 'share' && (
          <Notice>
            {run.status === 'pending'
              ? 'De lijst staat klaar. Kies kopiëren of het deelmenu om de actie af te ronden.'
              : run.status === 'copied' || run.status === 'shared'
                ? 'Dit bevestigt alleen de lokale kopieer- of deelactie; ontvangst bij een ander is niet gecontroleerd.'
                : 'De deelactie is niet afgerond.'}
          </Notice>
        )}
        <label className="flex flex-col gap-2">
          <span className="font-semibold">Boodschappenlijst</span>
          <textarea
            ref={field}
            readOnly
            value={run.snapshot.text}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-64 min-w-0 rounded-2xl border border-line bg-surface p-4 text-base"
          />
        </label>
        {run.target === 'share' && (canFinish || run.status === 'copied' || run.status === 'shared') && (
          <Button
            disabled={busy || Boolean(outcome)}
            onClick={async () => {
              if (!field.current) return
              setError(null)
              setMessage(null)
              setBusy(true)
              const copied = await copyText(run.snapshot.text, field.current)
              setBusy(false)
              if (!copied) {
                setManual(true)
                setError(
                  'Automatisch kopiëren is niet beschikbaar. De tekst is geselecteerd; kopieer deze zelf.',
                )
              } else if (canFinish) await finish('copied')
              else setMessage('De opgeslagen tekst is opnieuw gekopieerd.')
            }}
          >
            {canFinish ? 'Kopiëren' : 'Opgeslagen tekst opnieuw kopiëren'}
          </Button>
        )}
        {canFinish && canShare && (
          <Button
            variant="secondary"
            disabled={busy || Boolean(outcome)}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await navigator.share({
                  title: `Boodschappen · ${run.snapshot.title}`,
                  text: run.snapshot.text,
                })
                await finish('shared')
              } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') await finish('cancelled')
                else
                  setError(
                    'Het deelmenu kon niet worden geopend. Gebruik kopiëren of de geselecteerde tekst.',
                  )
              } finally {
                setBusy(false)
              }
            }}
          >
            Delen via mijn apparaat
          </Button>
        )}
        {canFinish && manual && (
          <Button variant="secondary" disabled={busy} onClick={() => finish('copied')}>
            Ik heb de tekst zelf gekopieerd
          </Button>
        )}
        {canFinish && outcome && (
          <Button variant="secondary" disabled={busy} onClick={() => finish(outcome)}>
            Resultaat opnieuw opslaan
          </Button>
        )}
        {canFinish && !outcome && (
          <Button variant="danger" disabled={busy} onClick={() => finish('cancelled')}>
            Deelverzoek annuleren
          </Button>
        )}
        {run.target !== 'share' && (run.status === 'uncertain' || run.status === 'pending') && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                const checked = await checkShoppingSyncFn({ data: { runId: run.id } })
                if (checked.ok) await router.invalidate()
                else setError(checked.message)
              } catch {
                setError('Statuscontrole is niet gelukt. Er is niets opnieuw verzonden.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Extern resultaat controleren
          </Button>
        )}
        {run.externalUrl && (
          <a href={run.externalUrl} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
            Open de externe boodschappenlijst
          </a>
        )}
        <Link to="/meer/boodschappen" search={run.source} className={buttonClass('secondary')}>
          Nieuw voorstel voor deze bron
        </Link>
      </Page>
    </>
  )
}
