/**
 * Propriétaire : Dev A.
 *
 * Annulation d'un ticket (tâche A6, règle 6.7). Règles validées par Dev A (2026-10-13) :
 * - seulement un ticket d'une caisse ENCORE OUVERTE : après la clôture le Z est figé, on passe par
 *   le retour client (A7), qui rembourse sur la caisse du jour ;
 * - réservée au gérant, motif obligatoire. La caissière annule un ticket de SA session si le gérant
 *   tape son code sur la caisse (même vérification que la connexion, comme pour une remise) ; le
 *   gérant connecté annule directement un ticket de n'importe quelle caisse ouverte ;
 * - en une transaction : statut `annulee` et motif, contre-passation de CHAQUE mouvement de stock
 *   du ticket (un par lot depuis le FEFO), un paiement inverse par paiement, journal
 *   `annulation_ticket`. Le ticket reste visible, jamais supprimé ;
 * - le tiroir s'ouvre ensuite (ipc.ts) s'il y a des espèces à rendre ;
 * - réimprimé, il porte « TICKET ANNULÉ » et son motif, jamais d'ouverture du tiroir.
 * Un ticket annulé ne compte plus dans le X ni dans le Z (ils ne lisent que les tickets terminés).
 */
import type {
  AutorisationGerant,
  RequeteAnnulation,
  ResultatAnnulation,
  TicketConsulte
} from '@shared/ipc/caisse'
import type { Role, UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { contrePasser } from '../../core/mouvements'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { verifierCodeCompte } from '../auth/service'
import { retablirAvoirs } from '../clients/service-avoir'
import { sessionOuverte } from './service-session'
import { venteParNumero } from './service-ticket'

interface VenteAnnulable {
  id: number
  numeroTicket: string
  type: string
  statut: 'en_attente' | 'terminee' | 'annulee'
  motifAnnulation: string | null
  sessionId: number
  statutSession: 'ouverte' | 'fermee'
  caissierId: number
  caissier: string
  horodatage: string
  totalTtc: number
}

function lireVente(db: Db, venteId: number): VenteAnnulable {
  return une<VenteAnnulable>(
    db,
    `SELECT v.id, v.numero_ticket AS numeroTicket, v.type, v.statut, v.motif_annulation AS motifAnnulation,
            v.session_caisse_id AS sessionId, s.statut AS statutSession, v.utilisateur_id AS caissierId,
            u.nom AS caissier, v.horodatage, v.total_ttc AS totalTtc
     FROM ventes v
     JOIN sessions_caisse s ON s.id = v.session_caisse_id
     JOIN utilisateurs u ON u.id = v.utilisateur_id
     WHERE v.id = ?`,
    venteId
  )!
}

/** Paiements d'origine (positifs) : les paiements inverses de l'annulation ne s'y mélangent pas. */
function paiementsOrigine(
  db: Db,
  venteId: number
): { mode: string; montant: number; reference: string | null }[] {
  return toutes(
    db,
    'SELECT mode, montant, reference FROM paiements WHERE vente_id = ? AND montant > 0 ORDER BY id',
    venteId
  )
}

/** Pourquoi ce ticket ne peut pas être annulé par cette personne ; null s'il le peut. */
function raisonRefus(db: Db, u: UtilisateurConnecte, v: VenteAnnulable): string | null {
  if (v.statut === 'annulee') return `Le ticket ${v.numeroTicket} est déjà annulé.`
  if (v.type !== 'ticket' || v.statut !== 'terminee')
    return `Le document ${v.numeroTicket} ne s’annule pas ici.`
  if (v.statutSession !== 'ouverte') {
    return `Le ticket ${v.numeroTicket} est d’une caisse déjà clôturée : faites un retour client.`
  }
  if (u.role === 'caissier' && sessionOuverte(db, u.id)?.id !== v.sessionId) {
    return `Le ticket ${v.numeroTicket} n’est pas de votre caisse : demandez au gérant de l’annuler.`
  }
  // Une créance déjà en partie payée ne s'efface pas : l'argent encaissé est dans une caisse (A11).
  const encaisse = une<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM encaissements_creances e JOIN creances c ON c.id = e.creance_id
     WHERE c.vente_id = ?`,
    v.id
  )!.n
  if (encaisse > 0) {
    return `Le client a déjà payé une partie du crédit du ticket ${v.numeroTicket} : demandez au gérant.`
  }
  return null
}

/** Ce que la fenêtre d'annulation affiche, avant toute décision. */
export function consulterTicket(db: Db, u: UtilisateurConnecte, numeroTicket: string): TicketConsulte {
  const v = lireVente(db, venteParNumero(db, numeroTicket))
  const paiements = paiementsOrigine(db, v.id)
  return {
    venteId: v.id,
    numeroTicket: v.numeroTicket,
    horodatage: v.horodatage,
    caissier: v.caissier,
    totalTtc: v.totalTtc,
    lignes: toutes(
      db,
      'SELECT designation, quantite, total_ligne AS totalLigne FROM lignes_vente WHERE vente_id = ? ORDER BY id',
      v.id
    ),
    paiements,
    especesARendre: paiements.filter((p) => p.mode === 'especes').reduce((s, p) => s + p.montant, 0),
    statut: v.statut === 'annulee' ? 'annulee' : 'terminee',
    motifAnnulation: v.motifAnnulation,
    raisonRefus: raisonRefus(db, u, v)
  }
}

const estGerant = (role: Role | undefined): boolean => role === 'gerant' || role === 'admin'

/**
 * Qui autorise : le gérant connecté lui-même, ou le gérant qui tape son code sur la caisse de la
 * caissière. Vérifié HORS de la transaction : un code faux doit rester compté. Sert aussi au retour
 * client (A7). `quoi` : « L’annulation d’un ticket », « Un retour client »…
 */
export function autoriseParGerant(
  db: Db,
  u: UtilisateurConnecte,
  autorisation: AutorisationGerant | undefined,
  quoi = 'L’annulation d’un ticket'
): number {
  if (estGerant(u.role)) return u.id
  if (!autorisation) throw new ErreurMetier(`${quoi} demande l’accord du gérant : faites-lui taper son code.`)
  const role = une<{ role: Role }>(
    db,
    'SELECT role FROM utilisateurs WHERE id = ? AND actif = 1',
    autorisation.utilisateurId
  )?.role
  if (!estGerant(role)) {
    throw new ErreurMetier('Seul un gérant peut donner cet accord : choisissez un compte de gérant.')
  }
  return verifierCodeCompte(db, autorisation.utilisateurId, String(autorisation.code ?? '')).id
}

export function annulerTicket(
  db: Db,
  u: UtilisateurConnecte,
  demande: RequeteAnnulation
): ResultatAnnulation {
  const motif = demande.motif?.trim()
  if (!motif) throw new ErreurMetier('Indiquez le motif de l’annulation.')
  const venteId = venteParNumero(db, demande.numeroTicket)
  // Refus visibles avant de demander le code : inutile de faire taper le gérant pour rien.
  const refus = raisonRefus(db, u, lireVente(db, venteId))
  if (refus) throw new ErreurMetier(refus)
  const gerantId = autoriseParGerant(db, u, demande.autorisation)

  return avecTransaction(db, () => {
    // Relu dans la transaction : une clôture ou une autre annulation a pu passer entre-temps.
    const v = lireVente(db, venteId)
    const refusTardif = raisonRefus(db, u, v)
    if (refusTardif) throw new ErreurMetier(refusTardif)

    const { changements } = executer(
      db,
      "UPDATE ventes SET statut = 'annulee', motif_annulation = ? WHERE id = ? AND statut = 'terminee'",
      motif,
      venteId
    )
    if (changements !== 1) throw new ErreurMetier(`Le ticket ${v.numeroTicket} est déjà annulé.`)

    // Chaque mouvement de la vente, un par lot depuis le FEFO : le stock revient exactement.
    const mouvements = toutes<{ id: number }>(
      db,
      `SELECT id FROM mouvements_stock
       WHERE document_type = 'vente' AND document_id = ? AND type = 'vente' ORDER BY id`,
      venteId
    )
    for (const m of mouvements)
      contrePasser(db, m.id, `Annulation du ticket ${v.numeroTicket} : ${motif}`, u.id)

    // Un paiement inverse par paiement : la somme des paiements du ticket revient à 0.
    const paiements = paiementsOrigine(db, venteId)
    for (const p of paiements) {
      executer(
        db,
        'INSERT INTO paiements (vente_id, mode, montant, reference) VALUES (?, ?, ?, ?)',
        venteId,
        p.mode,
        -p.montant,
        p.reference
      )
    }
    const especesARendre = paiements.filter((p) => p.mode === 'especes').reduce((s, p) => s + p.montant, 0)
    // La part à crédit n'a jamais été payée : rien à rendre, la créance est effacée (A11).
    const creditAnnule = paiements.filter((p) => p.mode === 'credit').reduce((s, p) => s + p.montant, 0)
    if (creditAnnule > 0) {
      executer(
        db,
        `UPDATE creances SET annulee_le = datetime('now','localtime'), annulee_par = ?, motif_annulation = ?
         WHERE vente_id = ?`,
        u.id,
        `Annulation du ticket ${v.numeroTicket} : ${motif}`,
        venteId
      )
    }

    // La part payée par avoir revient au solde du client : une ligne négative liée, jamais d'effacement.
    const avoirRetabli = retablirAvoirs(db, venteId, u.id)

    journaliser(db, {
      utilisateurId: u.id,
      action: 'annulation_ticket',
      entite: 'ventes',
      entiteId: venteId,
      apres: {
        numeroTicket: v.numeroTicket,
        montant: v.totalTtc,
        motif,
        ...(gerantId !== u.id && { autoriseeParId: gerantId })
      }
    })

    return {
      venteId,
      numeroTicket: v.numeroTicket,
      especesARendre,
      autresARendre: paiements
        .filter((p) => p.mode !== 'especes' && p.mode !== 'credit' && p.mode !== 'avoir')
        .map((p) => ({ mode: p.mode, montant: p.montant, reference: p.reference })),
      creditAnnule,
      avoirRetabli,
      tiroirOuvert: false
    }
  })
}
