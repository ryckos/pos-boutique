/**
 * Propriétaire : Dev A.
 *
 * État du panier de la caisse, en fonctions pures (testées dans tests/panier.test.ts).
 * La page les utilise via un useReducer : aucune de ces fonctions ne modifie le panier reçu,
 * ce qui garantit qu'une rafale de scans ne perd ni ne double aucune ligne.
 *
 * Les montants affichés ici ne servent qu'à l'écran : à l'encaissement (A2), le service relit
 * les prix en base ; seuls les identifiants de conditionnement, les quantités et les remises sont
 * envoyés.
 *
 * Remises (règle 6.6, A5) : une remise ne dépasse jamais sa ligne ni le ticket. Quand une quantité
 * baisse, la remise est ramenée au nouveau montant de la ligne ; changer de conditionnement l'efface
 * (le prix n'est plus le même) ; remises et accord du gérant tombent avec un ticket vidé.
 */
import type { AccordRemiseDonne } from '@shared/ipc/caisse'
import type { PromotionEnCours } from '@shared/ipc/promotions'
import { prixPromotionnel } from '@shared/promotions'
import type { ArticleCatalogue, PanierClient } from '@shared/types'

export interface LignePanier {
  article: ArticleCatalogue
  /** Nombre de conditionnements (ex : 2 cartons), toujours un entier ≥ 1. */
  quantite: number
  /** Remise sur la ligne en FCFA ; absente = 0. */
  remise?: number
}

export interface Panier {
  lignes: LignePanier[]
  /** conditionnementId de la ligne sélectionnée (quantité, suppression…), ou null. */
  selection: number | null
  /** Remise sur le ticket entier en FCFA ; absente = 0. */
  remiseGlobale?: number
  /** Accord du gérant pour dépasser le plafond de la caissière (un jeton, jamais le code). */
  accord?: AccordRemiseDonne
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
  return { ...panier, lignes, selection: id }
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
    ...panier,
    lignes: panier.lignes.filter((l) => l.article.conditionnementId !== conditionnementId),
    selection: panier.selection === conditionnementId ? null : panier.selection
  }
}

/**
 * Parade au piège du code unité lu à travers le film d'un carton (règle 2.3) : la ligne change de
 * conditionnement en gardant son nombre de conditionnements (1 unité → 1 carton). Si le nouveau
 * conditionnement est déjà au ticket, les deux lignes fusionnent. Refusé si le produit diffère.
 * La remise de la ligne déplacée est effacée : elle avait été pensée pour un autre prix.
 */
export function changerConditionnement(panier: Panier, ancienId: number, nouvel: ArticleCatalogue): Panier {
  const ancienne = trouverLigne(panier, ancienId)
  const nouvelId = nouvel.conditionnementId
  if (!ancienne || nouvelId === ancienId || nouvel.produitId !== ancienne.article.produitId) return panier
  const existante = trouverLigne(panier, nouvelId)
  const lignes = existante
    ? panier.lignes
        .filter((l) => l.article.conditionnementId !== ancienId)
        .map((l) =>
          l.article.conditionnementId === nouvelId ? { ...l, quantite: l.quantite + ancienne.quantite } : l
        )
    : panier.lignes.map((l) =>
        l.article.conditionnementId === ancienId ? { article: nouvel, quantite: ancienne.quantite } : l
      )
  return { ...panier, lignes, selection: nouvelId }
}

/** Sélectionner une ligne absente ne sélectionne rien. */
export function selectionner(panier: Panier, conditionnementId: number | null): Panier {
  const valide = conditionnementId !== null && trouverLigne(panier, conditionnementId) !== undefined
  return { ...panier, selection: valide ? conditionnementId : null }
}

export function trouverLigne(panier: Panier, conditionnementId: number): LignePanier | undefined {
  return panier.lignes.find((l) => l.article.conditionnementId === conditionnementId)
}

/** Montant TTC de la ligne avant remise, en FCFA entiers. */
export function brutLigne(ligne: LignePanier): number {
  return ligne.quantite * ligne.article.prixVente
}

/** Montant TTC de la ligne, remise déduite. */
export function totalLigne(ligne: LignePanier): number {
  return brutLigne(ligne) - (ligne.remise ?? 0)
}

/** Somme des lignes (remises de ligne déduites), avant la remise sur le ticket. */
export function sousTotal(panier: Panier): number {
  return panier.lignes.reduce((s, l) => s + totalLigne(l), 0)
}

export function totalPanier(panier: Panier): number {
  return sousTotal(panier) - (panier.remiseGlobale ?? 0)
}

/** Total des remises du ticket : c'est lui que le plafond de la caissière limite. */
export function totalRemises(panier: Panier): number {
  return panier.lignes.reduce((s, l) => s + (l.remise ?? 0), 0) + (panier.remiseGlobale ?? 0)
}

/** Total des remises si l'on donnait `montant` à la ligne, ou au ticket si `conditionnementId` est null. */
export function totalRemisesAvec(panier: Panier, conditionnementId: number | null, montant: number): number {
  const actuelle =
    conditionnementId === null
      ? (panier.remiseGlobale ?? 0)
      : (trouverLigne(panier, conditionnementId)?.remise ?? 0)
  return totalRemises(panier) - actuelle + montant
}

/** Remise sur une ligne : entière, entre 0 et le montant de la ligne. */
export function remiserLigne(panier: Panier, conditionnementId: number, montant: number): Panier {
  const m = Math.max(0, Math.trunc(montant))
  return {
    ...panier,
    lignes: panier.lignes.map((l) =>
      l.article.conditionnementId === conditionnementId ? { ...l, remise: Math.min(m, brutLigne(l)) } : l
    )
  }
}

/** Remise sur le ticket : entière, au plus le sous-total (ramenée par normaliser). */
export function remiserTicket(panier: Panier, montant: number): Panier {
  return { ...panier, remiseGlobale: Math.max(0, Math.trunc(montant)) }
}

/**
 * Après chaque action : remises ramenées dans leurs bornes (une quantité a pu baisser) ; plus de
 * remise ni d'accord sur un ticket vide.
 */
function normaliser(panier: Panier): Panier {
  if (panier.lignes.length === 0) return panierVide
  const lignes = panier.lignes.map((l) =>
    (l.remise ?? 0) > brutLigne(l) ? { ...l, remise: brutLigne(l) } : l
  )
  const borne = lignes.reduce((s, l) => s + totalLigne(l), 0)
  if ((panier.remiseGlobale ?? 0) <= borne && lignes.every((l, i) => l === panier.lignes[i])) return panier
  return { ...panier, lignes, remiseGlobale: Math.min(panier.remiseGlobale ?? 0, borne) }
}

/** Ce que le service reçoit : identifiants, quantités, remises — jamais un prix. */
export function versLignesVente(
  panier: Panier
): { conditionnementId: number; quantite: number; remise?: number }[] {
  return panier.lignes.map((l) => ({
    conditionnementId: l.article.conditionnementId,
    quantite: l.quantite,
    ...((l.remise ?? 0) > 0 && { remise: l.remise })
  }))
}

/** Unités de base qui sortiront du stock pour cette ligne (1 carton de 24 → 24). */
export function quantiteBaseTotale(ligne: LignePanier): number {
  return ligne.quantite * ligne.article.quantiteBase
}

/**
 * Promotions (A16, REGLES_METIER § 5.2) : l'article au prix du jour. Le prix du catalogue est gardé dans
 * `prixNormal`, ce qui rend le calcul idempotent : on peut le refaire quand la liste des promotions
 * change sans jamais appliquer une promotion sur une promotion. La plus avantageuse seule, sans cumul —
 * comme le service, qui refait ce calcul en base à l'encaissement et fait foi.
 */
export function appliquerPromotion(
  article: ArticleCatalogue,
  promotions: PromotionEnCours[]
): ArticleCatalogue {
  const normal = article.prixNormal ?? article.prixVente
  let meilleure: { id: number; nom: string; prix: number } | null = null
  for (const p of promotions) {
    if (!p.produitIds.includes(article.produitId)) continue
    const prix = prixPromotionnel(p, normal, article.quantiteBase)
    if (prix !== null && (meilleure === null || prix <= meilleure.prix)) {
      meilleure = { id: p.id, nom: p.nom, prix }
    }
  }
  if (meilleure) {
    if (article.promotion?.id === meilleure.id && article.prixVente === meilleure.prix) return article
    return {
      ...article,
      prixNormal: normal,
      prixVente: meilleure.prix,
      promotion: { id: meilleure.id, nom: meilleure.nom }
    }
  }
  if (article.prixNormal === undefined) return article
  const { prixNormal: _prixNormal, promotion: _promotion, ...sansPromotion } = article
  return { ...sansPromotion, prixVente: normal }
}

/** Le panier re-tarifé ; le même objet s'il n'y a rien à changer (pas de rendu inutile). */
export function appliquerPromotions(panier: Panier, promotions: PromotionEnCours[]): Panier {
  const lignes = panier.lignes.map((l) => {
    const article = appliquerPromotion(l.article, promotions)
    return article === l.article ? l : { ...l, article }
  })
  return lignes.every((l, i) => l === panier.lignes[i]) ? panier : { ...panier, lignes }
}

/** Ce que les promotions font gagner au client sur ce ticket, FCFA. */
export function economiePanier(panier: Panier): number {
  return panier.lignes.reduce(
    (n, l) =>
      n +
      (l.article.prixNormal === undefined ? 0 : (l.article.prixNormal - l.article.prixVente) * l.quantite),
    0
  )
}

/** Ce que l'écran client affiche. */
export function versPanierClient(panier: Panier): PanierClient {
  return {
    total: totalPanier(panier),
    lignes: panier.lignes.map((l) => ({
      designation: l.article.designation,
      quantite: l.quantite,
      total: totalLigne(l),
      ...((l.remise ?? 0) > 0 && { remise: l.remise }),
      ...(l.article.promotion &&
        l.article.prixNormal !== undefined && {
          promotion: { nom: l.article.promotion.nom, totalNormal: l.article.prixNormal * l.quantite }
        })
    })),
    ...((panier.remiseGlobale ?? 0) > 0 && { remiseTicket: panier.remiseGlobale })
  }
}

export type ActionPanier =
  | { type: 'ajouter'; article: ArticleCatalogue }
  | { type: 'changerQuantite'; conditionnementId: number; quantite: number }
  | { type: 'incrementer'; conditionnementId: number }
  | { type: 'decrementer'; conditionnementId: number }
  | { type: 'supprimer'; conditionnementId: number }
  | { type: 'changerConditionnement'; ancienId: number; article: ArticleCatalogue }
  | { type: 'selectionner'; conditionnementId: number | null }
  | { type: 'remiserLigne'; conditionnementId: number; montant: number }
  | { type: 'remiserTicket'; montant: number }
  | { type: 'accorder'; accord: AccordRemiseDonne }
  | { type: 'promotions'; promotions: PromotionEnCours[] }
  | { type: 'vider' }

export function reducteurPanier(panier: Panier, action: ActionPanier): Panier {
  return normaliser(appliquer(panier, action))
}

function appliquer(panier: Panier, action: ActionPanier): Panier {
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
    case 'changerConditionnement':
      return changerConditionnement(panier, action.ancienId, action.article)
    case 'selectionner':
      return selectionner(panier, action.conditionnementId)
    case 'remiserLigne':
      return remiserLigne(panier, action.conditionnementId, action.montant)
    case 'remiserTicket':
      return remiserTicket(panier, action.montant)
    case 'accorder':
      return { ...panier, accord: action.accord }
    case 'promotions':
      return appliquerPromotions(panier, action.promotions)
    case 'vider':
      return panierVide
  }
}
