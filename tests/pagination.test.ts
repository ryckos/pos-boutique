import { describe, expect, it } from 'vitest'
import { tranche } from '@renderer/lib/pagination'

describe('pagination des tableaux', () => {
  it('découpe 45 lignes en pages de 20', () => {
    expect(tranche(45, 1, 20)).toEqual({ page: 1, nbPages: 3, debut: 0, fin: 20, total: 45 })
    expect(tranche(45, 3, 20)).toEqual({ page: 3, nbPages: 3, debut: 40, fin: 45, total: 45 })
  })

  it('ramène une page hors limites sur la dernière ou la première', () => {
    // Après un filtre qui réduit la liste, la page 5 n'existe plus.
    expect(tranche(45, 5, 20).page).toBe(3)
    expect(tranche(45, 0, 20).page).toBe(1)
    expect(tranche(45, Number.NaN, 20).page).toBe(1)
  })

  it('une liste vide a une page, sans ligne', () => {
    expect(tranche(0, 1, 20)).toEqual({ page: 1, nbPages: 1, debut: 0, fin: 0, total: 0 })
  })

  it('une liste juste pleine ne crée pas de page vide', () => {
    expect(tranche(40, 3, 20)).toMatchObject({ page: 2, nbPages: 2, debut: 20, fin: 40 })
  })
})
