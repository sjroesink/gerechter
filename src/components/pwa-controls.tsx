import { useEffect, useRef, useState } from 'react'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Mounted at the document root, so a one-shot install offer survives route changes. */
export function PwaControls() {
  const [offer, setOffer] = useState<InstallPrompt | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const accepted = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const display = window.matchMedia('(display-mode: standalone)')
    const refresh = () => {
      setInstalled(
        (previous) =>
          previous ||
          display.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      )
      setIos(
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      )
      setOffline(!navigator.onLine)
    }
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setOffer(event as InstallPrompt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setOffer(null)
    }
    refresh()
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    display.addEventListener('change', refresh)
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    const workers = new Set<ServiceWorker>()
    const checkWaiting = () => {
      if (!disposed && navigator.serviceWorker.controller) setWaiting(registration?.waiting ?? null)
    }
    const watchInstalling = () => {
      const worker = registration?.installing
      if (worker) {
        workers.add(worker)
        worker.addEventListener('statechange', checkWaiting)
      }
      checkWaiting()
    }
    const controllerChanged = () => {
      setWaiting(null)
      dialog.current?.close()
      // Consent is tab-local. Other open tabs keep their unsaved input and do not reload.
      if (accepted.current) {
        accepted.current = false
        window.location.reload()
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((result) => {
          if (disposed) return
          registration = result
          registration.addEventListener('updatefound', watchInstalling)
          watchInstalling()
        })
        .catch(() => {
          if (!disposed)
            setError('De offline melding is nog niet beschikbaar. Probeer het later opnieuw met internet.')
        })
    }
    return () => {
      disposed = true
      registration?.removeEventListener('updatefound', watchInstalling)
      for (const worker of workers) worker.removeEventListener('statechange', checkWaiting)
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      display.removeEventListener('change', refresh)
    }
  }, [])

  async function install() {
    const prompt = offer
    if (!prompt) return
    setOffer(null) // The browser offer can only be used once, including dismissal.
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
    } catch {
      setError('Installeren is niet gelukt. Probeer het later opnieuw via je browser.')
    }
  }

  return (
    <>
      {waiting && (
        <aside
          role="status"
          className="fixed inset-x-3 bottom-24 z-20 mx-auto max-w-lg rounded-xl border border-line bg-surface p-4 text-sm text-ink shadow-lg lg:bottom-6"
        >
          <p className="font-semibold">Nieuwe versie beschikbaar</p>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-xl border border-line px-4 font-semibold"
            onClick={() => dialog.current?.showModal()}
          >
            Bijwerken…
          </button>
        </aside>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="pwa-update-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
      >
        <h2 id="pwa-update-title" className="font-display text-xl font-bold">
          Gerechter bijwerken?
        </h2>
        <p className="mt-3 text-sm">
          Niet-opgeslagen wijzigingen in dit tabblad gaan verloren. Sla je werk eerst op. Andere tabbladen
          worden niet herladen.
        </p>
        <form method="dialog" className="mt-5 flex flex-wrap justify-end gap-3">
          <button className="min-h-11 rounded-xl border border-line px-4 font-semibold">Later</button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-tomato-dark px-4 font-semibold text-surface"
            onClick={() => {
              dialog.current?.close()
              if (waiting?.state !== 'installed') {
                setWaiting(null)
                return
              }
              accepted.current = true
              waiting.postMessage({ type: 'ACTIVATE_UPDATE' })
            }}
          >
            Nu bijwerken
          </button>
        </form>
      </dialog>
      {(offline || error) && (
        <aside
          role="status"
          className="fixed inset-x-3 bottom-24 z-20 mx-auto max-w-lg rounded-xl border border-line bg-surface p-4 text-sm text-ink shadow-lg lg:bottom-6"
        >
          {offline
            ? 'Internetverbinding verbroken. Gerechten en wijzigingen hebben internet nodig; niet-opgeslagen invoer is niet offline bewaard.'
            : error}
        </aside>
      )}
      {!installed && (offer || ios) && (
        <footer className="mx-auto max-w-lg px-5 pt-3 pb-28 text-sm text-ink-2 lg:pb-6">
          <details
            className="rounded-xl border border-line bg-surface px-4"
            onToggle={(event) => {
              // Opening the disclosure must reveal its action above the fixed mobile tab bar.
              if (event.currentTarget.open) event.currentTarget.scrollIntoView({ block: 'center' })
            }}
          >
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-ink">
              Gerechter als app
            </summary>
            <p className="pb-3">
              Open Gerechter vanaf je beginscherm. Je hebt internet nodig voor je gerechten, voorraad en
              planning.
            </p>
            {offer ? (
              <button
                type="button"
                className="mb-4 min-h-11 rounded-xl bg-tomato-dark px-5 font-semibold text-surface"
                onClick={() => void install()}
              >
                Installeren
              </button>
            ) : (
              <p className="pb-4">
                Open Gerechter in Safari. Tik op Deel en kies ‘Zet op beginscherm’, daarna ‘Voeg toe’.
              </p>
            )}
          </details>
        </footer>
      )}
    </>
  )
}
