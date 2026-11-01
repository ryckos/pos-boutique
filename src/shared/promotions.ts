/**
 * Promotions programmées (A16, REGLES_METIER § 5.2). Propriétaire : Dev A.
 * Calcul pur, partagé par le processus principal (qui facture) et la caisse (qui affiche) : l'écran
 * montre exactement le prix que le service appliquera.
 */

export type TypePromotion = 'remise_pourcent' | 'remise_montant' | 'prix_fixe'

export const LIBELLES_TYPE_PROMOTION: Record<TypePromotion, string> = {
  remise_pourcent: 'Pourcentage',
  remise_montant: 'Remise en francs',
  prix_fixe: 'Prix fixe'
}

export interface ReglePromotion {
  type: TypePromotion
  /** Pourcentage (1 à 99) ou FCFA par unité de base, selon le type. */
  valeur: number
}

/**
 * Prix promotionnel d'un conditionnement (TTC, FCFA), ou null si la promotion n'a pas d'effet :
 * - pourcentage : sur le prix du conditionnement, arrondi au franc le plus proche (0,5 vers le haut) —
 *   le seul arrondi autorisé en plus de celui de la TVA ;
 * - remise en francs et prix fixe : exprimés par UNITÉ DE BASE, multipliés par la quantité du
 *   conditionnement (−50 F donne −1 200 F sur un carton de 24).
 * Une promotion ne fait jamais monter un prix : si le résultat n'est pas inférieur au prix normal, ou
 * s'il tombe sous 1 F, elle n'a pas d'effet sur ce conditionnement.
 */
export function prixPromotionnel(
  regle: ReglePromotion,
  prixNormal: number,
  quantiteBase: number
): number | null {
  let prix: number
  switch (regle.type) {
    case 'remise_pourcent':
      prix = Math.floor((prixNormal * (100 - regle.valeur) + 50) / 100)
      break
    case 'remise_montant':
      prix = prixNormal - regle.valeur * quantiteBase
      break
    case 'prix_fixe':
      prix = regle.valeur * quantiteBase
      break
  }
  return prix >= 1 && prix < prixNormal ? prix : null
}

/** « −20 % », « −50 F par unité », « 300 F par unité ». */
export function libelleRegle(regle: ReglePromotion, formater: (n: number) => string): string {
  switch (regle.type) {
    case 'remise_pourcent':
      return `−${regle.valeur} %`
    case 'remise_montant':
      return `−${formater(regle.valeur)} par unité`
    case 'prix_fixe':
      return `${formater(regle.valeur)} par unité`
  }
}

/**
 * « Promo Yaourt −20 % (au lieu de 350 F) » : la mention imprimée sous la ligne du ticket. Elle se
 * construit avec le NOM copié sur la ligne de vente, pas avec la règle, qui peut changer ensuite.
 */
export function mentionPromotion(nom: string, prixNormal: number, formater: (n: number) => string): string {
  return `Promo ${nom} (au lieu de ${formater(prixNormal)})`
}
