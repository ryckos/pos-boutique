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
import { LIBELLES_SORT_RETOUR, type SortRetour } from '@shared/retour'
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
  remiseGlobale: number
  montantRecu: number
  monnaieRendue: number
  statut: string
  motifAnnulation: string | null
  type: string
  motifRetour: string | null
  sortRetour: SortRetour | null
  ticketOrigine: string | null
}

function lireVente(db: Db, venteId: number): VenteEnBase {
  const v = une<VenteEnBase>(
    db,
    `SELECT v.id, v.numero_ticket AS numeroTicket, v.session_caisse_id AS sessionCaisseId,
            v.horodatage, u.nom AS caissier, v.total_ttc AS totalTtc,
            v.remise_globale AS remiseGlobale, v.montant_recu AS montantRecu, v.monnaie_rendue AS monnaieRendue,
            v.statut, v.motif_annulation AS motifAnnulation, v.type, v.motif_retour AS motifRetour,
            v.sort_retour AS sortRetour, o.numero_ticket AS ticketOrigine
     FROM ventes v JOIN utilisateurs u ON u.id = v.utilisateur_id
     LEFT JOIN ventes o ON o.id = v.vente_origine_id
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
    remise: number
    totalLigne: number
    tauxTva: number
    prixNormal: number | null
    promotionNom: string | null
  }>(
    db,
    `SELECT designation, quantite, prix_unitaire AS prixUnitaire, remise_ligne AS remise,
            total_ligne AS totalLigne, taux_tva AS tauxTva, prix_normal AS prixNormal,
            promotion_nom AS promotionNom
     FROM lignes_vente WHERE vente_id = ? ORDER BY id`,
    venteId
  )
  const estRetour = v.type === 'retour'
  // Paiements d'origine seulement : ceux d'une annulation (négatifs) n'apparaissent pas sur le ticket,
  // qui porte à la place la mention TICKET ANNULÉ (A6). Un retour (A7) n'a que des paiements négatifs.
  const paiements = toutes<{ mode: string; montant: number; reference: string | null }>(
    db,
    `SELECT mode, montant, reference FROM paiements WHERE vente_id = ? AND montant ${estRetour ? '<' : '>'} 0
     ORDER BY id`,
    venteId
  )
  // TVA d'un retour : ventilée sur les montants rendus (positifs) comme à la vente, puis mise en négatif.
  const signe = estRetour ? -1 : 1
  const parTaux = ventilerTva(
    lignes.map((l) => ({ totalTtc: signe * l.totalLigne, tauxTva: l.tauxTva })),
    v.remiseGlobale
  ).parTaux.map((t) => ({ taux: t.taux, ttc: signe * t.ttc, ht: signe * t.ht, tva: signe * t.tva }))
  // Part à crédit (A11) : la créance et son client, recopiés tels qu'aujourd'hui (une créance annulée
  // ne s'imprime plus : le ticket porte déjà TICKET ANNULÉ).
  const credit =
    une<{ client: string; telephone: string | null; montant: number; echeance: string }>(
      db,
      `SELECT cl.nom AS client, cl.telephone, c.montant_initial AS montant, c.date_echeance AS echeance
       FROM creances c JOIN clients cl ON cl.id = c.client_id
       WHERE c.vente_id = ? AND c.annulee_le IS NULL`,
      venteId
    ) ?? null
  // Retour remboursé en avoir (A11) : le numéro et le solde du client, relus en base.
  const avoir = estRetour
    ? (une<{ numero: string; montant: number; client: string; solde: number }>(
        db,
        `SELECT a.numero, a.montant_initial AS montant, cl.nom AS client,
                (SELECT COALESCE(SUM(s.solde), 0) FROM v_avoirs_clients s WHERE s.client_id = a.client_id) AS solde
         FROM v_avoirs_clients a JOIN clients cl ON cl.id = a.client_id
         WHERE a.retour_id = ?`,
        venteId
      ) ?? null)
    : null
  return {
    credit,
    avoir,
    numeroTicket: v.numeroTicket,
    horodatage: v.horodatage,
    caissier: v.caissier,
    lignes: lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise: l.remise,
      totalLigne: l.totalLigne,
      ...(l.prixNormal !== null &&
        l.promotionNom !== null && {
          promotion: { nom: l.promotionNom, prixNormal: l.prixNormal }
        })
    })),
    // Ce que les promotions ont fait gagner : (prix normal − prix payé) × quantité, sur un vrai ticket de vente.
    economiePromotions: estRetour
      ? 0
      : lignes.reduce(
          (n, l) => n + (l.prixNormal === null ? 0 : (l.prixNormal - l.prixUnitaire) * l.quantite),
          0
        ),
    remiseGlobale: v.remiseGlobale,
    totalTtc: v.totalTtc,
    parTaux,
    paiements,
    montantRecu: v.montantRecu,
    monnaieRendue: v.monnaieRendue,
    annulation: v.statut === 'annulee' ? { motif: v.motifAnnulation ?? '' } : null,
    retour: estRetour
      ? {
          ticketOrigine: v.ticketOrigine ?? '',
          motif: v.motifRetour ?? '',
          sort: v.sortRetour ? LIBELLES_SORT_RETOUR[v.sortRetour] : '',
          creanceReduite:
            une<{ montant: number }>(
              db,
              'SELECT montant FROM reductions_creances WHERE retour_id = ?',
              venteId
            )?.montant ?? 0
        }
      : null
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

/**
 * Le tiroir s'ouvre à l'impression de l'original d'une vente payée (en partie) en espèces ; jamais
 * pour un ticket annulé (son remboursement a déjà ouvert le tiroir).
 */
export function ouvrirTiroirPour(ticket: TicketAImprimer, duplicata: boolean): boolean {
  return (
    !duplicata && !ticket.annulation && ticket.paiements.some((p) => p.mode === 'especes' && p.montant > 0)
  )
}
