import { useEffect, useRef, useState } from 'react'
import type { InstructionSection } from '~/domain/instructions'
import { CloseIcon } from './icons'
import { IngredientThumbnail } from './ingredient-photo'
import { RecipeInstructions } from './recipe-instructions'
import type { IngredientPhoto } from '~/domain/ingredient-photo'

type WakeState = 'pending' | 'on' | 'unsupported'

/** Keeps the screen on while `active`; the browser drops the lock when the tab hides, so it is renewed. */
function useWakeLock(active: boolean) {
  // Only rendered after a tap, so `navigator` is always available here.
  const [state, setState] = useState<WakeState>(() => ('wakeLock' in navigator ? 'pending' : 'unsupported'))
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (stopped) await next.release()
        else {
          lock = next
          setState('on')
        }
      } catch {
        if (!stopped) setState('unsupported')
      }
    }
    const renew = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void request()
    }
    void request()
    document.addEventListener('visibilitychange', renew)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', renew)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
  return state
}

export type CookingLine = { name: string; amount: string; note: string | null; photo: IngredientPhoto | null }

/** Full-screen recipe without app chrome: ingredients to tick off and the instructions, screen kept on. */
export function CookingMode({
  name,
  servings,
  lines,
  sections,
  onClose,
}: {
  name: string
  servings: number
  lines: CookingLine[]
  sections: InstructionSection[]
  onClose: () => void
}) {
  const wake = useWakeLock(true)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Kookmodus · ${name}`}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ground text-ink"
    >
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line-soft bg-ground/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-tomato">Kookmodus</p>
          <h1 className="font-display text-xl leading-tight font-bold break-words">{name}</h1>
        </div>
        <button
          ref={close}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] font-bold hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato"
        >
          <CloseIcon size={18} />
          Sluiten
        </button>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p role="status" className="text-[13px] text-ink-3">
          {wake === 'unsupported'
            ? 'Deze browser kan het scherm niet aan houden; zet zo nodig de schermvergrendeling zelf uit.'
            : 'Het scherm blijft aan zolang de kookmodus open is.'}
        </p>
        <section aria-label="Ingrediënten" className="flex flex-col gap-2.5">
          <h2 className="text-lg font-bold">Ingrediënten voor {servings} personen</h2>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {lines.map((line, index) => (
              <li key={index} className="border-b border-line-soft last:border-b-0">
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="peer -ml-1 size-11 shrink-0 accent-herb" />
                  <IngredientThumbnail photo={line.photo} name={line.name} small />
                  <span className="min-w-0 flex-1 text-[17px] break-words peer-checked:text-ink-3 peer-checked:line-through">
                    <strong>{line.amount}</strong> {line.name}
                    {line.note && <span className="block text-[13px] text-ink-3">{line.note}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <RecipeInstructions sections={sections} />
      </div>
    </div>
  )
}
