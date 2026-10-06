/**
 * Logique pure de l'écran des règlements fournisseurs (B10, REGLES_METIER § 4.5). Propriétaire : Dev B.
 * Le processus principal revérifie tout ; ici on guide la saisie et on écrit les textes.
 */
import type { DettesFournisseur, EcheanceReception } from '@shared/ipc/fournisseurs'
import { formaterDate, formaterFCFA } from '@shared/format'

/** Valeur du choix « Pour » : le solde global. */
export const GLOBAL = 'global'

/** Reste dû de ce que paie le règlement : le solde, ou la réception choisie. */
export function resteAPayer(d: DettesFournisseur, pour: string): number {
  if (pour === GLOBAL) return d.soldeDu
  return d.echeances.find((e) => String(e.receptionId) === pour)?.reste ?? 0
}

/** « 18 000 » → 18000 ; null si vide, NaN si ce n'est pas un nombre entier de francs. */
export function lireMontant(texte: string): number | null {
  const t = texte.replace(/[\s  ]/g, '')
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

/** Ce qui empêche d'enregistrer, ou null si la saisie est bonne. */
export function manqueReglement(
  montant: number | null,
  reste: number,
  date: string,
  aujourdhui: string
): string | null {
  if (reste <= 0) return 'Rien à payer ici'
  if (montant === null) return 'Indiquez le montant payé'
  if (Number.isNaN(montant) || montant <= 0) return 'Le montant est un nombre de francs, sans virgule'
  if (montant > reste) return `Au plus ${formaterFCFA(reste)}`
  if (date === '') return 'Indiquez la date du règlement'
  if (date > aujourdhui) return 'La date ne peut pas être dans le futur'
  return null
}

/** « Soldée », « À payer le 21/10/2026 », « En retard de 5 j ». */
export function texteEcheance(e: EcheanceReception): string {
  if (e.etat === 'soldee') return 'Soldée'
  if (e.etat === 'en_retard') return `En retard de ${e.joursRetard} j`
  return e.dateEcheance ? `À payer le ${formaterDate(e.dateEcheance)}` : 'À payer'
}

/** Libellé d'une réception dans la liste « Pour ». */
export function libelleReception(e: EcheanceReception): string {
  return `${e.numero} du ${formaterDate(e.dateReception)} — reste ${formaterFCFA(e.reste)}`
}
