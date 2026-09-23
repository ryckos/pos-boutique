import { describe, expect, it } from 'vitest'
import type { ArticleCatalogue } from '../src/shared/types'
import {
  ajouterArticle,
  panierVide,
  totalPanier,
  type Panier
} from '../src/renderer/src/modules/caisse/panier'
import {
  etatCaisseInitial,
  mettreEnAttente,
  reducteurCaisse,
  reprendre,
  resumeAttente,
  type EtatCaisse
} from '../src/renderer/src/modules/caisse/attente'
import { actionClavier } from '../src/renderer/src/modules/caisse/clavier'

function article(conditionnementId: number, designation: string, prixVente: number): ArticleCatalogue {
  return {
    conditionnementId,
    produitId: conditionnementId,
    designation,
    conditionnement: 'Unité',
    quantiteBase: 1,
    prixVente,
    tauxTva: 18,
    suiviPeremption: false,
    coutConditionnement: 0,
    codeBarres: null,
    codePlu: null
  }
}
const tomate = article(1, 'Tomate concentrée', 350)
const jus = article(2, 'Jus d’ananas', 600)
const baguette = article(3, 'Baguette', 300)

const panier = (...articles: ArticleCatalogue[]): Panier => articles.reduce(ajouterArticle, panierVide)
const avecCourant = (etat: EtatCaisse, p: Panier): EtatCaisse => ({ ...etat, courant: p })
const H10_42 = new Date(2026, 8, 23, 10, 42).getTime()

describe('Tickets en attente', () => {
  it('mettre en attente un ticket de 1 900 F vide le ticket courant', () => {
    const e = mettreEnAttente(avecCourant(etatCaisseInitial, panier(tomate, tomate, jus, jus)), H10_42)
    expect(e.courant).toEqual(panierVide)
    expect(e.attente).toHaveLength(1)
    expect(totalPanier(e.attente[0].panier)).toBe(1900)
    expect(resumeAttente(e.attente[0])).toEqual({ nbArticles: 4, total: 1900, heure: '10:42' })
  })

  it('un ticket vide ne part pas en attente', () => {
    expect(mettreEnAttente(etatCaisseInitial, H10_42)).toBe(etatCaisseInitial)
  })

  it('reprendre le 2e de 3 tickets garde les deux autres dans l’ordre', () => {
    let e = etatCaisseInitial
    for (const a of [tomate, jus, baguette]) e = mettreEnAttente(avecCourant(e, panier(a)), H10_42)
    expect(e.attente.map((t) => t.numero)).toEqual([1, 2, 3])
    e = reprendre(e, 2, H10_42)
    expect(e.courant.lignes[0].article).toBe(jus)
    expect(e.attente.map((t) => t.numero)).toEqual([1, 3])
  })

  it('reprendre alors que le ticket courant est rempli permute les deux', () => {
    let e = mettreEnAttente(avecCourant(etatCaisseInitial, panier(tomate)), H10_42)
    e = reprendre(avecCourant(e, panier(baguette, baguette)), 1, H10_42)
    expect(e.courant.lignes[0].article).toBe(tomate)
    expect(e.attente).toHaveLength(1)
    expect(e.attente[0].numero).toBe(2)
    expect(totalPanier(e.attente[0].panier)).toBe(600)
  })

  it('reprendre un numéro inconnu ne change rien', () => {
    const e = mettreEnAttente(avecCourant(etatCaisseInitial, panier(tomate)), H10_42)
    expect(reprendre(e, 99, H10_42)).toBe(e)
  })

  it('le réducteur applique les actions du panier au ticket courant', () => {
    const e = reducteurCaisse(etatCaisseInitial, {
      type: 'panier',
      action: { type: 'ajouter', article: jus }
    })
    expect(totalPanier(e.courant)).toBe(600)
    expect(e.attente).toHaveLength(0)
  })
})

describe('Raccourcis clavier de la caisse', () => {
  it('associe chaque touche à son action', () => {
    expect(actionClavier('F2')).toBe('rechercher')
    expect(actionClavier('F4')).toBe('encaisser')
    expect(actionClavier('F8')).toBe('mettreEnAttente')
    expect(actionClavier('Delete')).toBe('supprimerLigne')
    expect(actionClavier('Escape')).toBe('fermer')
    expect(actionClavier('+')).toBe('plus')
    expect(actionClavier('-')).toBe('moins')
  })

  it('ignore les chiffres et Entrée envoyés par la douchette', () => {
    for (const t of ['0', '6', 'Enter', 'a', 'F5']) expect(actionClavier(t)).toBeNull()
  })
})
