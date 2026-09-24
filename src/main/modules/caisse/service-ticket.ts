/**
 * Propriétaire : Dev A.
 *
 * Données du ticket imprimé et règles de (ré)impression (tâche A3). Règles validées par Dev A
 * (2026-09-24) :
 * - la première impression RÉUSSIE d'une vente est l'original ; toute impression suivante est un
 *   DUPLICATA. Le serveur le déduit du journal d'audit (action `impression_ticket`) : l'écran ne
 *   peut pas obtenir un second original (fraude aux retours). Un « Réimprimer » après une panne
 *   d'imprimante sort donc l'original, puisque rien n'a été imprimé ;
 * - une caissière réimprime les tickets de SA session ouverte ; le gérant (et l'admin) n'importe
 *   lequel.
 * Aucune impression ici : ce module lit et journalise ; l'envoi à l'imprimante se fait dans ipc.ts,
 * hors de toute transaction.
 */
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { toutes, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import type { TicketAImprimer } from '../../materiel/ticket'
import { ventilerTva } from './calculs'
import { sessionOuverte } from './service-session'

interface VenteEnBase {
  id: number
  numeroTicket: string
  sessionCaisseId: number
  horodatage: string
  caissier: string
  totalTtc: number
  montantRecu: number
  monnaieRendue: number
}

function lireVente(db: Db, venteId: number): VenteEnBase {
  const v = une<VenteEnBase>(
    db,
    `SELECT v.id, v.numero_ticket AS numeroTicket, v.session_caisse_id AS sessionCaisseId,
            v.horodatage, u.nom AS caissier, v.total_ttc AS totalTtc,
            v.montant_recu AS montantRecu, v.monnaie_rendue AS monnaieRendue
     FROM ventes v JOIN utilisateurs u ON u.id = v.utilisateur_id
     WHERE v.id = ?`,
    venteId
  )
  if (!v) throw new ErreurMetier('Ticket introuvable.')
  return v
}

/** Tout ce qui s'imprime, relu en base (photocopie au moment T), TVA ventilée comme à la vente. */
export function lireTicket(db: Db, venteId: number): TicketAImprimer {
  const v = lireVente(db, venteId)
  const lignes = toutes<{
    designation: string
    quantite: number
    prixUnitaire: number
    totalLigne: number
    tauxTva: number
  }>(
    db,
    `SELECT designation, quantite, prix_unitaire AS prixUnitaire, total_ligne AS totalLigne, taux_tva AS tauxTva
     FROM lignes_vente WHERE vente_id = ? ORDER BY id`,
    venteId
  )
  const paiements = toutes<{ mode: string; montant: number; reference: string | null }>(
    db,
    'SELECT mode, montant, reference FROM paiements WHERE vente_id = ? ORDER BY id',
    venteId
  )
  return {
    numeroTicket: v.numeroTicket,
    horodatage: v.horodatage,
    caissier: v.caissier,
    lignes: lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      totalLigne: l.totalLigne
    })),
    totalTtc: v.totalTtc,
    parTaux: ventilerTva(lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva }))).parTaux,
    paiements,
    montantRecu: v.montantRecu,
    monnaieRendue: v.monnaieRendue
  }
}

export function venteParNumero(db: Db, numeroTicket: string): number {
  const v = une<{ id: number }>(db, 'SELECT id FROM ventes WHERE numero_ticket = ?', numeroTicket.trim())
  if (!v) throw new ErreurMetier(`Ticket ${numeroTicket.trim()} introuvable : vérifiez le numéro.`)
  return v.id
}

/** Caissière : tickets de sa session ouverte seulement. Gérant et admin : tous. */
export function verifierDroitImpression(db: Db, u: UtilisateurConnecte, venteId: number): void {
  if (u.role !== 'caissier') return
  const vente = lireVente(db, venteId)
  if (sessionOuverte(db, u.id)?.id !== vente.sessionCaisseId) {
    throw new ErreurMetier(
      `Le ticket ${vente.numeroTicket} n’est pas de votre session en cours : demandez au gérant de le réimprimer.`
    )
  }
}

export function dejaImprime(db: Db, venteId: number): boolean {
  return !!une(
    db,
    "SELECT id FROM journal_audit WHERE action = 'impression_ticket' AND entite = 'ventes' AND entite_id = ?",
    venteId
  )
}

/** À appeler seulement APRÈS un envoi réussi à l'imprimante. */
export function noterImpression(db: Db, utilisateurId: number, venteId: number, duplicata: boolean): void {
  journaliser(db, {
    utilisateurId,
    action: 'impression_ticket',
    entite: 'ventes',
    entiteId: venteId,
    apres: { duplicata }
  })
}

/** Le tiroir s'ouvre à l'impression de l'original d'une vente payée (en partie) en espèces. */
export function ouvrirTiroirPour(ticket: TicketAImprimer, duplicata: boolean): boolean {
  return !duplicata && ticket.paiements.some((p) => p.mode === 'especes' && p.montant > 0)
}
