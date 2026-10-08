import { describe, expect, it } from 'vitest'
import type { LigneInventaire, ProduitInventaire } from '../src/shared/ipc/inventaires'
import {
  champsDepuisProduit,
  ecartPrevu,
  estimation,
  filtrer,
  manque,
  versSaisie
} from '../src/renderer/src/modules/inventaires/saisieInventaire'

const tomate = (stock = 41, ligne: Partial<LigneInventaire> | null = null): ProduitInventaire => ({
  produitId: 3,
  nom: 'Tomate concentrée',
  rayon: 'Alimentation',
  unite: 'piece',
  stock,
  cump: 250,
  conditionnements: [
    { id: 3, nom: 'Carton de 24', quantiteBase: 24 },
    { id: 2, nom: 'Lot de 3', quantiteBase: 3 },
    { id: 1, nom: 'Unité', quantiteBase: 1 }
  ],
  ligne: ligne && {
    produitId: 3,
    quantiteTheorique: stock,
    quantiteComptee: stock,
    ecart: 0,
    detail: [],
    motif: null,
    commentaire: null,
    compteLe: '2026-10-10 09:00:00',
    valeurEcart: 0,
    ...ligne
  }
})

describe('Saisie d’un comptage d’inventaire', () => {
  it('1 carton + 5 lots + 2 unités = 41 : écart nul, rien ne manque', () => {
    const c = { nombres: { 3: '1', 2: '5', 1: '2' }, motif: '' as const, commentaire: '' }
    expect(ecartPrevu(tomate(), c)).toBe(0)
    expect(manque(tomate(), c)).toBeNull()
    expect(versSaisie(7, tomate(), c)).toEqual({
      inventaireId: 7,
      produitId: 3,
      comptage: [
        { conditionnementId: 3, nombre: 1 },
        { conditionnementId: 2, nombre: 5 },
        { conditionnementId: 1, nombre: 2 }
      ],
      motif: null,
      commentaire: null
    })
  })

  it('un écart exige un motif ; le commentaire part avec lui', () => {
    const c = { nombres: { 1: '39' }, motif: '' as const, commentaire: ' vol présumé ' }
    expect(ecartPrevu(tomate(), c)).toBe(-2)
    expect(manque(tomate(), c)).toBe('Il y a un écart : choisissez-en le motif')
    const s = versSaisie(7, tomate(), { ...c, motif: 'vol' })
    expect(s.motif).toBe('vol')
    expect(s.commentaire).toBe('vol présumé')
  })

  it('toutes les cases vides ne valent pas zéro ; un 0 tapé, si', () => {
    expect(manque(tomate(), { nombres: {}, motif: '', commentaire: '' })).toMatch(/tapez 0/)
    expect(ecartPrevu(tomate(), { nombres: { 1: '0' }, motif: '', commentaire: '' })).toBe(-41)
  })

  it('une case illisible bloque', () => {
    expect(manque(tomate(), { nombres: { 1: 'abc' }, motif: '', commentaire: '' })).toMatch(/illisible/)
  })

  it('un recomptage repart du comptage enregistré', () => {
    const p = tomate(41, {
      detail: [{ conditionnementId: 3, conditionnement: 'Carton de 24', nombre: 1 }],
      motif: 'casse',
      commentaire: 'boîtes bombées'
    })
    expect(champsDepuisProduit(p)).toEqual({
      nombres: { 3: '1' },
      motif: 'casse',
      commentaire: 'boîtes bombées'
    })
  })
})

describe('Estimation et filtres', () => {
  const savon: ProduitInventaire = {
    ...tomate(29, { quantiteComptee: 27, ecart: -2, motif: 'vol' }),
    produitId: 7,
    nom: 'Savon de ménage',
    cump: 150
  }
  const produits = [tomate(41, {}), savon, { ...tomate(), produitId: 1, nom: 'Riz parfumé' }]

  it('manquants estimés au CUMP : 2 savons × 150 = 300', () => {
    expect(estimation(produits)).toEqual({ nbComptes: 2, nbEcarts: 1, manquants: 300, surplus: 0 })
  })

  it('filtre à compter, comptés, écarts, et recherche sans accents', () => {
    expect(filtrer(produits, 'a_compter', '').map((p) => p.nom)).toEqual(['Riz parfumé'])
    expect(filtrer(produits, 'comptes', '')).toHaveLength(2)
    expect(filtrer(produits, 'ecarts', '').map((p) => p.nom)).toEqual(['Savon de ménage'])
    expect(filtrer(produits, 'tous', 'MENAGE').map((p) => p.nom)).toEqual(['Savon de ménage'])
  })
})
