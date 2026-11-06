import { describe, expect, test } from 'vitest'
import { Invalid } from './core/errors'
import {
  INSTRUCTION_EXAMPLE,
  blocksToOpenUi,
  instructionBlocks,
  getInstructionFormat,
  validateInstructionSections,
  validateOpenUi,
} from './instructions'

describe('veilige OpenUI-instructies', () => {
  test('het gedocumenteerde voorbeeld en verwijzingen zijn geldig', () => {
    expect(validateOpenUi(INSTRUCTION_EXAMPLE)).toBe(INSTRUCTION_EXAMPLE)
    expect(validateOpenUi('root = RecipeSteps([stap])\nstap = Step("Snijd de ui.")')).toContain(
      'Snijd de ui.',
    )
    expect(getInstructionFormat().prompt).toContain('RecipeSteps')
  })

  test.each([
    'root = Ingredients(["ander ingrediënt"])',
    'root = RecipeSteps([Unknown("test")])',
    'root = RecipeSteps([Timer("Negatief", -1)])',
    'root = RecipeSteps([Checklist([])])',
    'root = RecipeSteps([Step(42)])',
    'root = RecipeSteps([Step("test"), ontbreekt])',
    'root = RecipeSteps([Step("test")',
    'root = RecipeSteps([Step($titel)])\n$titel = "Dynamisch"',
    'root = RecipeSteps([Step("test")])\nquery = Query("extern", {})',
    'root = RecipeSteps([Step(@OpenUrl("https://example.test"))])',
    'root = RecipeSteps([Step("test")])\nongebruikt = Step("losse inhoud")',
    'helemaal geen programma',
  ])('weigert ongeldige of dynamische inhoud: %s', (source) => {
    expect(() => validateOpenUi(source)).toThrow(Invalid)
  })

  test('de gewone editor bewaart alle blokken en behandelt programmatekens als tekst', () => {
    const blocks = instructionBlocks(INSTRUCTION_EXAMPLE)
    expect(blocks.map((block) => block.kind)).toEqual(['Step', 'Timer', 'Tip', 'Checklist'])
    expect(instructionBlocks(blocksToOpenUi(blocks))).toEqual(blocks)
    const text = '"); Query("extern", {}) <script>test</script>'
    const source = blocksToOpenUi([{ kind: 'Step', text }])
    expect(() => validateOpenUi(source)).not.toThrow()
    expect(instructionBlocks(source)).toEqual([{ kind: 'Step', text }])
  })

  test('secties hebben een vaste volgorde; onbekende en dubbele secties zijn ongeldig', () => {
    const sections = validateInstructionSections([
      { id: 'notes', text: 'Notitie' },
      { id: 'cooking', text: 'Koken' },
    ])
    expect(sections.map((section) => section.id)).toEqual(['cooking', 'notes'])
    expect(() => validateInstructionSections([{ id: 'notes' }, { id: 'notes' }])).toThrow(Invalid)
    expect(() => validateInstructionSections([{ id: 'ingredients', text: 'Verboden' }] as never)).toThrow(
      Invalid,
    )
  })
})
