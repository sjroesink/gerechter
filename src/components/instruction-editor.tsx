import { useRef, useState } from 'react'
import {
  blocksToOpenUi,
  instructionBlocks,
  type InstructionBlock,
  type InstructionSection,
} from '~/domain/instructions'
import { Button } from './ui'

export const recipeInputClass =
  'min-h-12 min-w-0 rounded-2xl border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-3 focus:border-tomato focus:ring-2 focus:ring-tomato-soft'
export const recipeAreaClass = `${recipeInputClass} min-h-28 py-3 leading-normal`
type BlockDraft = { key: number; value: InstructionBlock }

export function InstructionEditor({
  label,
  initial,
  change,
  disabled,
}: {
  label: string
  initial: InstructionSection
  change: (section: InstructionSection) => void
  disabled: boolean
}) {
  const nextKey = useRef(1000)
  const [text, setText] = useState(initial.text)
  const [blocks, setBlocks] = useState<BlockDraft[]>(() =>
    instructionBlocks(initial.openUi).map((value, key) => ({ key, value })),
  )
  function update(next: BlockDraft[]) {
    setBlocks(next)
    change({ id: initial.id, text, openUi: blocksToOpenUi(next.map((item) => item.value)) })
  }
  function edit(key: number, value: InstructionBlock) {
    update(blocks.map((block) => (block.key === key ? { key, value } : block)))
  }
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-4">
      <legend className="px-1 text-[17px] font-bold">{label}</legend>
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Tekst {label}</span>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            change({
              id: initial.id,
              text: event.target.value,
              openUi: blocksToOpenUi(blocks.map((block) => block.value)),
            })
          }}
          maxLength={15000}
          className={recipeAreaClass}
        />
      </label>
      {blocks.map(({ key, value }, index) => (
        <div key={key} className="flex flex-col gap-3 rounded-2xl bg-ground p-3">
          {(value.kind === 'Step' || value.kind === 'Tip') && (
            <label className="flex flex-col gap-2">
              <span className="font-semibold">{value.kind === 'Step' ? 'Tekststap' : 'Tip'}</span>
              <textarea
                required
                value={value.text}
                maxLength={4000}
                onChange={(event) => edit(key, { ...value, text: event.target.value })}
                className={recipeAreaClass}
              />
            </label>
          )}
          {value.kind === 'Timer' && (
            <>
              <label className="flex flex-col gap-2">
                <span className="font-semibold">Naam kookwekker</span>
                <input
                  required
                  value={value.label}
                  maxLength={120}
                  onChange={(event) => edit(key, { ...value, label: event.target.value })}
                  className={recipeInputClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold">Tijd (minuten)</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={value.minutes}
                  onChange={(event) => edit(key, { ...value, minutes: Number(event.target.value) })}
                  className={recipeInputClass}
                />
              </label>
            </>
          )}
          {value.kind === 'Checklist' && (
            <label className="flex flex-col gap-2">
              <span className="font-semibold">Checklist (één taak per regel)</span>
              <textarea
                required
                value={value.items.join('\n')}
                onChange={(event) => edit(key, { ...value, items: event.target.value.split('\n') })}
                maxLength={15000}
                className={recipeAreaClass}
              />
            </label>
          )}
          <Button
            variant="danger"
            aria-label={`Verwijder instructieblok ${index + 1}`}
            onClick={() => update(blocks.filter((block) => block.key !== key))}
          >
            Blok verwijderen
          </Button>
        </div>
      ))}
      {blocks.length < 100 && (
        <div className="flex flex-wrap gap-2">
          {(['Step', 'Tip', 'Timer', 'Checklist'] as const).map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              onClick={() => {
                const value: InstructionBlock =
                  kind === 'Timer'
                    ? { kind, label: 'Kookwekker', minutes: 10 }
                    : kind === 'Checklist'
                      ? { kind, items: [''] }
                      : { kind, text: '' }
                update([...blocks, { key: nextKey.current++, value }])
              }}
            >
              {({ Step: 'Stap', Tip: 'Tip', Timer: 'Kookwekker', Checklist: 'Checklist' } as const)[kind]}{' '}
              toevoegen
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
