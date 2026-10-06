/**
 * Règles pures des dettes fournisseurs (REGLES_METIER § 4.5). Propriétaire : Dev B.
 * Sans accès à la base : testées seules, utilisables par le principal comme par l'écran.
 */
import type { EtatEcheance, ModeReglement } from './ipc/fournisseurs'

export const LIBELLES_MODE_REGLEMENT: Record<ModeReglement, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  virement: 'Virement',
  autre: 'Autre'
}

export interface ReceptionDue {
  id: number
  total: number
  /** AAAA-MM-JJ, null pour une réception antérieure à l'échéance figée (B8). */
  dateEcheance: string | null
}

export interface ReglementValable {
  /** null = règlement global. */
  receptionId: number | null
  montant: number
}

export interface Imputation {
  receptionId: number
  regle: number
  reste: number
  etat: EtatEcheance
  /** Jours écoulés depuis l'échéance, 0 si elle n'est pas dépassée. */
  joursRetard: number
}

/** Jours entiers de a à b (AAAA-MM-JJ), négatif si b est avant a. */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/**
 * Répartit les règlements sur les réceptions : un règlement lié va à sa réception, un règlement
 * global couvre d'abord la réception la plus ancienne. `receptions` doit être dans l'ordre
 * d'arrivée ; seuls les règlements non annulés sont passés.
 */
export function imputerReglements(
  receptions: ReceptionDue[],
  reglements: ReglementValable[],
  aujourdhui: string
): Imputation[] {
  const direct = new Map<number, number>()
  let global = 0
  for (const r of reglements) {
    if (r.receptionId === null) global += r.montant
    else direct.set(r.receptionId, (direct.get(r.receptionId) ?? 0) + r.montant)
  }

  return receptions.map((rc) => {
    let regle = Math.min(rc.total, direct.get(rc.id) ?? 0)
    const part = Math.min(rc.total - regle, global)
    regle += part
    global -= part
    const reste = rc.total - regle
    const retard = rc.dateEcheance ? joursEntre(rc.dateEcheance, aujourdhui) : 0
    const etat: EtatEcheance = reste <= 0 ? 'soldee' : retard > 0 ? 'en_retard' : 'a_payer'
    return { receptionId: rc.id, regle, reste, etat, joursRetard: etat === 'en_retard' ? retard : 0 }
  })
}
