/**
 * Propriétaire : Dev A.
 *
 * Logique pure de la fenêtre « Annuler un ticket » (tâche A6, règle 6.7). Le service revérifie tout :
 * caisse ouverte, droits, code du gérant, ticket pas déjà annulé.
 */
import { formaterFCFA } from '@shared/format'
import type { ResultatAnnulation, TicketConsulte } from '@shared/ipc/caisse'

const LIBELLES_MODES: Record<string, string> = { especes: 'Espèces', tmoney: 'TMoney', flooz: 'Flooz' }

export const libelleMode = (mode: string): string => LIBELLES_MODES[mode] ?? mode

/** Un code de gérant a 4 chiffres. */
export const codeComplet = (code: string): boolean => /^\d{4}$/.test(code)

/**
 * Le bouton « Annuler le ticket » s'active quand le ticket affiché peut être annulé, que le motif est
 * saisi et, pour une caissière, que le gérant est choisi et son code tapé.
 */
export function peutAnnuler(s: {
  ticket: TicketConsulte | null
  motif: string
  estCaissiere: boolean
  gerantId: number | null
  code: string
}): boolean {
  if (!s.ticket || s.ticket.raisonRefus !== null || !s.motif.trim()) return false
  return !s.estCaissiere || (s.gerantId !== null && codeComplet(s.code))
}

/** Ce qu'il faut rendre au client, une phrase par moyen de paiement. */
export function aRendre(r: Pick<ResultatAnnulation, 'especesARendre' | 'autresARendre'>): string[] {
  const phrases: string[] = []
  if (r.especesARendre > 0) phrases.push(`Rendez ${formaterFCFA(r.especesARendre)} en espèces.`)
  for (const p of r.autresARendre) {
    const reference = p.reference ? ` (réf. ${p.reference})` : ''
    phrases.push(`Renvoyez ${formaterFCFA(p.montant)} par ${libelleMode(p.mode)}${reference}.`)
  }
  return phrases
}

/** Message affiché dans la caisse après l'annulation. */
export function messageAnnulation(r: ResultatAnnulation): string {
  const tiroir =
    r.especesARendre > 0 && !r.tiroirOuvert ? ' Le tiroir ne s’est pas ouvert : ouvrez-le à la clé.' : ''
  return [`Ticket ${r.numeroTicket} annulé.`, ...aRendre(r)].join(' ') + tiroir
}
