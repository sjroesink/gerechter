import {
  createLibrary,
  createParser,
  defineComponent,
  isElementNode,
  type ElementNode,
} from '@openuidev/lang-core'
import { z } from 'zod/v4'
import { Invalid } from './core/errors'
import { parseInput } from './core/validation'

export const INSTRUCTION_SECTIONS = [
  { id: 'preparation', label: 'Voorbereiding' },
  { id: 'cooking', label: 'Bereiding' },
  { id: 'serving', label: 'Serveren' },
  { id: 'notes', label: 'Notities' },
] as const
export const SECTION_IDS = ['preparation', 'cooking', 'serving', 'notes'] as const
const text = z.string().trim().min(1).max(4000)
export const stepProps = z.object({ text }).strict()
export const tipProps = z.object({ text }).strict()
export const timerProps = z
  .object({ label: z.string().trim().min(1).max(120), minutes: z.number().int().min(1).max(1440) })
  .strict()
export const checklistProps = z
  .object({ items: z.array(z.string().trim().min(1).max(500)).min(1).max(30) })
  .strict()
const Step = defineComponent({
  name: 'Step',
  description: 'Een tekststap in de bereiding.',
  props: stepProps,
  component: null,
})
const Tip = defineComponent({
  name: 'Tip',
  description: 'Een praktische tip, als gewone tekst.',
  props: tipProps,
  component: null,
})
const Timer = defineComponent({
  name: 'Timer',
  description: 'Een lokale kookwekker met label en hele minuten.',
  props: timerProps,
  component: null,
})
const Checklist = defineComponent({
  name: 'Checklist',
  description: 'Een lokaal afvinkbare lijst met tekstregels.',
  props: checklistProps,
  component: null,
})
export const stepsProps = z
  .object({
    items: z
      .array(z.union([Step.ref, Tip.ref, Timer.ref, Checklist.ref]))
      .min(1)
      .max(100),
  })
  .strict()
const RecipeSteps = defineComponent({
  name: 'RecipeSteps',
  description: 'Container voor instructiestappen, tips, kookwekkers en checklists.',
  props: stepsProps,
  component: null,
})
export const instructionLibrary = createLibrary({
  root: 'RecipeSteps',
  components: [RecipeSteps, Step, Tip, Timer, Checklist],
})
const parser = createParser(instructionLibrary.toJSONSchema(), 'RecipeSteps')
const leafSchemas = { Step: stepProps, Tip: tipProps, Timer: timerProps, Checklist: checklistProps }

function validateTree(node: ElementNode) {
  if (node.partial || node.hasDynamicProps)
    throw new Invalid('Instructieblokken moeten volledig en statisch zijn.')
  if (
    node.typeName !== 'RecipeSteps' ||
    Object.keys(node.props).some((key) => key !== 'items') ||
    !Array.isArray(node.props.items) ||
    node.props.items.length < 1 ||
    node.props.items.length > 100
  ) {
    throw new Invalid('Gebruik RecipeSteps met toegestane instructiecomponenten.')
  }
  for (const item of node.props.items) {
    if (!isElementNode(item) || item.partial || item.hasDynamicProps || !(item.typeName in leafSchemas))
      throw new Invalid('Onbekende of dynamische instructiecomponent.')
    const schema = leafSchemas[item.typeName as keyof typeof leafSchemas]
    if (!schema.safeParse(item.props).success)
      throw new Invalid('Ongeldige eigenschappen in een instructiecomponent.')
  }
}

export function validateOpenUi(source: string): string {
  const value = parseInput(z.string().trim().min(1).max(20000), source)
  try {
    const result = parser.parse(value)
    if (
      !result.root ||
      result.rootExpression ||
      result.meta.incomplete ||
      result.meta.errors.length ||
      result.meta.unresolved.length ||
      result.meta.orphaned.length ||
      result.meta.statementCount > 200 ||
      Object.keys(result.stateDeclarations).length ||
      result.queryStatements.length ||
      result.mutationStatements.length
    ) {
      throw new Invalid(
        'Ongeldig instructieblok: gebruik complete, statische stappen zonder externe acties of toolaanroepen.',
      )
    }
    validateTree(result.root)
  } catch (error) {
    if (error instanceof Invalid) throw error
    throw new Invalid('Dit instructieblok kan niet worden gelezen. Controleer het instructieformaat.')
  }
  return value
}

export const instructionSectionInput = z
  .object({
    id: z.enum(SECTION_IDS),
    text: z.string().max(15000).default(''),
    openUi: z.string().max(20000).default(''),
  })
  .strict()
export const instructionSectionsInput = z
  .array(instructionSectionInput)
  .max(4)
  .default([])
  .superRefine((sections, ctx) => {
    if (new Set(sections.map((section) => section.id)).size !== sections.length)
      ctx.addIssue({ code: 'custom', message: 'Een instructiesectie mag maar één keer voorkomen.' })
  })
export type InstructionSection = z.output<typeof instructionSectionInput>

export function validateInstructionSections(
  input: z.input<typeof instructionSectionsInput>,
): InstructionSection[] {
  return parseInput(instructionSectionsInput, input)
    .map((section) => ({
      id: section.id,
      text: section.text.trim(),
      openUi: section.openUi.trim() ? validateOpenUi(section.openUi) : '',
    }))
    .sort((a, b) => SECTION_IDS.indexOf(a.id) - SECTION_IDS.indexOf(b.id))
}

export const INSTRUCTION_EXAMPLE =
  'root = RecipeSteps([Step("Kook de pasta beetgaar."), Timer("Pasta", 10), Tip("Bewaar wat kookvocht."), Checklist(["Pasta afgieten", "Saus mengen"])])'

export type InstructionBlock =
  | { kind: 'Step'; text: string }
  | { kind: 'Tip'; text: string }
  | { kind: 'Timer'; label: string; minutes: number }
  | { kind: 'Checklist'; items: string[] }

export function instructionBlocks(source: string): InstructionBlock[] {
  if (!source.trim()) return []
  validateOpenUi(source)
  const items = parser.parse(source).root!.props.items as ElementNode[]
  return items.map((item): InstructionBlock => {
    if (item.typeName === 'Step' || item.typeName === 'Tip')
      return { kind: item.typeName, ...parseInput(stepProps, item.props) }
    if (item.typeName === 'Timer') return { kind: 'Timer', ...parseInput(timerProps, item.props) }
    return { kind: 'Checklist', ...parseInput(checklistProps, item.props) }
  })
}

export function blocksToOpenUi(blocks: readonly InstructionBlock[]): string {
  if (blocks.length === 0) return ''
  const calls = blocks.map((block) => {
    if (block.kind === 'Step' || block.kind === 'Tip') return `${block.kind}(${JSON.stringify(block.text)})`
    if (block.kind === 'Timer')
      return `Timer(${JSON.stringify(block.label)}, ${JSON.stringify(block.minutes)})`
    return `Checklist(${JSON.stringify(block.items.map((item) => item.trim()).filter(Boolean))})`
  })
  return `root = RecipeSteps([${calls.join(', ')}])`
}
export function getInstructionFormat() {
  return {
    sections: INSTRUCTION_SECTIONS,
    example: INSTRUCTION_EXAMPLE,
    rules: [
      'De ingrediëntensectie wordt uit het recept afgeleid; genereer die niet.',
      'Gebruik alleen RecipeSteps, Step, Tip, Timer en Checklist.',
      'Geen dynamische expressies, staat, queries, mutaties of externe acties.',
    ],
    prompt: instructionLibrary.prompt({
      toolCalls: false,
      bindings: false,
      builtinFunctions: false,
      examples: [INSTRUCTION_EXAMPLE],
    }),
  }
}
