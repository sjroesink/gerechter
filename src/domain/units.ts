import { Invalid } from './core/errors'

export const BASE_UNITS = ['g', 'ml', 'stuk'] as const
export type BaseUnit = (typeof BASE_UNITS)[number]
export const UNIT_IDS = [
  'g',
  'kg',
  'ml',
  'l',
  'tl',
  'el',
  'stuk',
  'teen',
  'blik',
  'pak',
  'bos',
  'plak',
  'snuf',
  'handje',
  'scheut',
] as const
export type Unit = (typeof UNIT_IDS)[number]
export type Dimension = 'mass' | 'volume' | 'count' | 'vague'
type MeasurementUnit = { id: Unit; label: string; dimension: Dimension; factor: number | null }

export const UNITS: readonly MeasurementUnit[] = [
  { id: 'g', label: 'gram', dimension: 'mass', factor: 1 },
  { id: 'kg', label: 'kilogram', dimension: 'mass', factor: 1000 },
  { id: 'ml', label: 'milliliter', dimension: 'volume', factor: 1 },
  { id: 'l', label: 'liter', dimension: 'volume', factor: 1000 },
  { id: 'tl', label: 'theelepel', dimension: 'volume', factor: 5 },
  { id: 'el', label: 'eetlepel', dimension: 'volume', factor: 15 },
  { id: 'stuk', label: 'stuk', dimension: 'count', factor: null },
  { id: 'teen', label: 'teen', dimension: 'count', factor: null },
  { id: 'blik', label: 'blik', dimension: 'count', factor: null },
  { id: 'pak', label: 'pak', dimension: 'count', factor: null },
  { id: 'bos', label: 'bos', dimension: 'count', factor: null },
  { id: 'plak', label: 'plak', dimension: 'count', factor: null },
  { id: 'snuf', label: 'snuf', dimension: 'vague', factor: null },
  { id: 'handje', label: 'handje', dimension: 'vague', factor: null },
  { id: 'scheut', label: 'scheut', dimension: 'vague', factor: null },
]

export function measurementUnit(id: string): MeasurementUnit {
  const unit = UNITS.find((unit) => unit.id === id)
  if (!unit) throw new Invalid('Onbekende eenheid.')
  return unit
}

export type Conversion = { unit: Unit; factor: number }

/** Sla massa-/volumefactoren per gram of milliliter op om tegenstrijdige verhoudingen te voorkomen. */
export function canonicalConversion(baseUnit: BaseUnit, from: Unit, factor: number): Conversion {
  const source = measurementUnit(from)
  const base = measurementUnit(baseUnit)
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1e9)
    throw new Invalid('Vul een positieve omrekenfactor in van maximaal 1 miljard.')
  if (source.dimension === 'vague') throw new Invalid('Vage eenheden kunnen niet exact worden omgerekend.')
  if (from === baseUnit || (source.factor !== null && source.dimension === base.dimension)) {
    throw new Invalid('Voor deze eenheid ligt de omrekening al vast.')
  }
  return {
    unit: source.dimension === 'mass' ? 'g' : source.dimension === 'volume' ? 'ml' : from,
    factor: factor / (source.factor ?? 1),
  }
}

/** null betekent: onbekend, dus apart houden en niet automatisch afboeken. */
export function amountInBaseUnit(
  amount: number,
  from: Unit,
  baseUnit: BaseUnit,
  conversions: readonly Conversion[] = [],
): number | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e9)
    throw new Invalid('Vul een hoeveelheid in tussen 0 en 1 miljard.')
  const source = measurementUnit(from)
  const base = measurementUnit(baseUnit)
  if (source.dimension === 'vague') return null
  if (from === baseUnit) return amount
  if (source.factor !== null && source.dimension === base.dimension) return amount * source.factor
  const canonical = source.dimension === 'mass' ? 'g' : source.dimension === 'volume' ? 'ml' : from
  const conversion = conversions.find((entry) => entry.unit === canonical)
  if (!conversion) return null
  const result = amount * (source.factor ?? 1) * conversion.factor
  if (!Number.isFinite(result)) throw new Invalid('De omgerekende hoeveelheid is te groot.')
  return result
}
