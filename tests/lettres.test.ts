import { describe, expect, it } from 'vitest'
import { montantEnLettres, nombreEnLettres } from '../src/main/documents/lettres'

describe('Montant en toutes lettres (A10)', () => {
  it.each([
    [0, 'zéro'],
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt et un'],
    [22, 'vingt-deux'],
    [70, 'soixante-dix'],
    [71, 'soixante et onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [90, 'quatre-vingt-dix'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [101, 'cent un'],
    [200, 'deux cents'],
    [280, 'deux cent quatre-vingts'],
    [1000, 'mille'],
    [1001, 'mille un'],
    [2000, 'deux mille'],
    [10100, 'dix mille cent'],
    [80000, 'quatre-vingt mille'],
    [200000, 'deux cent mille'],
    [1000000, 'un million'],
    [2500000, 'deux millions cinq cent mille'],
    [200000000, 'deux cents millions'],
    [1234567, 'un million deux cent trente-quatre mille cinq cent soixante-sept']
  ])('%i → %s', (n, attendu) => {
    expect(nombreEnLettres(n)).toBe(attendu)
  })

  it('francs CFA, majuscule, singulier', () => {
    expect(montantEnLettres(10100)).toBe('Dix mille cent francs CFA')
    expect(montantEnLettres(1)).toBe('Un franc CFA')
  })

  it('refuse un montant non entier ou négatif', () => {
    expect(() => nombreEnLettres(-1)).toThrow()
    expect(() => nombreEnLettres(1.5)).toThrow()
  })
})
