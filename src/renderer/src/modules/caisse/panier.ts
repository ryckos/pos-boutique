/**
 * Propriétaire : Dev A.
 *
 * État du panier de la caisse, en fonctions pures (testées dans tests/panier.test.ts).
 * La page les utilise via un useReducer : aucune de ces fonctions ne modifie le panier reçu,
 * ce qui garantit qu'une rafale de scans ne perd ni ne double aucune ligne.
 *
 * Les montants affichés ici ne servent qu'à l'écran : à l'encaissement (A2), le service relit
 * les prix en base et seuls les identifiants de conditionnement et les quantités sont envoyés.
 */
import type { ArticleCatalogue, PanierClient } from '@shared/types'

export interface LignePanier {
  article: ArticleCatalogue
  /** Nombre de conditionnements (ex : 2 cartons), toujours un entier ≥ 1. */
  quantite: number
}

export interface Panier {
  lignes: LignePanier[]
  /** conditionnementId de la ligne sélectionnée (quantité, suppression…), ou null. */
  selection: number | null
}

export const panierVide: Panier = { lignes: [], selection: null }

/**
 * Même conditionnement = même ligne (règle 6.2). Un carton et une unité du même produit restent
 * deux lignes distinctes, car leurs prix sont libres. La ligne touchée devient la sélection.
 */
export function ajouterArticle(panier: Panier, article: ArticleCatalogue): Panier {
  const id = article.conditionnementId
  const existe = panier.lignes.some((l) => l.article.conditionnementId === id)
  const lignes = existe
    ? panier.lignes.map((l) => (l.article.conditionnementId === id ? { ...l, quantite: l.quantite + 1 } : l))
    : [...panier.lignes, { article, quantite: 1 }]
  return { lignes, selection: id }
}

/** Une quantité à zéro (ou moins) supprime la ligne (règle 6.2). */
export function changerQuantite(panier: Panier, conditionnementId: number, quantite: number): Panier {
  const q = Math.trunc(quantite)
  if (q <= 0) return supprimerLigne(panier, conditionnementId)
  return {
    ...panier,
    lignes: panier.lignes.map((l) =>
      l.article.conditionnementId === conditionnementId ? { ...l, quantite: q } : l
    )
  }
}

export function incrementer(panier: Panier, conditionnementId: number): Panier {
  const ligne = trouverLigne(panier, conditionnementId)
  return ligne ? changerQuantite(panier, conditionnementId, ligne.quantite + 1) : panier
}

export function decrementer(panier: Panier, conditionnementId: number): Panier {
  const ligne = trouverLigne(panier, conditionnementId)
  return ligne ? changerQuantite(panier, conditionnementId, ligne.quantite - 1) : panier
}

export function supprimerLigne(panier: Panier, conditionnementId: number): Panier {
  return {
    lignes: panier.lignes.filter((l) => l.article.conditionnementId !== conditionnementId),
    selection: panier.selection === conditionnementId ? null : panier.selection
  }
}

/** Sélectionner une ligne absente ne sélectionne rien. */
export function selectionner(panier: Panier, conditionnementId: number | null): Panier {
  const valide = conditionnementId !== null && trouverLigne(panier, conditionnementId) !== undefined
  return { ...panier, selection: valide ? conditionnementId : null }
}

export function trouverLigne(panier: Panier, conditionnementId: number): LignePanier | undefined {
  return panier.lignes.find((l) => l.article.conditionnementId === conditionnementId)
}

/** Montant TTC de la ligne, en FCFA entiers. */
export function totalLigne(ligne: LignePanier): number {
  return ligne.quantite * ligne.article.prixVente
}

export function totalPanier(panier: Panier): number {
  return panier.lignes.reduce((s, l) => s + totalLigne(l), 0)
}

/** Unités de base qui sortiront du stock pour cette ligne (1 carton de 24 → 24). */
export function quantiteBaseTotale(ligne: LignePanier): number {
  return ligne.quantite * ligne.article.quantiteBase
}

/** Ce que l'écran client affiche. */
export function versPanierClient(panier: Panier): PanierClient {
  return {
    total: totalPanier(panier),
    lignes: panier.lignes.map((l) => ({
      designation: l.article.designation,
      quantite: l.quantite,
      total: totalLigne(l)
    }))
  }
}

export type ActionPanier =
  | { type: 'ajouter'; article: ArticleCatalogue }
  | { type: 'changerQuantite'; conditionnementId: number; quantite: number }
  | { type: 'incrementer'; conditionnementId: number }
  | { type: 'decrementer'; conditionnementId: number }
  | { type: 'supprimer'; conditionnementId: number }
  | { type: 'selectionner'; conditionnementId: number | null }
  | { type: 'vider' }

export function reducteurPanier(panier: Panier, action: ActionPanier): Panier {
  switch (action.type) {
    case 'ajouter':
      return ajouterArticle(panier, action.article)
    case 'changerQuantite':
      return changerQuantite(panier, action.conditionnementId, action.quantite)
    case 'incrementer':
      return incrementer(panier, action.conditionnementId)
    case 'decrementer':
      return decrementer(panier, action.conditionnementId)
    case 'supprimer':
      return supprimerLigne(panier, action.conditionnementId)
    case 'selectionner':
      return selectionner(panier, action.conditionnementId)
    case 'vider':
      return panierVide
  }
}
