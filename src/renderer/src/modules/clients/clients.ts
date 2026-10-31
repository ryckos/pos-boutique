/**
 * Logique pure de l'écran Clients (A11, REGLES_METIER § 7 et 7.1). Propriétaire : Dev A.
 * Le processus principal revérifie tout ; ici on guide la saisie et on écrit les textes.
 */
import type { Client, CreanceClient } from '@shared/ipc/clients'
import { formaterFCFA } from '@shared/format'

/** Ce que le client peut encore prendre à crédit, jamais négatif. */
export function resteDisponible(c: Pick<Client, 'plafondCredit' | 'encours'>): number {
  return Math.max(0, c.plafondCredit - c.encours)
}

/** « 50 000 » → 50000 ; null si vide, NaN si ce n'est pas un nombre entier de francs. */
export function lireMontant(texte: string): number | null {
  const t = texte.replace(/[\s  ]/g, '')
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

const chiffres = (t: string): string => t.replace(/\D/g, '')

export interface SaisieFormulaireClient {
  nom: string
  telephone: string
  /** Texte tapé ; ignoré par le service quand la caissière modifie. */
  plafond: string
}

/** Ce qui empêche d'enregistrer, ou null si la saisie est bonne. */
export function manqueClient(s: SaisieFormulaireClient, peutFixerPlafond: boolean): string | null {
  if (s.nom.trim() === '') return 'Saisissez le nom du client.'
  const tel = s.telephone.trim()
  if (tel !== '' && chiffres(tel).length < 8) return 'Le numéro de téléphone est incomplet : 8 chiffres au moins.'
  if (!peutFixerPlafond) return null
  const plafond = lireMontant(s.plafond)
  if (Number.isNaN(plafond)) return 'Le plafond est un montant entier en francs, par exemple 50 000.'
  if ((plafond ?? 0) > 0 && tel === '') return 'Un client à crédit a besoin d’un téléphone, pour pouvoir le relancer.'
  return null
}

/** Phrase sous le nom du client dans la liste et à la caisse. */
export function texteCredit(c: Pick<Client, 'plafondCredit' | 'encours'>): string {
  if (c.plafondCredit === 0) return 'Aucun crédit autorisé'
  return `Reste disponible : ${formaterFCFA(resteDisponible(c))} sur ${formaterFCFA(c.plafondCredit)}`
}

export interface EtatCreance {
  libelle: string
  classe: 'pastille-ok' | 'pastille-erreur' | 'pastille-inactif' | 'pastille-accent'
}

/** Statut affiché d'une créance : « En retard » prime sur « Ouverte ». */
export function etatCreance(c: Pick<CreanceClient, 'statut' | 'enRetard'>): EtatCreance {
  if (c.statut === 'annulee') return { libelle: 'Annulée', classe: 'pastille-inactif' }
  if (c.statut === 'soldee') return { libelle: 'Soldée', classe: 'pastille-ok' }
  if (c.enRetard) return { libelle: 'En retard', classe: 'pastille-erreur' }
  return { libelle: 'Ouverte', classe: 'pastille-accent' }
}
