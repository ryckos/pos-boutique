/**
 * Propriétaire : Dev A.
 *
 * Logique pure de la fenêtre « Retour client » (tâche A7, règle 6.8). Le service revérifie tout :
 * quantités, montants relus en base, caisse ouverte, code du gérant.
 */
import { formaterFCFA } from '@shared/format'
import type { RequeteRetour, RetourEnregistre, TicketRetour } from '@shared/ipc/caisse'
import {
  type ModeRemboursement,
  montantRetourLigne,
  type MotifRetour,
  quantiteRetournable,
  type SortRetour,
  texteMotifRetour
} from '@shared/retour'
import { codeComplet, libelleMode } from './annulation'

/** Quantité rendue par ligne cochée (ligneId → nombre de conditionnements). */
export type Selection = Record<number, number>

/** Cocher une ligne rend tout ce qui reste ; la décocher l'enlève. */
export function basculerLigne(selection: Selection, ticket: TicketRetour, ligneId: number): Selection {
  if (selection[ligneId] !== undefined) {
    const reste = { ...selection }
    delete reste[ligneId]
    return reste
  }
  const ligne = ticket.lignes.find((l) => l.ligneId === ligneId)
  if (!ligne || quantiteRetournable(ligne) <= 0) return selection
  return { ...selection, [ligneId]: quantiteRetournable(ligne) }
}

/** + / − sur une ligne cochée, entre 1 et ce qui reste retournable. */
export function changerQuantiteRendue(
  selection: Selection,
  ticket: TicketRetour,
  ligneId: number,
  delta: number
): Selection {
  const ligne = ticket.lignes.find((l) => l.ligneId === ligneId)
  const actuelle = selection[ligneId]
  if (!ligne || actuelle === undefined) return selection
  const quantite = Math.min(Math.max(actuelle + delta, 1), quantiteRetournable(ligne))
  return { ...selection, [ligneId]: quantite }
}

/** Les lignes à envoyer, dans l'ordre du ticket. */
export function lignesChoisies(ticket: TicketRetour, selection: Selection): RequeteRetour['lignes'] {
  return ticket.lignes
    .filter((l) => (selection[l.ligneId] ?? 0) > 0)
    .map((l) => ({ ligneId: l.ligneId, quantite: selection[l.ligneId] }))
}

/** Montant rendu pour une ligne, tel que le service le calculera. */
export function montantLigne(ticket: TicketRetour, selection: Selection, ligneId: number): number {
  const ligne = ticket.lignes.find((l) => l.ligneId === ligneId)
  return ligne ? montantRetourLigne(ligne, selection[ligneId] ?? 0) : 0
}

export function montantARendre(ticket: TicketRetour, selection: Selection): number {
  return lignesChoisies(ticket, selection).reduce((s, l) => s + montantLigne(ticket, selection, l.ligneId), 0)
}

/** Le mode proposé : celui qui a payé le plus sur le ticket d'origine, espèces si aucun ne convient. */
export function modeParDefaut(ticket: TicketRetour): ModeRemboursement {
  const modes = new Set(['especes', 'tmoney', 'flooz'])
  const principal = [...ticket.paiements]
    .filter((p) => modes.has(p.mode))
    .sort((a, b) => b.montant - a.montant)[0]
  return (principal?.mode as ModeRemboursement | undefined) ?? 'especes'
}

export interface SaisieRetour {
  ticket: TicketRetour | null
  selection: Selection
  motif: MotifRetour | null
  precision: string
  sort: SortRetour | null
  mode: ModeRemboursement
  reference: string
  estCaissiere: boolean
  gerantId: number | null
  code: string
}

/** Ce qui manque encore, dans l'ordre de la fenêtre ; null quand tout est prêt. */
export function ceQuiManque(s: SaisieRetour): string | null {
  if (!s.ticket || s.ticket.raisonRefus !== null) return 'Affichez le ticket d’origine.'
  if (lignesChoisies(s.ticket, s.selection).length === 0) return 'Cochez les articles rapportés.'
  if (!s.motif) return 'Choisissez le motif.'
  if (!texteMotifRetour(s.motif, s.precision)) return 'Précisez la raison du retour.'
  if (!s.sort) return 'Choisissez le sort du produit.'
  if (s.mode !== 'especes' && !s.reference.trim()) {
    return `Saisissez la référence du transfert ${libelleMode(s.mode)}.`
  }
  if (s.estCaissiere && (s.gerantId === null || !codeComplet(s.code))) return 'Le gérant tape son code.'
  return null
}

export function versRequete(s: SaisieRetour): RequeteRetour {
  return {
    numeroTicket: s.ticket!.numeroTicket,
    lignes: lignesChoisies(s.ticket!, s.selection),
    motif: s.motif!,
    ...(s.precision.trim() && { precision: s.precision.trim() }),
    sort: s.sort!,
    remboursement: {
      mode: s.mode,
      ...(s.mode !== 'especes' && { reference: s.reference.trim() })
    },
    ...(s.estCaissiere && { autorisation: { utilisateurId: s.gerantId!, code: s.code } })
  }
}

/** Message affiché dans la caisse après le retour. */
export function messageRetour(r: RetourEnregistre): string {
  const debut = `Retour ${r.numeroRetour} enregistré (ticket ${r.numeroTicketOrigine}).`
  if (r.montant === 0) return `${debut} Rien à rembourser.`
  // Le transfert mobile money est déjà fait : sa référence a été saisie dans la fenêtre.
  if (r.mode !== 'especes')
    return `${debut} ${formaterFCFA(r.montant)} remboursés par ${libelleMode(r.mode)}.`
  const tiroir = r.tiroirOuvert ? '' : ' Le tiroir ne s’est pas ouvert : ouvrez-le à la clé.'
  return `${debut} Rendez ${formaterFCFA(r.montant)} en espèces.${tiroir}`
}
