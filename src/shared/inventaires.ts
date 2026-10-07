/**
 * Règles pures des inventaires, partagées par le service et l'écran. Propriétaire : Dev B.
 * REGLES_METIER § 9.
 */

/** Motifs d'écart permis par le schéma (`lignes_inventaire.motif_ecart`). */
export type MotifEcart = 'casse' | 'vol' | 'erreur_saisie' | 'peremption' | 'don' | 'autre'

export const LIBELLES_MOTIF_ECART: Record<MotifEcart, string> = {
  casse: 'Casse',
  vol: 'Vol',
  erreur_saisie: 'Erreur de saisie',
  peremption: 'Péremption',
  don: 'Don',
  autre: 'Autre'
}

export type StatutInventaire = 'en_cours' | 'valide' | 'annule'

export const LIBELLES_STATUT_INVENTAIRE: Record<StatutInventaire, string> = {
  en_cours: 'En cours',
  valide: 'Validé',
  annule: 'Annulé'
}

/** En deçà, un écart au poids n'est qu'une erreur d'arrondi des nombres à virgule. */
export const EPSILON_ECART = 1e-9

/** Évite les 2,9999999 sur les produits au poids. */
export const arrondirQuantite = (n: number): number => Math.round(n * 1000) / 1000

/** Valeur d'un écart au CUMP, arrondie au franc : −2 savons × 150 → −300. */
export function valeurEcart(ecart: number, cump: number): number {
  return Math.round(ecart * cump)
}

/** Part d'un manquant prise sur un lot ; `lotId` null = la part qui sort sans lot. */
export interface PartManquant {
  lotId: number | null
  quantite: number
}

/**
 * Répartit un manquant d'inventaire sur les lots en stock, la date la plus ancienne d'abord, lots
 * périmés compris (validé par Dev B le 2026-10-07). Les lots doivent être fournis dans cet ordre.
 * Ce que les lots ne couvrent pas sort sans lot. Manquant de 5 sur A (3) puis B (10) → A 3, B 2.
 */
export function repartirManquant(
  manquant: number,
  lots: Array<{ lotId: number; restant: number }>
): PartManquant[] {
  const parts: PartManquant[] = []
  let reste = manquant
  for (const l of lots) {
    if (reste <= EPSILON_ECART) break
    if (l.restant <= EPSILON_ECART) continue
    const q = arrondirQuantite(Math.min(reste, l.restant))
    parts.push({ lotId: l.lotId, quantite: q })
    reste = arrondirQuantite(reste - q)
  }
  if (reste > EPSILON_ECART) parts.push({ lotId: null, quantite: reste })
  return parts
}
