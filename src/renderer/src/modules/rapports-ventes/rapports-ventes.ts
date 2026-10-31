/**
 * Propriétaire : Dev A.
 * Logique pure de l'écran « Rapports de ventes » (A14, UI_UX § 5.26) : tout est calculé par le
 * processus principal, ici on ne fait que préparer l'affichage.
 */
import type { CritereClassement, VentesHeure } from '@shared/ipc/rapports-ventes'
import type { TonEcart } from '../caisse/cloture'

export const CRITERES: { cle: CritereClassement; libelle: string }[] = [
  { cle: 'chiffreAffaires', libelle: 'Chiffre d’affaires' },
  { cle: 'marge', libelle: 'Marge' },
  { cle: 'quantite', libelle: 'Quantité vendue' }
]

/** 9 → « 9 h – 10 h ». */
export function libelleHeure(heure: number): string {
  return `${heure} h – ${(heure + 1) % 24} h`
}

/** Largeur de la barre d'une tranche, en pourcentage de la meilleure (0 à 100). */
export function largeurBarre(valeur: number, maximum: number): number {
  if (maximum <= 0 || valeur <= 0) return 0
  return Math.round((valeur / maximum) * 100)
}

/** La tranche qui a le plus grand chiffre d'affaires ; la plus matinale en cas d'égalité. */
export function meilleureHeure(lignes: VentesHeure[]): VentesHeure | null {
  let meilleure: VentesHeure | null = null
  for (const l of lignes) {
    if (!meilleure || l.chiffreAffaires > meilleure.chiffreAffaires) meilleure = l
  }
  return meilleure
}

/** Couleur de l'écart d'une session clôturée ; null tant qu'elle est ouverte. */
export function tonDeEcart(ecart: number | null): TonEcart | null {
  if (ecart === null) return null
  return ecart < 0 ? 'manque' : ecart > 0 ? 'surplus' : 'juste'
}

/** « −200 F » pour un manque, « +500 F » pour un surplus, « 0 F » quand la caisse est juste. */
export function texteEcart(ecart: number | null, formater: (n: number) => string): string {
  if (ecart === null) return '—'
  if (ecart === 0) return formater(0)
  return `${ecart > 0 ? '+' : '−'}${formater(Math.abs(ecart))}`
}
