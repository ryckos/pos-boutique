import { describe, expect, it } from 'vitest'
import type { ArticleCatalogue } from '../src/shared/types'
import {
  ajouterArticle,
  changerConditionnement,
  changerQuantite,
  decrementer,
  incrementer,
  panierVide,
  quantiteBaseTotale,
  reducteurPanier,
  selectionner,
  supprimerLigne,
  totalPanier,
  versPanierClient,
  type Panier
} from '../src/renderer/src/modules/caisse/panier'

// Articles du scénario de référence (lundi 10 h), tels que les renvoie catalogue:rechercherCode.
function article(
  a: Partial<ArticleCatalogue> & Pick<ArticleCatalogue, 'conditionnementId'>
): ArticleCatalogue {
  return {
    produitId: 3,
    designation: 'Tomate concentrée',
    conditionnement: 'Unité',
    quantiteBase: 1,
    prixVente: 350,
    tauxTva: 18,
    suiviPeremption: false,
    coutConditionnement: 250,
    codeBarres: null,
    codePlu: null,
    ...a
  }
}
const tomateUnite = article({ conditionnementId: 1, codeBarres: '6181000000042' })
const tomateLot = article({
  conditionnementId: 2,
  designation: 'Tomate concentrée — Lot de 3',
  conditionnement: 'Lot de 3',
  quantiteBase: 3,
  prixVente: 1000,
  coutConditionnement: 750
})
const tomateCarton = article({
  conditionnementId: 3,
  designation: 'Tomate concentrée — Carton de 24',
  conditionnement: 'Carton de 24',
  quantiteBase: 24,
  prixVente: 7500,
  coutConditionnement: 6000
})
const baguette = article({
  conditionnementId: 4,
  produitId: 1,
  designation: 'Baguette',
  prixVente: 300,
  tauxTva: 0,
  codePlu: '101'
})
const jus = article({
  conditionnementId: 5,
  produitId: 2,
  designation: 'Jus d’ananas Fruity 1L',
  prixVente: 600
})

function avec(...articles: ArticleCatalogue[]): Panier {
  return articles.reduce(ajouterArticle, panierVide)
}

describe('Panier de la caisse', () => {
  it('scanner deux fois le même conditionnement augmente la quantité de la ligne', () => {
    const p = avec(tomateUnite, tomateUnite)
    expect(p.lignes).toHaveLength(1)
    expect(p.lignes[0].quantite).toBe(2)
    expect(totalPanier(p)).toBe(700)
  })

  it('une unité et un carton du même produit restent deux lignes distinctes', () => {
    const p = avec(tomateUnite, tomateCarton)
    expect(p.lignes.map((l) => l.article.conditionnementId)).toEqual([1, 3])
  })

  it('la vente mixte du scénario de référence totalise 10 100 F', () => {
    const p = avec(tomateCarton, tomateLot, tomateUnite, tomateUnite, baguette, jus)
    expect(p.lignes).toHaveLength(5)
    expect(totalPanier(p)).toBe(10100)
  })

  it('la tomate sortie du stock vaut 24 + 3 + 2 = 29 boîtes', () => {
    const p = avec(tomateCarton, tomateLot, tomateUnite, tomateUnite, baguette, jus)
    const tomate = p.lignes
      .filter((l) => l.article.produitId === 3)
      .reduce((s, l) => s + quantiteBaseTotale(l), 0)
    expect(tomate).toBe(29)
  })

  it('la ligne ajoutée ou incrémentée devient la sélection', () => {
    let p = avec(tomateUnite, jus)
    expect(p.selection).toBe(5)
    p = ajouterArticle(p, tomateUnite)
    expect(p.selection).toBe(1)
  })

  it('une quantité à zéro supprime la ligne et lève la sélection', () => {
    const p = changerQuantite(avec(tomateUnite, jus), 5, 0)
    expect(p.lignes.map((l) => l.article.conditionnementId)).toEqual([1])
    expect(p.selection).toBeNull()
  })

  it('décrémenter une ligne à 1 la supprime', () => {
    const p = decrementer(avec(jus), 5)
    expect(p.lignes).toHaveLength(0)
    expect(totalPanier(p)).toBe(0)
  })

  it('incrémenter et changer la quantité donnent des entiers', () => {
    let p = incrementer(avec(tomateCarton), 3)
    expect(p.lignes[0].quantite).toBe(2)
    p = changerQuantite(p, 3, 4.7)
    expect(p.lignes[0].quantite).toBe(4)
    expect(totalPanier(p)).toBe(30000)
  })

  it('supprimer une autre ligne conserve la sélection', () => {
    let p = selectionner(avec(tomateUnite, jus, baguette), 1)
    p = supprimerLigne(p, 5)
    expect(p.selection).toBe(1)
    expect(p.lignes).toHaveLength(2)
  })

  it('sélectionner une ligne absente ne sélectionne rien', () => {
    expect(selectionner(avec(jus), 99).selection).toBeNull()
  })

  it('20 scans successifs du même code donnent une ligne de quantité 20', () => {
    const p = avec(...Array.from({ length: 20 }, () => tomateUnite))
    expect(p.lignes).toHaveLength(1)
    expect(p.lignes[0].quantite).toBe(20)
    expect(totalPanier(p)).toBe(7000)
  })

  it('ne modifie jamais le panier reçu', () => {
    const avant = avec(tomateUnite)
    const copie = structuredClone(avant)
    ajouterArticle(avant, tomateUnite)
    changerQuantite(avant, 1, 5)
    supprimerLigne(avant, 1)
    expect(avant).toEqual(copie)
  })

  it('changer 2 unités de tomate en lot de 3 donne 2 lots à 2 000 F', () => {
    const p = changerConditionnement(avec(tomateUnite, tomateUnite), 1, tomateLot)
    expect(p.lignes).toHaveLength(1)
    expect(p.lignes[0].article.conditionnementId).toBe(2)
    expect(p.lignes[0].quantite).toBe(2)
    expect(totalPanier(p)).toBe(2000)
  })

  it('changer une unité en carton déjà au ticket fusionne : 2 cartons, 15 000 F', () => {
    const p = changerConditionnement(avec(tomateCarton, jus, tomateUnite), 1, tomateCarton)
    expect(p.lignes.map((l) => [l.article.conditionnementId, l.quantite])).toEqual([
      [3, 2],
      [5, 1]
    ])
    expect(totalPanier(p)).toBe(15600)
    expect(totalPanier({ ...p, lignes: p.lignes.slice(0, 1) })).toBe(15000)
  })

  it('le changement de conditionnement garde la place de la ligne et la sélectionne', () => {
    const p = changerConditionnement(selectionner(avec(tomateUnite, jus), 5), 1, tomateCarton)
    expect(p.lignes.map((l) => l.article.conditionnementId)).toEqual([3, 5])
    expect(p.selection).toBe(3)
  })

  it('refuse de changer vers le conditionnement d’un autre produit', () => {
    const avant = avec(tomateUnite)
    expect(changerConditionnement(avant, 1, jus)).toBe(avant)
  })

  it('le réducteur vide le panier et prépare l’écran client', () => {
    let p = reducteurPanier(panierVide, { type: 'ajouter', article: tomateLot })
    p = reducteurPanier(p, { type: 'incrementer', conditionnementId: 2 })
    expect(versPanierClient(p)).toEqual({
      total: 2000,
      lignes: [{ designation: 'Tomate concentrée — Lot de 3', quantite: 2, total: 2000 }]
    })
    expect(reducteurPanier(p, { type: 'vider' })).toEqual(panierVide)
  })
})
