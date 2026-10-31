/**
 * Règles pures du recouvrement des créances, partagées par le service et l'écran. Propriétaire : Dev A.
 * REGLES_METIER § 7.3 (A12).
 */

export type ModeEncaissement = 'especes' | 'tmoney' | 'flooz'

export const LIBELLES_MODE_ENCAISSEMENT: Record<ModeEncaissement, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz'
}

export type Tranche = 'jusqu30' | 'de31a60' | 'plus60'

export const LIBELLES_TRANCHE: Record<Tranche, string> = {
  jusqu30: '0 à 30 jours',
  de31a60: '31 à 60 jours',
  plus60: 'Plus de 60 jours'
}

/** Balance âgée : 0–30, 31–60, plus de 60 jours (REGLES_METIER § 7). */
export function trancheAnciennete(jours: number): Tranche {
  if (jours <= 30) return 'jusqu30'
  if (jours <= 60) return 'de31a60'
  return 'plus60'
}

/** Une créance à payer, vue de l'imputation. */
export interface CreancePayable {
  creanceId: number
  restantDu: number
}

/**
 * Répartit `montant` sur les créances, dans l'ordre reçu (la plus ancienne d'abord) : chacune est
 * soldée avant de passer à la suivante, la dernière touchée peut rester partielle. Renvoie null si
 * le montant dépasse le total dû.
 */
export function imputerPaiement(
  creances: CreancePayable[],
  montant: number
): { creanceId: number; montant: number }[] | null {
  const parts: { creanceId: number; montant: number }[] = []
  let reste = montant
  for (const c of creances) {
    if (reste <= 0) break
    const part = Math.min(reste, c.restantDu)
    if (part > 0) {
      parts.push({ creanceId: c.creanceId, montant: part })
      reste -= part
    }
  }
  return reste > 0 ? null : parts
}
