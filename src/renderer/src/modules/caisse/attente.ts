/**
 * Propriétaire : Dev A.
 *
 * Tickets en attente (règle 6.2) : le client a oublié un article, on sert le suivant. Fonctions
 * pures (testées dans tests/attente.test.ts) ; l'état vit en mémoire, par caissière, et n'est
 * jamais écrit en base : rien n'est vendu tant que le ticket n'est pas encaissé.
 */
import { panierVide, reducteurPanier, totalPanier, type ActionPanier, type Panier } from './panier'

export interface TicketEnAttente {
  /** Numéro d'affichage, propre à la caissière (« Ticket en attente 2 »). */
  numero: number
  panier: Panier
  /** Horodatage de la mise en attente, en millisecondes. */
  depuis: number
}

export interface EtatCaisse {
  courant: Panier
  attente: TicketEnAttente[]
  prochainNumero: number
}

export const etatCaisseInitial: EtatCaisse = { courant: panierVide, attente: [], prochainNumero: 1 }

/** Un ticket vide ne part pas en attente. */
export function mettreEnAttente(etat: EtatCaisse, maintenant: number): EtatCaisse {
  if (etat.courant.lignes.length === 0) return etat
  return {
    courant: panierVide,
    attente: [
      ...etat.attente,
      { numero: etat.prochainNumero, panier: { ...etat.courant, selection: null }, depuis: maintenant }
    ],
    prochainNumero: etat.prochainNumero + 1
  }
}

/**
 * Reprend un ticket en attente. Si le ticket courant n'est pas vide, il part en attente à sa place :
 * les deux sont permutés et rien n'est perdu (choix validé par Dev A, 2026-09-23).
 */
export function reprendre(etat: EtatCaisse, numero: number, maintenant: number): EtatCaisse {
  const ticket = etat.attente.find((t) => t.numero === numero)
  if (!ticket) return etat
  const reste = { ...etat, attente: etat.attente.filter((t) => t.numero !== numero) }
  const libere = mettreEnAttente(reste, maintenant)
  return { ...libere, courant: ticket.panier }
}

export interface ResumeAttente {
  nbArticles: number
  total: number
  /** « 10:42 » */
  heure: string
}

export function resumeAttente(ticket: TicketEnAttente): ResumeAttente {
  const d = new Date(ticket.depuis)
  return {
    nbArticles: ticket.panier.lignes.reduce((s, l) => s + l.quantite, 0),
    total: totalPanier(ticket.panier),
    heure: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

export type ActionCaisse =
  | { type: 'panier'; action: ActionPanier }
  | { type: 'mettreEnAttente'; maintenant: number }
  | { type: 'reprendre'; numero: number; maintenant: number }

export function reducteurCaisse(etat: EtatCaisse, action: ActionCaisse): EtatCaisse {
  switch (action.type) {
    case 'panier':
      return { ...etat, courant: reducteurPanier(etat.courant, action.action) }
    case 'mettreEnAttente':
      return mettreEnAttente(etat, action.maintenant)
    case 'reprendre':
      return reprendre(etat, action.numero, action.maintenant)
  }
}
