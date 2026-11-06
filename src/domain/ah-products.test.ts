import { describe, expect, test } from 'vitest'
import { setupTestDb } from '../../tests/db'
import { twoHouseholds } from '../../tests/fixtures'
import { ahQuantity, getAhProductLink, linkAhProduct, parseUnitSize, unlinkAhProduct } from './ah-products'
import { createIngredient, setIngredientArchived } from './catalog'
import { Invalid, NotFound } from './core'
import { setPantryItem } from './pantry'
import { createRecipe } from './recipes'
import { calculateShoppingNeeds } from './shopping-needs'

const db = setupTestDb()
const product = (productId: number, packAmount: number | null = null) => ({
  productId,
  title: `AH product ${productId}`,
  unitSize: packAmount ? `${packAmount} g` : null,
  imageUrl: 'https://static.ah.nl/image.jpg',
  packAmount,
})

describe('AH-inhoud herkennen', () => {
  test.each([
    ['500 g', 'g', 500],
    ['1 kg', 'g', 1000],
    ['1,5 kg', 'g', 1500],
    ['ca. 400 g', 'g', 400],
    ['2 x 250 g', 'g', 500],
    ['1,5 l', 'ml', 1500],
    ['75 cl', 'ml', 750],
    ['250 ml', 'ml', 250],
    ['6 stuks', 'stuk', 6],
    ['per stuk', 'stuk', 1],
    ['500 ml', 'g', null],
    ['per kg', 'g', null],
    ['los per kilo', 'g', null],
    ['per stuk', 'g', null],
    ['een tros', 'stuk', null],
    ['', 'g', null],
  ] as const)('%s als %s → %s', (text, base, expected) => {
    expect(parseUnitSize(text, base)).toBe(expected)
  })
})

describe('aantal verpakkingen', () => {
  test('rondt naar boven af, begrenst op 99 en raadt geen vage hoeveelheden', () => {
    expect(ahQuantity({ needed: 700, unknown: [] }, 500)).toEqual({ quantity: 2, check: false })
    expect(ahQuantity({ needed: 1000, unknown: [] }, 500)).toEqual({ quantity: 2, check: false })
    expect(ahQuantity({ needed: 0.3, unknown: [] }, 0.1)).toEqual({ quantity: 3, check: false })
    expect(ahQuantity({ needed: 1e6, unknown: [] }, 1)).toEqual({ quantity: 99, check: false })
    expect(ahQuantity({ needed: 700, unknown: [] }, null)).toEqual({ quantity: 1, check: true })
    expect(ahQuantity({ needed: 0, unknown: [{}] }, 500)).toEqual({ quantity: 1, check: true })
    expect(ahQuantity({ needed: 700, unknown: [{}] }, 500)).toEqual({ quantity: 2, check: true })
  })
})

describe('AH-productkoppelingen', () => {
  test('gelden per huishouden, ook voor een globaal ingrediënt, en lekken niet', async () => {
    const { a, b } = await twoHouseholds(db)
    a.user.role = 'admin'
    const global = await createIngredient(a, {
      name: `Globale ui ${crypto.randomUUID()}`,
      baseUnit: 'stuk',
      scope: 'global',
    })
    a.user.role = 'user'
    await linkAhProduct(a, { ingredientId: global.id, ...product(1) })
    expect(await getAhProductLink(b, global.id)).toBeNull()
    await linkAhProduct(b, { ingredientId: global.id, ...product(2) })
    expect((await getAhProductLink(a, global.id))?.productId).toBe(1)
    expect((await getAhProductLink(b, global.id))?.productId).toBe(2)
    expect(await unlinkAhProduct(b, global.id)).toEqual({ removed: true })
    expect((await getAhProductLink(a, global.id))?.productId).toBe(1)
  })

  test('weigert vreemde ingrediënten en ongeldige invoer, en werkt een bestaande koppeling bij', async () => {
    const { a, b } = await twoHouseholds(db)
    const own = await createIngredient(a, { name: 'Eigen tomaat', baseUnit: 'g' })
    await expect(linkAhProduct(b, { ingredientId: own.id, ...product(1) })).rejects.toBeInstanceOf(NotFound)
    await expect(unlinkAhProduct(b, own.id)).rejects.toBeInstanceOf(NotFound)
    await expect(getAhProductLink(b, own.id)).rejects.toBeInstanceOf(NotFound)
    for (const invalid of [
      { ...product(0) },
      { ...product(1), packAmount: -1 },
      { ...product(1), packAmount: 0 },
      { ...product(1), title: ' ' },
      { ...product(1), imageUrl: 'http://static.ah.nl/x.jpg' },
      { ...product(1), imageUrl: 'javascript:alert(1)' },
    ])
      await expect(linkAhProduct(a, { ingredientId: own.id, ...invalid })).rejects.toBeInstanceOf(Invalid)
    await linkAhProduct(a, { ingredientId: own.id, ...product(1, 500) })
    await linkAhProduct(a, { ingredientId: own.id, ...product(3, 250) })
    expect(await getAhProductLink(a, own.id)).toMatchObject({ productId: 3, packAmount: 250 })
    await setIngredientArchived(a, own.id, true)
    expect(await getAhProductLink(a, own.id)).toMatchObject({ productId: 3 })
  })
})

describe('boodschappenbehoefte met AH-producten', () => {
  async function setup() {
    const { a, b } = await twoHouseholds(db)
    const tomato = await createIngredient(a, { name: 'Tomaten', baseUnit: 'g' })
    const cherry = await createIngredient(a, { name: 'Cherrytomaten', baseUnit: 'g' })
    const herbs = await createIngredient(a, { name: 'Peterselie', baseUnit: 'g' })
    const salt = await createIngredient(a, { name: 'Zout', baseUnit: 'g' })
    const pepper = await createIngredient(a, { name: 'Peper', baseUnit: 'g' })
    await setPantryItem(a, { ingredientId: salt.id, quantity: 100, unit: 'g', staple: true, version: 0 })
    const recipe = await createRecipe(a, {
      name: 'Tomatensalade',
      servings: 2,
      ingredients: [
        { ingredientId: tomato.id, quantity: 700, unit: 'g' },
        { ingredientId: cherry.id, quantity: 200, unit: 'g' },
        { ingredientId: herbs.id, quantity: 1, unit: 'bos' },
        { ingredientId: salt.id, quantity: 1, unit: 'snuf' },
        { ingredientId: pepper.id, quantity: 1, unit: 'snuf' },
      ],
    })
    const source = { kind: 'recipe' as const, recipeId: recipe.id, servings: 2 }
    return { a, b, tomato, cherry, herbs, salt, pepper, source }
  }

  test('zonder koppelingen zijn de AH-regels gelijk aan de tekstregels', async () => {
    const { a, source } = await setup()
    const need = await calculateShoppingNeeds(a, source)
    expect(need.ahItems).toEqual(need.lines.map((description) => ({ kind: 'text', description })))
    expect(need.items.every((item) => item.ahProduct === null)).toBe(true)
  })

  test('gemengde behoefte: producten met aantal, gedeeld product samengevoegd, rest als tekst', async () => {
    const { a, tomato, cherry, salt, pepper, source } = await setup()
    await linkAhProduct(a, { ingredientId: tomato.id, ...product(10, 500) })
    await linkAhProduct(a, { ingredientId: cherry.id, ...product(10, 500) })
    await linkAhProduct(a, { ingredientId: pepper.id, ...product(20) })
    await linkAhProduct(a, { ingredientId: salt.id, ...product(30, 500) })
    const need = await calculateShoppingNeeds(a, source)
    expect(need.items.find((item) => item.ingredientId === tomato.id)?.ahProduct).toMatchObject({
      productId: 10,
      quantity: 2,
      check: false,
    })
    expect(need.items.find((item) => item.ingredientId === pepper.id)?.ahProduct).toMatchObject({
      quantity: 1,
      check: true,
    })
    expect(need.ahItems).toEqual(
      expect.arrayContaining([
        { kind: 'product', productId: 10, description: 'AH product 10', quantity: 3, check: false },
        { kind: 'product', productId: 20, description: 'AH product 20', quantity: 1, check: true },
      ]),
    )
    expect(need.ahItems?.filter((item) => item.kind === 'product')).toHaveLength(2)
    expect(need.ahItems?.some((item) => item.kind === 'product' && item.productId === 30)).toBe(false)
    const herbLines = need.lines.filter((line) => line.includes('Peterselie'))
    expect(herbLines.length).toBeGreaterThan(0)
    expect(need.ahItems).toEqual(
      expect.arrayContaining(herbLines.map((description) => ({ kind: 'text', description }))),
    )
    expect(need.ahItems?.some((item) => item.kind === 'text' && item.description.includes('Tomaten'))).toBe(
      false,
    )
  })

  test('een gewijzigd product of gewijzigde inhoud verandert de fingerprint; een ander huishouden niet', async () => {
    const { a, b, tomato, source } = await setup()
    const start = (await calculateShoppingNeeds(a, source)).fingerprint
    await linkAhProduct(a, { ingredientId: tomato.id, ...product(10, 500) })
    const linked = (await calculateShoppingNeeds(a, source)).fingerprint
    expect(linked).not.toBe(start)
    await linkAhProduct(a, { ingredientId: tomato.id, ...product(10, 1000) })
    const repacked = (await calculateShoppingNeeds(a, source)).fingerprint
    expect(repacked).not.toBe(linked)
    await linkAhProduct(b, { ingredientId: tomato.id, ...product(99, 1) }).catch(() => undefined)
    expect((await calculateShoppingNeeds(a, source)).fingerprint).toBe(repacked)
    await unlinkAhProduct(a, tomato.id)
    expect((await calculateShoppingNeeds(a, source)).fingerprint).toBe(start)
  })
})
