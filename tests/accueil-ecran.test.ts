import { describe, expect, it } from 'vitest'
import type { AlertesAccueil } from '../src/shared/ipc/stock'
import {
  delaiLot,
  depuisQuand,
  detailProduit,
  phrasePeremptions,
  phraseStock,
  pluriel
} from '../src/renderer/src/modules/rapports-ventes/accueil'

const stock = (nbRuptures: number, nbStockBas: number): AlertesAccueil['stock'] => ({
  nbRuptures,
  nbStockBas,
  produits: []
})

const peremptions = (
  nbPerimes: number,
  nbUrgents: number,
  nbProches: number
): AlertesAccueil['peremptions'] => ({
  horizonJours: 30,
  nbPerimes,
  nbUrgents,
  nbProches,
  valeurEnJeu: 0,
  lots: []
})

describe('Tableau de bord d’accueil — phrases (A15)', () => {
  it('pluriel : singulier à 1, pluriel au-delà', () => {
    expect(pluriel(1, 'rupture')).toBe('1 rupture')
    expect(pluriel(3, 'rupture')).toBe('3 ruptures')
    expect(pluriel(2, 'stock bas', 'stocks bas')).toBe('2 stocks bas')
    expect(pluriel(0, 'ticket')).toBe('0 ticket')
  })

  it('stock : ruptures et stocks bas, ou « Aucune alerte »', () => {
    expect(phraseStock(stock(1, 4))).toBe('1 rupture · 4 stocks bas')
    expect(phraseStock(stock(0, 2))).toBe('2 stocks bas')
    expect(phraseStock(stock(3, 0))).toBe('3 ruptures')
    expect(phraseStock(stock(0, 0))).toBe('Aucune alerte de stock')
  })

  it('produit en alerte : rupture avec son stock (peut être négatif), stock bas avec son seuil', () => {
    const base = { produitId: 1, nom: 'Lait', unite: 'boîte', seuil: 10 }
    expect(detailProduit({ ...base, stock: 0, niveau: 'rupture' })).toBe('En rupture (0 boîte)')
    expect(detailProduit({ ...base, stock: -2, niveau: 'rupture' })).toMatch(/^En rupture \(.2 boîte\)$/)
    expect(detailProduit({ ...base, stock: 4, niveau: 'stock_bas' })).toBe('4 boîte (seuil 10)')
  })

  it('péremptions : périmés, urgents, à surveiller', () => {
    expect(phrasePeremptions(peremptions(2, 1, 4))).toBe('2 périmés · 1 urgent · 4 à surveiller')
    expect(phrasePeremptions(peremptions(0, 0, 0))).toBe('Aucun lot proche de sa date')
  })

  it('délai d’un lot', () => {
    expect(delaiLot({ joursRestants: -2 })).toBe('Périmé depuis 2 jours')
    expect(delaiLot({ joursRestants: -1 })).toBe('Périmé depuis 1 jour')
    expect(delaiLot({ joursRestants: 0 })).toBe('Périme aujourd’hui')
    expect(delaiLot({ joursRestants: 1 })).toBe('Périme demain')
    expect(delaiLot({ joursRestants: 5 })).toBe('Périme dans 5 jours')
  })

  it('caisse ouverte : heure le jour même, date si elle date d’avant (probablement oubliée)', () => {
    expect(depuisQuand('2026-11-01 07:45:12', '2026-11-01')).toEqual({
      texte: 'depuis 07 h 45',
      ancienne: false
    })
    expect(depuisQuand('2026-10-31 18:05:00', '2026-11-01')).toEqual({
      texte: 'depuis le 31/10 à 18 h 05',
      ancienne: true
    })
  })
})
