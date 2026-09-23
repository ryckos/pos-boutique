import { describe, expect, it } from 'vitest'
import { connexion, creerUtilisateur } from '../src/main/modules/auth/service'
import { hacherPin, verifierPin } from '../src/main/core/securite'
import { baseAvecDemo } from './aide'

describe('Authentification', () => {
  it('ne stocke jamais le PIN en clair', () => {
    const h = hacherPin('1234')
    expect(h).not.toContain('1234')
    expect(verifierPin('1234', h)).toBe(true)
    expect(verifierPin('4321', h)).toBe(false)
  })

  it('connecte avec le bon code et refuse un mauvais code', () => {
    const db = baseAvecDemo()
    expect(connexion(db, '0000')).toMatchObject({ nom: 'Afi', role: 'caissier' })
    expect(() => connexion(db, '9999')).toThrow('Code incorrect')
    expect(() => connexion(db, '12')).toThrow(/4 chiffres/)
  })

  it('refuse deux comptes avec le même code', () => {
    expect(() => creerUtilisateur(baseAvecDemo(), 'Doublon', '1234', 'caissier')).toThrow(/déjà utilisé/)
  })
})
