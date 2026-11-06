import { describe, expect, test } from 'vitest'
import { Invalid } from './core/errors'
import { UNITS, amountInBaseUnit, canonicalConversion, type Unit } from './units'

describe('eenheden en omrekeningen', () => {
  test('alle eenheden hebben een label en een van de vier dimensies', () => {
    expect(new Set(UNITS.map((unit) => unit.dimension))).toEqual(
      new Set(['mass', 'volume', 'count', 'vague']),
    )
    expect(new Set(UNITS.map((unit) => unit.id)).size).toBe(UNITS.length)
  })

  test('vaste massa- en volumeverhoudingen', () => {
    expect(amountInBaseUnit(2, 'kg', 'g')).toBe(2000)
    expect(amountInBaseUnit(1.5, 'l', 'ml')).toBe(1500)
    expect(amountInBaseUnit(2, 'tl', 'ml')).toBe(10)
    expect(amountInBaseUnit(2, 'el', 'ml')).toBe(30)
    expect(amountInBaseUnit(0, 'g', 'g')).toBe(0)
    expect(amountInBaseUnit(2, 'stuk', 'stuk')).toBe(2)
  })

  test('ontbrekende omrekeningen blijven onbekend, ook bij verschillende aantaleenheden', () => {
    expect(amountInBaseUnit(1, 'stuk', 'g')).toBeNull()
    expect(amountInBaseUnit(1, 'blik', 'stuk')).toBeNull()
    expect(amountInBaseUnit(1, 'g', 'ml')).toBeNull()
  })

  test('ingrediëntfactoren voor containers en dichtheid werken in beide families', () => {
    expect(amountInBaseUnit(2, 'blik', 'g', [{ unit: 'blik', factor: 400 }])).toBe(800)
    const oil = canonicalConversion('g', 'l', 900)
    expect(oil).toEqual({ unit: 'ml', factor: 0.9 })
    expect(amountInBaseUnit(1, 'l', 'g', [oil])).toBe(900)
    expect(amountInBaseUnit(2, 'el', 'g', [oil])).toBe(27)
    expect(amountInBaseUnit(0.5, 'kg', 'stuk', [{ unit: 'g', factor: 0.01 }])).toBe(5)
  })

  test.each(['snuf', 'handje', 'scheut'] as const)('%s wordt nooit exact omgerekend', (unit) => {
    expect(amountInBaseUnit(1, unit, 'g', [{ unit, factor: 10 }])).toBeNull()
    expect(() => canonicalConversion('g', unit, 10)).toThrow(Invalid)
  })

  test.each([-1, NaN, Infinity, 1e10])('weigert een ongeldige hoeveelheid %s', (amount) => {
    expect(() => amountInBaseUnit(amount, 'g', 'g')).toThrow(Invalid)
  })

  test('onbekende eenheden en afwijkende standaardfactoren zijn niet toegestaan', () => {
    expect(() => amountInBaseUnit(1, 'onbekend' as Unit, 'g')).toThrow(Invalid)
    expect(() => canonicalConversion('g', 'kg', 100)).toThrow(Invalid)
    expect(() => canonicalConversion('g', 'blik', 0)).toThrow(Invalid)
  })
})
