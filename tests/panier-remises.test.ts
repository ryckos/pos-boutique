import { describe, expect, it } from 'vitest'
import type { ArticleCatalogue } from '../src/shared/types'
import {
  ajouterArticle,
  panierVide,
  reducteurPanier,
  sousTotal,
  totalPanier,
  totalRemises,
  totalRemisesAvec,
  versLignesVente,
  versPanierClient,
  type ActionPanier,
  type Panier
} from '../src/renderer/src/modules/caisse/panier'
import { mettreEnAttente, reprendre, etatCaisseInitial } from '../src/renderer/src/modules/caisse/attente'

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
const tomateUnite = article({ conditionnementId: 1 })
const carton = article({
  conditionnementId: 3,
  designation: 'Tomate concentrée — Carton de 24',
  conditionnement: 'Carton de 24',
  quantiteBase: 24,
  prixVente: 7500
})
const baguette = article({
  conditionnementId: 4,
  produitId: 1,
  designation: 'Baguette',
  prixVente: 300,
  tauxTva: 0
})

/** Carton 7 500 + 2 unités 700 + baguette 300 = 8 500 F, comme la vente de démo. */
const demo = (): Panier => [carton, tomateUnite, tomateUnite, baguette].reduce(ajouterArticle, panierVide)

const faire = (p: Panier, ...actions: ActionPanier[]): Panier => actions.reduce(reducteurPanier, p)

describe('Panier — remises (règle 6.6)', () => {
  it('500 F sur le carton et 300 F sur le ticket : 8 500 → sous-total 8 000 → total 7 700', () => {
    const p = faire(
      demo(),
      { type: 'remiserLigne', conditionnementId: 3, montant: 500 },
      { type: 'remiserTicket', montant: 300 }
    )
    expect([sousTotal(p), totalPanier(p), totalRemises(p)]).toEqual([8000, 7700, 800])
    expect(versLignesVente(p)).toEqual([
      { conditionnementId: 3, quantite: 1, remise: 500 },
      { conditionnementId: 1, quantite: 2 },
      { conditionnementId: 4, quantite: 1 }
    ])
    expect(versPanierClient(p)).toMatchObject({ total: 7700, remiseTicket: 300 })
    expect(versPanierClient(p).lignes[0]).toEqual({
      designation: 'Tomate concentrée — Carton de 24',
      quantite: 1,
      total: 7000,
      remise: 500
    })
  })

  it('une remise ne dépasse jamais sa ligne, ni le ticket', () => {
    const p = faire(demo(), { type: 'remiserLigne', conditionnementId: 4, montant: 999 })
    expect(p.lignes[2].remise).toBe(300)
    expect(totalPanier(faire(demo(), { type: 'remiserTicket', montant: 99999 }))).toBe(0)
  })

  it('baisser la quantité ramène la remise au montant de la ligne, puis la remise du ticket', () => {
    const p = faire(
      demo(),
      { type: 'remiserLigne', conditionnementId: 1, montant: 700 },
      { type: 'decrementer', conditionnementId: 1 }
    )
    expect(p.lignes[1]).toMatchObject({ quantite: 1, remise: 350 })
  })

  it('changer de conditionnement efface la remise de la ligne', () => {
    const p = faire(
      demo(),
      { type: 'remiserLigne', conditionnementId: 1, montant: 100 },
      { type: 'changerConditionnement', ancienId: 1, article: carton }
    )
    expect(p.lignes.map((l) => [l.article.conditionnementId, l.quantite, l.remise ?? 0])).toEqual([
      [3, 3, 0],
      [4, 1, 0]
    ])
  })

  it('total des remises si l’on modifiait une remise (pour le plafond)', () => {
    const p = faire(
      demo(),
      { type: 'remiserLigne', conditionnementId: 3, montant: 500 },
      { type: 'remiserTicket', montant: 300 }
    )
    expect(totalRemisesAvec(p, 3, 200)).toBe(500)
    expect(totalRemisesAvec(p, null, 0)).toBe(500)
    expect(totalRemisesAvec(p, 4, 100)).toBe(900)
  })

  it('vider le ticket efface remises et accord du gérant', () => {
    const p = faire(
      demo(),
      { type: 'remiserTicket', montant: 300 },
      { type: 'accorder', accord: { jeton: 'j', gerant: 'Kossi', montantMax: 300 } }
    )
    expect(p.accord?.gerant).toBe('Kossi')
    expect(faire(p, { type: 'vider' })).toEqual(panierVide)
    // Supprimer la dernière ligne aussi.
    const seul = faire(
      faire(panierVide, { type: 'ajouter', article: baguette }),
      { type: 'remiserTicket', montant: 100 },
      { type: 'supprimer', conditionnementId: 4 }
    )
    expect(seul).toEqual(panierVide)
  })

  it('un ticket mis en attente garde ses remises et son accord', () => {
    const courant = faire(
      demo(),
      { type: 'remiserTicket', montant: 300 },
      { type: 'accorder', accord: { jeton: 'j', gerant: 'Kossi', montantMax: 300 } }
    )
    const repris = reprendre(mettreEnAttente({ ...etatCaisseInitial, courant }, 0), 1, 0).courant
    expect([totalPanier(repris), repris.accord?.jeton]).toEqual([8200, 'j'])
  })
})
