/**
 * Propriétaire : Dev A.
 *
 * Clôture de caisse, rapports X et Z (tâche A4, règle 6.9). Règles validées par Dev A (2026-09-25) :
 * - la caissière clôture SA session ; le gérant (et l'admin) peut clôturer celle d'une autre
 *   personne (caissière absente, session oubliée la veille) ;
 * - un écart non nul exige un commentaire (« où sont passés les 500 F ? ») ;
 * - Z : la première impression réussie est l'original, les suivantes portent DUPLICATA (journal,
 *   action `impression_rapport_z`). Caissière : sa dernière session clôturée ; gérant : toutes ;
 * - une session clôturée est figée par le service : `enregistrerVente` n'accepte qu'une session
 *   ouverte, et la clôture ne s'applique qu'à une session encore ouverte.
 * Les espèces théoriques sont TOUJOURS recalculées ici : l'écran n'envoie que le compté.
 */
import type {
  LigneMouvementCaisse,
  RapportCaisse,
  RequeteCloture,
  SessionOuverteResume
} from '@shared/ipc/caisse'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { sessionOuverte } from './service-session'

interface SessionEnBase {
  id: number
  utilisateurId: number
  caissier: string
  fondOuverture: number
  dateOuverture: string
  dateFermeture: string | null
  statut: 'ouverte' | 'fermee'
  montantCompte: number | null
  ecart: number | null
  commentaire: string | null
}

const LIBELLES_MOTIFS: Record<string, string> = {
  apport: 'Apport',
  retrait: 'Retrait',
  depense: 'Dépense',
  encaissement_creance: 'Encaissement de créance',
  remboursement: 'Remboursement',
  autre: 'Autre'
}

function lireSession(db: Db, sessionId: number): SessionEnBase {
  const s = une<SessionEnBase>(
    db,
    `SELECT s.id, s.utilisateur_id AS utilisateurId, u.nom AS caissier, s.fond_ouverture AS fondOuverture,
            s.date_ouverture AS dateOuverture, s.date_fermeture AS dateFermeture, s.statut,
            s.montant_compte AS montantCompte, s.ecart, s.commentaire
     FROM sessions_caisse s JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE s.id = ?`,
    sessionId
  )
  if (!s) throw new ErreurMetier('Session de caisse introuvable.')
  return s
}

/** Session visée : celle demandée, sinon la session ouverte de la personne connectée. */
export function sessionVisee(db: Db, u: UtilisateurConnecte, sessionId?: number): number {
  if (sessionId !== undefined) return sessionId
  const s = sessionOuverte(db, u.id)
  if (!s) throw new ErreurMetier('Votre caisse n’est pas ouverte : aucune session à consulter ou clôturer.')
  return s.id
}

/** Gérant : toutes les sessions ouvertes, la plus ancienne d'abord. */
export function sessionsOuvertes(db: Db): SessionOuverteResume[] {
  return toutes<SessionOuverteResume>(
    db,
    `SELECT s.id, s.utilisateur_id AS utilisateurId, u.nom AS caissier, s.fond_ouverture AS fondOuverture,
            s.date_ouverture AS dateOuverture
     FROM sessions_caisse s JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE s.statut = 'ouverte' ORDER BY s.id`
  )
}

/**
 * Caissière : sa session ouverte, ou sa dernière session clôturée (pour réimprimer son Z).
 * Gérant et admin : toutes.
 */
export function verifierAccesSession(db: Db, u: UtilisateurConnecte, sessionId: number): void {
  const s = lireSession(db, sessionId)
  if (u.role !== 'caissier') return
  if (s.utilisateurId !== u.id) {
    throw new ErreurMetier('Cette session de caisse n’est pas la vôtre : demandez au gérant.')
  }
  if (s.statut === 'ouverte') return
  const derniere = une<{ id: number }>(
    db,
    "SELECT MAX(id) AS id FROM sessions_caisse WHERE utilisateur_id = ? AND statut = 'fermee'",
    u.id
  )
  if (derniere?.id !== sessionId) {
    throw new ErreurMetier('Seul le gérant peut consulter le rapport d’une ancienne session.')
  }
}

/** Rapport X ou Z, entièrement relu en base (règle 6.9). */
export function rapportSession(db: Db, sessionId: number): RapportCaisse {
  const s = lireSession(db, sessionId)

  // Tickets terminés seulement : un ticket annulé ne compte ni dans les ventes ni dans le tiroir.
  const parMode = toutes<{ mode: string; total: number }>(
    db,
    `SELECT p.mode, SUM(p.montant) AS total
     FROM paiements p JOIN ventes v ON v.id = p.vente_id
     WHERE v.session_caisse_id = ? AND v.statut = 'terminee'
     GROUP BY p.mode`,
    sessionId
  )
  const total = (mode: string): number => parMode.find((p) => p.mode === mode)?.total ?? 0
  const totauxParMode = {
    especes: total('especes'),
    tmoney: total('tmoney'),
    flooz: total('flooz'),
    credit: total('credit')
  }
  const { nombre } = une<{ nombre: number }>(
    db,
    "SELECT COUNT(*) AS nombre FROM ventes WHERE session_caisse_id = ? AND statut = 'terminee' AND type = 'ticket'",
    sessionId
  )!

  const mouvements = toutes<{
    sens: 'entree' | 'sortie'
    motif: string
    commentaire: string | null
    montant: number
  }>(
    db,
    'SELECT sens, motif, commentaire, montant FROM mouvements_caisse WHERE session_caisse_id = ? ORDER BY id',
    sessionId
  ).map<LigneMouvementCaisse>((m) => {
    const motif = LIBELLES_MOTIFS[m.motif] ?? m.motif
    return {
      sens: m.sens,
      libelle: m.commentaire ? `${motif} (${m.commentaire})` : motif,
      montant: m.montant
    }
  })

  // Espèces : la part payée en espèces (paiements), jamais le montant reçu — la monnaie est rendue.
  const ventesEspeces = totauxParMode.especes
  const especesTheoriques =
    s.fondOuverture +
    ventesEspeces +
    mouvements.reduce((somme, m) => somme + (m.sens === 'entree' ? m.montant : -m.montant), 0)

  return {
    sessionId: s.id,
    utilisateurId: s.utilisateurId,
    caissier: s.caissier,
    statut: s.statut,
    dateOuverture: s.dateOuverture,
    dateFermeture: s.dateFermeture,
    nombreTickets: nombre,
    totauxParMode,
    totalVentes: parMode.reduce((somme, p) => somme + p.total, 0),
    fondOuverture: s.fondOuverture,
    ventesEspeces,
    mouvements,
    especesTheoriques,
    montantCompte: s.montantCompte,
    ecart: s.ecart,
    commentaire: s.commentaire
  }
}

/** Clôture : fige théorique, compté, écart et commentaire, en une transaction, puis journalise. */
export function cloturerSession(db: Db, u: UtilisateurConnecte, requete: RequeteCloture): RapportCaisse {
  const { montantCompte } = requete
  if (!Number.isInteger(montantCompte) || montantCompte < 0) {
    throw new ErreurMetier('Espèces comptées invalides : saisissez un montant en francs, sans virgule.')
  }
  const commentaire = requete.commentaire?.trim() || null
  const sessionId = sessionVisee(db, u, requete.sessionId)

  return avecTransaction(db, () => {
    const s = lireSession(db, sessionId)
    if (s.statut !== 'ouverte') throw new ErreurMetier('Cette session de caisse est déjà clôturée.')
    if (u.role === 'caissier' && s.utilisateurId !== u.id) {
      throw new ErreurMetier('Cette session de caisse n’est pas la vôtre : demandez au gérant.')
    }
    const { especesTheoriques } = rapportSession(db, sessionId)
    const ecart = montantCompte - especesTheoriques
    if (ecart !== 0 && !commentaire) {
      throw new ErreurMetier('Expliquez l’écart dans le commentaire avant de clôturer.')
    }
    const { changements } = executer(
      db,
      `UPDATE sessions_caisse
       SET statut = 'fermee', date_fermeture = datetime('now','localtime'),
           montant_theorique = ?, montant_compte = ?, ecart = ?, commentaire = ?
       WHERE id = ? AND statut = 'ouverte'`,
      especesTheoriques,
      montantCompte,
      ecart,
      commentaire,
      sessionId
    )
    if (changements !== 1) throw new ErreurMetier('Cette session de caisse est déjà clôturée.')
    journaliser(db, {
      utilisateurId: u.id,
      action: 'cloture_session_caisse',
      entite: 'sessions_caisse',
      entiteId: sessionId,
      apres: { caissierId: s.utilisateurId, especesTheoriques, montantCompte, ecart, commentaire }
    })
    return rapportSession(db, sessionId)
  })
}

/** X : session ouverte seulement ; Z : session clôturée seulement. */
export function verifierTypeRapport(rapport: RapportCaisse, type: 'X' | 'Z'): void {
  if (type === 'Z' && rapport.statut !== 'fermee') {
    throw new ErreurMetier(
      'Le rapport Z s’imprime après la clôture. En cours de journée, imprimez le rapport X.'
    )
  }
  if (type === 'X' && rapport.statut !== 'ouverte') {
    throw new ErreurMetier('Cette session est clôturée : imprimez son rapport Z.')
  }
}

export function rapportZImprime(db: Db, sessionId: number): boolean {
  return !!une(
    db,
    "SELECT id FROM journal_audit WHERE action = 'impression_rapport_z' AND entite = 'sessions_caisse' AND entite_id = ?",
    sessionId
  )
}

/** À appeler seulement APRÈS un envoi réussi à l'imprimante. */
export function noterImpressionZ(db: Db, utilisateurId: number, sessionId: number, duplicata: boolean): void {
  journaliser(db, {
    utilisateurId,
    action: 'impression_rapport_z',
    entite: 'sessions_caisse',
    entiteId: sessionId,
    apres: { duplicata }
  })
}
