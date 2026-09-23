import { describe, expect, it } from 'vitest'
import { contrePasser, enregistrerMouvement, stockProduit } from '../src/main/core/mouvements'
import { avecTransaction } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

const TOMATE = 3 // 3e produit de la démo : 72 boîtes

describe('Mouvements de stock', () => {
  it('calcule le stock comme la somme des mouvements', () => {
    const db = baseAvecDemo()
    expect(stockProduit(db, TOMATE)).toBe(72)
    // Vente d'un carton : 24 boîtes sortent
    enregistrerMouvement(db, { produitId: TOMATE, type: 'vente', quantite: -24, coutUnitaire: 250, utilisateurId: 1 })
    expect(stockProduit(db, TOMATE)).toBe(48)
  })

  it('refuse un mouvement dans le mauvais sens', () => {
    const db = baseAvecDemo()
    expect(() =>
      enregistrerMouvement(db, { produitId: TOMATE, type: 'vente', quantite: 5, coutUnitaire: 250, utilisateurId: 1 })
    ).toThrow(/négatif/)
    expect(() =>
      enregistrerMouvement(db, { produitId: TOMATE, type: 'reception', quantite: -5, coutUnitaire: 250, utilisateurId: 1 })
    ).toThrow(/positif/)
  })

  it('annule par contre-passation, une seule fois', () => {
    const db = baseAvecDemo()
    const id = enregistrerMouvement(db, { produitId: TOMATE, type: 'casse', quantite: -2, coutUnitaire: 250, utilisateurId: 1 })
    expect(stockProduit(db, TOMATE)).toBe(70)
    contrePasser(db, id, 'Erreur de saisie', 1)
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(() => contrePasser(db, id, 'Encore', 1)).toThrow(/déjà/)
  })

  it('annule tout en cas d’erreur dans une transaction', () => {
    const db = baseAvecDemo()
    expect(() =>
      avecTransaction(db, () => {
        enregistrerMouvement(db, { produitId: TOMATE, type: 'vente', quantite: -24, coutUnitaire: 250, utilisateurId: 1 })
        throw new Error('panne pendant la vente')
      })
    ).toThrow()
    expect(stockProduit(db, TOMATE)).toBe(72)
  })
})
