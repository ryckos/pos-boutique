/**
 * Propriétaire : Dev A.
 *
 * Mouvements de caisse : espèces qui entrent ou sortent du tiroir hors vente (tâche A8, règle 6.10).
 * Règles validées par Dev A (2026-10-08) :
 * - apports, retraits et « Autre » : gérant seulement, motif en clair obligatoire, journalisés
 *   (`mouvement_caisse`) ; le tiroir s'ouvre APRÈS la transaction (ipc.ts) ;
 * - une seule caisse ouverte : elle est prise d'office ; plusieurs : le gérant choisit ;
 * - une sortie ne dépasse jamais les espèces théoriques du tiroir ;
 * - une erreur ne s'efface pas : elle s'annule par un contre-mouvement de sens inverse, lié à
 *   l'original, avec motif, journalisé (`annulation_mouvement_caisse`), une seule fois, et
 *   seulement tant que la session est ouverte ;
 * - une session clôturée est figée : le service le refuse, et un trigger de la base aussi.
 *
 * POUR DEV B (dépenses payées au tiroir, B13 ; règlements fournisseur) : `sessionOuverte(db)`
 * (service-session.ts), `enregistrerMouvementCaisse` et `annulerMouvementCaisse`, à appeler DANS la
 * transaction du document (avecTransaction s'imbrique) : si le document échoue, le mouvement aussi.
 * Les droits sont ceux de l'appelant : ces deux fonctions ne relisent pas le rôle.
 */
import {
  LIBELLES_MOTIF_CAISSE,
  MOTIFS_SAISIS_AU_TIROIR,
  libelleMouvementCaisse,
  sensDuMotif,
  type MotifMouvementCaisse,
  type MotifSaisiAuTiroir,
  type SensMouvementCaisse
} from '@shared/caisse'
import { formaterFCFA } from '@shared/format'
import type { MouvementCaisse, RequeteMouvementCaisse } from '@shared/ipc/caisse'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { rapportSession, sessionsOuvertes } from './service-cloture'
import { sessionOuverte } from './service-session'

export interface EntreeMouvementCaisse {
  sessionId: number
  /** Qui fait le mouvement : la personne connectée, relue par `session.exiger` chez l'appelant. */
  utilisateurId: number
  sens: SensMouvementCaisse
  motif: MotifMouvementCaisse
  /** Francs entiers > 0. */
  montant: number
  /** Motif en clair, obligatoire : il s'imprime sur le X et le Z (« Dépense (taxi-moto) »). */
  commentaire: string
  /** Document à l'origine du mouvement : 'depense', 'reglement_fournisseur'… */
  documentType?: string
  documentId?: number
}

type MouvementEnBase = Omit<MouvementCaisse, 'libelle'>

const SELECT_MOUVEMENT = `
  SELECT m.id, m.session_caisse_id AS sessionId, m.sens, m.motif, m.montant, m.commentaire,
         m.document_type AS documentType, m.document_id AS documentId, u.nom AS auteur, m.horodatage,
         m.mouvement_origine_id AS mouvementOrigineId,
         (SELECT a.id FROM mouvements_caisse a WHERE a.mouvement_origine_id = m.id) AS annuleParId
  FROM mouvements_caisse m JOIN utilisateurs u ON u.id = m.utilisateur_id`

function versMouvement(m: MouvementEnBase): MouvementCaisse {
  return {
    ...m,
    libelle: libelleMouvementCaisse({ ...m, annulation: m.mouvementOrigineId !== null })
  }
}

function lireMouvement(db: Db, id: number): MouvementCaisse {
  const m = une<MouvementEnBase>(db, `${SELECT_MOUVEMENT} WHERE m.id = ?`, id)
  if (!m) throw new ErreurMetier('Mouvement de caisse introuvable.')
  return versMouvement(m)
}

export function mouvementsSession(db: Db, sessionId: number): MouvementCaisse[] {
  return toutes<MouvementEnBase>(
    db,
    `${SELECT_MOUVEMENT} WHERE m.session_caisse_id = ? ORDER BY m.id`,
    sessionId
  ).map(versMouvement)
}

function exigerSessionOuverte(db: Db, sessionId: number): void {
  const s = une<{ statut: string }>(db, 'SELECT statut FROM sessions_caisse WHERE id = ?', sessionId)
  if (!s) throw new ErreurMetier('Session de caisse introuvable.')
  if (s.statut !== 'ouverte')
    throw new ErreurMetier('Cette caisse est clôturée : ouvrez une nouvelle session.')
}

/** Un tiroir ne peut pas sortir plus qu'il ne contient (espèces théoriques du moment). */
function exigerEspecesDisponibles(db: Db, sessionId: number, montant: number): void {
  const { especesTheoriques } = rapportSession(db, sessionId)
  if (montant > especesTheoriques) {
    throw new ErreurMetier(
      `Il n’y a que ${formaterFCFA(Math.max(0, especesTheoriques))} en caisse : impossible de sortir ${formaterFCFA(montant)}.`
    )
  }
}

function exigerMontant(montant: number): void {
  if (!Number.isInteger(montant) || montant <= 0) {
    throw new ErreurMetier('Montant invalide : saisissez un montant en francs, sans virgule.')
  }
}

/** Écrit un mouvement de caisse dans la session (ouverte) indiquée. Voir l'en-tête pour Dev B. */
export function enregistrerMouvementCaisse(db: Db, e: EntreeMouvementCaisse): MouvementCaisse {
  exigerMontant(e.montant)
  if (e.sens !== 'entree' && e.sens !== 'sortie')
    throw new Error(`Sens de mouvement de caisse inconnu : ${e.sens}`)
  if (!(e.motif in LIBELLES_MOTIF_CAISSE))
    throw new Error(`Motif de mouvement de caisse inconnu : ${e.motif}`)
  const commentaire = e.commentaire?.trim()
  if (!commentaire) throw new ErreurMetier('Précisez le motif : il s’imprime sur le rapport de caisse.')

  return avecTransaction(db, () => {
    exigerSessionOuverte(db, e.sessionId)
    if (e.sens === 'sortie') exigerEspecesDisponibles(db, e.sessionId, e.montant)
    const { id } = executer(
      db,
      `INSERT INTO mouvements_caisse
         (session_caisse_id, sens, motif, montant, document_type, document_id, commentaire, utilisateur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      e.sessionId,
      e.sens,
      e.motif,
      e.montant,
      e.documentType ?? null,
      e.documentId ?? null,
      commentaire,
      e.utilisateurId
    )
    journaliser(db, {
      utilisateurId: e.utilisateurId,
      action: 'mouvement_caisse',
      entite: 'mouvements_caisse',
      entiteId: id,
      // Pas de clé en « …Id » : le journal de B14 y lit un identifiant d'utilisateur.
      apres: {
        session: e.sessionId,
        sens: e.sens,
        motif: e.motif,
        montant: e.montant,
        commentaire,
        typeDocument: e.documentType ?? null,
        document: e.documentId ?? null
      }
    })
    return lireMouvement(db, id)
  })
}

/**
 * Annule un mouvement par un contre-mouvement de sens inverse (même motif, même document), lié à
 * l'original. Le motif de l'annulation devient son commentaire : « Annulation : Apport (erreur) ».
 */
export function annulerMouvementCaisse(
  db: Db,
  a: { mouvementId: number; utilisateurId: number; motif: string }
): MouvementCaisse {
  const motif = a.motif?.trim()
  if (!motif) throw new ErreurMetier('Indiquez le motif de l’annulation.')

  return avecTransaction(db, () => {
    const m = lireMouvement(db, a.mouvementId)
    if (m.mouvementOrigineId !== null) {
      throw new ErreurMetier(
        'Ce mouvement est lui-même une annulation : saisissez plutôt un nouveau mouvement.'
      )
    }
    if (m.annuleParId !== null) throw new ErreurMetier('Ce mouvement de caisse est déjà annulé.')
    const s = une<{ statut: string }>(db, 'SELECT statut FROM sessions_caisse WHERE id = ?', m.sessionId)!
    if (s.statut !== 'ouverte') {
      throw new ErreurMetier('Cette caisse est clôturée : ses mouvements ne s’annulent plus.')
    }
    const sens: SensMouvementCaisse = m.sens === 'entree' ? 'sortie' : 'entree'
    if (sens === 'sortie') exigerEspecesDisponibles(db, m.sessionId, m.montant)
    const { id } = executer(
      db,
      `INSERT INTO mouvements_caisse
         (session_caisse_id, sens, motif, montant, document_type, document_id, commentaire, utilisateur_id,
          mouvement_origine_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      m.sessionId,
      sens,
      m.motif,
      m.montant,
      m.documentType,
      m.documentId,
      motif,
      a.utilisateurId,
      m.id
    )
    journaliser(db, {
      utilisateurId: a.utilisateurId,
      action: 'annulation_mouvement_caisse',
      entite: 'mouvements_caisse',
      entiteId: m.id,
      avant: {
        session: m.sessionId,
        sens: m.sens,
        motif: m.motif,
        montant: m.montant,
        commentaire: m.commentaire
      },
      apres: { contreMouvement: id, motif }
    })
    return lireMouvement(db, id)
  })
}

// --- Saisie au tiroir par le gérant (canaux caisse:*) -------------------------------------------

function exigerGerant(u: UtilisateurConnecte): void {
  if (u.role === 'caissier') {
    throw new ErreurMetier('Seul le gérant peut mettre ou retirer des espèces hors vente.')
  }
}

/** Session visée : celle choisie, sinon la seule caisse ouverte. */
export function sessionPourMouvement(db: Db, sessionId?: number): number {
  if (sessionId !== undefined) return sessionId
  const s = sessionOuverte(db)
  if (s) return s.id
  if (sessionsOuvertes(db).length === 0) {
    throw new ErreurMetier(
      'Aucune caisse n’est ouverte : ouvrez la caisse avant de mettre ou retirer des espèces.'
    )
  }
  throw new ErreurMetier('Plusieurs caisses sont ouvertes : choisissez celle du tiroir.')
}

export function saisirMouvementAuTiroir(
  db: Db,
  u: UtilisateurConnecte,
  requete: RequeteMouvementCaisse
): MouvementCaisse {
  exigerGerant(u)
  if (!MOTIFS_SAISIS_AU_TIROIR.includes(requete.motif)) {
    throw new ErreurMetier(
      'Ce type de mouvement se saisit depuis son propre écran (dépense, créance, retour).'
    )
  }
  const sens = sensDuMotif(requete.motif) ?? requete.sens
  if (sens !== 'entree' && sens !== 'sortie') {
    throw new ErreurMetier('Indiquez s’il s’agit d’une entrée ou d’une sortie d’espèces.')
  }
  return enregistrerMouvementCaisse(db, {
    sessionId: sessionPourMouvement(db, requete.sessionId),
    utilisateurId: u.id,
    sens,
    motif: requete.motif,
    montant: requete.montant,
    commentaire: requete.commentaire
  })
}

/** Le gérant n'annule ici que ce qu'il a saisi au tiroir ; le reste s'annule depuis son document. */
export function annulerMouvementAuTiroir(
  db: Db,
  u: UtilisateurConnecte,
  a: { mouvementId: number; motif: string }
): MouvementCaisse {
  exigerGerant(u)
  const m = lireMouvement(db, a.mouvementId)
  if (!MOTIFS_SAISIS_AU_TIROIR.includes(m.motif as MotifSaisiAuTiroir)) {
    throw new ErreurMetier(
      `Ce mouvement vient d’un document (${LIBELLES_MOTIF_CAISSE[m.motif]}) : annulez-le depuis ce document.`
    )
  }
  return annulerMouvementCaisse(db, { mouvementId: a.mouvementId, utilisateurId: u.id, motif: a.motif })
}
