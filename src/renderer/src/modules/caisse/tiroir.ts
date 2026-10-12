/**
 * Propriétaire : Dev A.
 *
 * Logique pure de la fenêtre « Espèces du tiroir » (tâche A8, règle 6.10) : saisie d'un apport,
 * d'un retrait ou d'un « Autre » par le gérant, et lecture de la liste des mouvements. Le service
 * revérifie tout (droits, montant, plafond du tiroir, session ouverte).
 */
import {
  MOTIFS_SAISIS_AU_TIROIR,
  sensDuMotif,
  type MotifSaisiAuTiroir,
  type SensMouvementCaisse
} from '@shared/caisse'
import { formaterFCFA } from '@shared/format'
import type { MouvementCaisse, RequeteMouvementCaisse } from '@shared/ipc/caisse'
import { lireMontant } from './paiement'

export interface SaisieMouvement {
  sessionId: number
  motif: MotifSaisiAuTiroir
  /** Seulement pour « Autre » ; null = pas encore choisi. */
  sens: SensMouvementCaisse | null
  /** Tel que tapé : « 3 500 », « 3500 ». */
  montant: string
  commentaire: string
}

export function nouvelleSaisie(sessionId: number, motif: MotifSaisiAuTiroir): SaisieMouvement {
  return { sessionId, motif, sens: sensDuMotif(motif), montant: '', commentaire: '' }
}

/** Sens effectif : imposé par l'apport et le retrait, choisi pour « Autre ». */
export function sensDeSaisie(s: SaisieMouvement): SensMouvementCaisse | null {
  return sensDuMotif(s.motif) ?? s.sens
}

/** La requête à envoyer, ou null tant que la saisie est incomplète (bouton grisé). */
export function versRequeteMouvement(s: SaisieMouvement): RequeteMouvementCaisse | null {
  const sens = sensDeSaisie(s)
  const montant = lireMontant(s.montant)
  const commentaire = s.commentaire.trim()
  if (!sens || montant <= 0 || !commentaire) return null
  return { sessionId: s.sessionId, motif: s.motif, sens, montant, commentaire }
}

/** Le bouton dit l'action : « Enregistrer l'apport », « Enregistrer la sortie »… */
export function libelleEnregistrer(s: SaisieMouvement): string {
  if (s.motif === 'apport') return 'Enregistrer l’apport'
  if (s.motif === 'retrait') return 'Enregistrer le retrait'
  const sens = sensDeSaisie(s)
  if (sens === 'entree') return 'Enregistrer l’entrée'
  if (sens === 'sortie') return 'Enregistrer la sortie'
  return 'Enregistrer le mouvement'
}

export const TITRES_SAISIE: Record<MotifSaisiAuTiroir, string> = {
  apport: 'Mettre des espèces dans le tiroir',
  retrait: 'Sortir des espèces du tiroir',
  autre: 'Autre entrée ou sortie d’espèces'
}

/** Montant vu du tiroir : positif s'il entre, négatif s'il sort. */
export function montantSigne(m: Pick<MouvementCaisse, 'sens' | 'montant'>): number {
  return m.sens === 'entree' ? m.montant : -m.montant
}

/**
 * « Annuler » ne s'affiche que pour un apport, un retrait ou un « Autre » encore valable : une
 * dépense ou un règlement s'annule depuis son document, une annulation ne s'annule pas.
 */
export function annulableAuTiroir(m: MouvementCaisse): boolean {
  return (
    (MOTIFS_SAISIS_AU_TIROIR as readonly string[]).includes(m.motif) &&
    m.mouvementOrigineId === null &&
    m.annuleParId === null
  )
}

/** '2026-10-12 14:05:33' → '14:05'. */
export function heureMouvement(horodatage: string): string {
  return horodatage.slice(11, 16)
}

/** Message affiché après l'enregistrement (le tiroir a pu ne pas s'ouvrir). */
export function messageEnregistre(m: MouvementCaisse, tiroirOuvert: boolean): string {
  const nature = m.mouvementOrigineId !== null ? 'Annulation' : m.sens === 'entree' ? 'Entrée' : 'Sortie'
  const quoi = `${nature} de ${formaterFCFA(m.montant)} enregistrée`
  return tiroirOuvert
    ? `${quoi}. ${m.sens === 'entree' ? 'Rangez' : 'Prenez'} les espèces dans le tiroir.`
    : `${quoi}, mais le tiroir ne s’est pas ouvert : ouvrez-le à la clé.`
}
