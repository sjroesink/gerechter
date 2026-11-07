import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang'
import { isElementNode } from '@openuidev/lang-core'
import { useEffect, useState } from 'react'
import { checklistProps, stepProps, stepsProps, timerProps, tipProps } from '~/domain/instructions'
import { BulbIcon, CheckIcon, TimerIcon } from './icons'
import { Button } from './ui'

function KitchenTimer({ label, minutes }: { label: string; minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60)
  const [deadline, setDeadline] = useState<number | null>(null)
  useEffect(() => {
    if (deadline === null) return
    const interval = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(next)
      if (next === 0) clearInterval(interval)
    }, 250)
    return () => clearInterval(interval)
  }, [deadline])
  const running = deadline !== null && remaining > 0
  const display = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  return (
    <section
      aria-label={`Kookwekker ${label}`}
      className="flex flex-col gap-2.5 rounded-2xl bg-line-soft p-3 pl-4 sm:flex-row sm:items-center sm:gap-3.5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TimerIcon size={24} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div role="timer" className="text-[22px] leading-tight font-bold tabular-nums">
            {display}
          </div>
          <h4 className="text-[13px] break-words text-ink-3">{label}</h4>
          {remaining === 0 && (
            <p role="status" className="text-[13px] font-semibold text-herb-dark">
              Tijd is om.
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 sm:shrink-0">
        <Button
          variant="ghost"
          className="flex-1 px-3 sm:flex-none"
          onClick={() => {
            setDeadline(null)
            setRemaining(minutes * 60)
          }}
        >
          Herstellen
        </Button>
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-ink px-4.5 text-[15px] font-bold text-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato sm:flex-none"
          onClick={() => {
            if (running) setDeadline(null)
            else {
              const seconds = remaining || minutes * 60
              setRemaining(seconds)
              setDeadline(Date.now() + seconds * 1000)
            }
          }}
        >
          {running ? 'Pauzeren' : remaining === 0 ? 'Opnieuw starten' : 'Starten'}
        </button>
      </div>
    </section>
  )
}

const Step = defineComponent({
  name: 'Step',
  props: stepProps,
  description: 'Tekststap.',
  component: ({ props }) => (
    <p className="pt-0.5 text-base leading-normal whitespace-pre-wrap break-words">{props.text}</p>
  ),
})
const Tip = defineComponent({
  name: 'Tip',
  props: tipProps,
  description: 'Praktische tip.',
  component: ({ props }) => (
    <div className="flex gap-2.5 rounded-xl bg-herb-soft px-3 py-2 text-sm leading-normal text-herb-dark">
      <BulbIcon size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 whitespace-pre-wrap break-words">
        <strong>Tip</strong> · <span>{props.text}</span>
      </p>
    </div>
  ),
})
const Timer = defineComponent({
  name: 'Timer',
  props: timerProps,
  description: 'Lokale kookwekker.',
  component: ({ props }) => <KitchenTimer key={`${props.label}-${props.minutes}`} {...props} />,
})
const Checklist = defineComponent({
  name: 'Checklist',
  props: checklistProps,
  description: 'Lokale checklist.',
  component: ({ props }) => (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-line-soft">
      {props.items.map((item, index) => (
        <li key={index} className="border-b border-line-soft last:border-b-0">
          <label className="flex min-h-11 cursor-pointer items-center gap-1 pr-3">
            <span className="relative flex size-11 shrink-0 items-center justify-center">
              <input type="checkbox" className="peer absolute inset-0 cursor-pointer opacity-0" />
              <span
                aria-hidden="true"
                className="flex size-5.5 items-center justify-center rounded-md border-2 border-line bg-surface text-transparent peer-checked:border-herb peer-checked:bg-herb peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tomato"
              >
                <CheckIcon size={14} strokeWidth={3} />
              </span>
            </span>
            <span className="min-w-0 break-words">{item}</span>
          </label>
        </li>
      ))}
    </ul>
  ),
})
const RecipeSteps = defineComponent({
  name: 'RecipeSteps',
  props: stepsProps,
  description: 'Instructiecontainer.',
  component: ({ props, renderNode }) => {
    let step = 0
    return (
      <div className="flex flex-col gap-3">
        {props.items.map((item, index) => {
          const numbered = isElementNode(item) && item.typeName === 'Step'
          if (numbered) step += 1
          return (
            <div key={index} className="flex gap-3.5">
              {numbered ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-surface">
                  {step}
                </span>
              ) : (
                <span aria-hidden="true" className="w-7 shrink-0" />
              )}
              <div className="min-w-0 flex-1">{renderNode(item)}</div>
            </div>
          )
        })}
      </div>
    )
  },
})
const library = createLibrary({ root: 'RecipeSteps', components: [RecipeSteps, Step, Tip, Timer, Checklist] })

export default function OpenUiBlock({ source }: { source: string }) {
  return (
    <Renderer
      response={source}
      library={library}
      isStreaming={false}
      toolProvider={null}
      publishObservability={false}
    />
  )
}
