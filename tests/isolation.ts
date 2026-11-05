import { expect } from 'vitest'
import { NotFound } from '~/domain/core'

/**
 * Afschermingscontrole voor domeinfuncties: een actie vanuit een ander huishouden moet het gegeven
 * behandelen als niet bestaand (NotFound) en mag niets wijzigen.
 */
export async function expectHidden(action: Promise<unknown>): Promise<void> {
  await expect(action).rejects.toBeInstanceOf(NotFound)
}

export { twoHouseholds } from './fixtures'
