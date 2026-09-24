import { describe, expect, it } from 'vitest'
import type { ArticleCatalogue } from '../src/shared/types'
import {
  SANS_RAYON,
  TOUT,
  afficherOnglets,
  filtrerGrille,
  ongletsDeGrille
} from '../src/renderer/src/modules/caisse/grille'

function bouton(conditionnementId: number, designation: string, categorie: string | null): ArticleCatalogue {
  return {
    conditionnementId,
    produitId: conditionnementId,
    designation,
    conditionnement: 'Unité',
    quantiteBase: 1,
    prixVente: 100,
    tauxTva: 18,
    suiviPeremption: false,
    coutConditionnement: 0,
    codeBarres: null,
    codePlu: null,
    categorie
  }
}

// Boutons de la grille de démo, dans l'ordre du gérant.
const lot = bouton(1, 'Tomate concentrée 70 g — Lot de 3', 'Alimentation')
const carton = bouton(2, 'Tomate concentrée 70 g — Carton de 24', 'Alimentation')
const baguette = bouton(3, 'Baguette', 'Boulangerie')
const pack = bouton(4, 'Jus d’ananas 1 L — Pack de 6', 'Boissons')
const gari = bouton(5, 'Gari (sachet)', 'Alimentation')
const demo = [lot, carton, baguette, pack, gari]

describe('Onglets de la grille de caisse', () => {
  it('grille de démo : Tout, puis les rayons par ordre alphabétique', () => {
    expect(ongletsDeGrille(demo)).toEqual([TOUT, 'Alimentation', 'Boissons', 'Boulangerie'])
    expect(afficherOnglets(demo)).toBe(true)
  })

  it('les articles sans rayon sont regroupés sous « Sans rayon », en dernier', () => {
    const divers = bouton(6, 'Divers', null)
    expect(ongletsDeGrille([divers, ...demo]).at(-1)).toBe(SANS_RAYON)
    expect(filtrerGrille([divers, ...demo], SANS_RAYON)).toEqual([divers])
  })

  it('le filtre Boulangerie ne garde que la baguette', () => {
    expect(filtrerGrille(demo, 'Boulangerie')).toEqual([baguette])
  })

  it('le filtre garde l’ordre choisi par le gérant', () => {
    expect(filtrerGrille(demo, 'Alimentation')).toEqual([lot, carton, gari])
    expect(filtrerGrille(demo, TOUT)).toBe(demo)
  })

  it('trie les rayons accentués à leur place : Épicerie entre Boulangerie et Fruits', () => {
    const rayons = ['Fruits', 'Épicerie', 'Boulangerie'].map((r, i) => bouton(10 + i, r, r))
    expect(ongletsDeGrille(rayons)).toEqual([TOUT, 'Boulangerie', 'Épicerie', 'Fruits'])
  })

  it('un seul rayon : pas d’onglets', () => {
    expect(afficherOnglets([lot, carton, gari])).toBe(false)
    expect(afficherOnglets([])).toBe(false)
  })
})
