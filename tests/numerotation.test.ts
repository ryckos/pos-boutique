import { describe, expect, it } from 'vitest'
import { prochainNumero } from '../src/main/core/numerotation'
import { baseDeTest } from './aide'

describe('Numérotation des documents', () => {
  it('produit des numéros séquentiels par préfixe et par année', () => {
    const db = baseDeTest()
    const d = new Date(2026, 8, 22)
    expect(prochainNumero(db, 'T', d)).toBe('T-2026-000001')
    expect(prochainNumero(db, 'T', d)).toBe('T-2026-000002')
    expect(prochainNumero(db, 'RC', d)).toBe('RC-2026-000001')
    expect(prochainNumero(db, 'T', new Date(2027, 0, 1))).toBe('T-2027-000001')
  })
})
