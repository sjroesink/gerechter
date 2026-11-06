import { lazy, Suspense } from 'react'
import { INSTRUCTION_SECTIONS, type InstructionSection } from '~/domain/instructions'

const OpenUiBlock = lazy(() => {
  // OpenUI 1.1.0 monteert anders automatisch een ontwikkelwidget in productpagina's van de devserver.
  Reflect.set(globalThis, Symbol.for('openui.devtools.autoMount'), true)
  return import('./openui-block')
})

export function RecipeInstructions({ sections }: { sections: InstructionSection[] }) {
  return (
    <>
      {INSTRUCTION_SECTIONS.map(({ id, label }) => {
        const section = sections.find((section) => section.id === id)
        if (!section || (!section.text && !section.openUi)) return null
        return (
          <section
            key={id}
            aria-label={label}
            className="flex flex-col gap-3.5 rounded-2xl bg-surface p-4 lg:rounded-[20px] lg:px-6 lg:py-5"
          >
            <h2 className="text-lg font-bold">{label}</h2>
            {section.text && (
              <p className="text-base leading-normal whitespace-pre-wrap break-words">{section.text}</p>
            )}
            {section.openUi && (
              <Suspense fallback={<p className="text-ink-3">Instructies laden…</p>}>
                <OpenUiBlock source={section.openUi} />
              </Suspense>
            )}
          </section>
        )
      })}
    </>
  )
}
