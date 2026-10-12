/**
 * Propriétaire : Dev A.
 *
 * Sessions de caisse — le minimum nécessaire pour vendre (règle 6.1), avancé en A2 parce qu'une
 * vente est toujours rattachée à une session. Clôture, rapports X et Z : tâche A4.
 */
import type { SessionCaisse } from '@shared/ipc/caisse'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'

/**
 * Avec `utilisateurId` : la session ouverte de ce caissier, ou null (il en a au plus une).
 *
 * Sans utilisateur (pour Dev B, dépenses payées au tiroir, A8) : la session du tiroir quand une
 * seule caisse est ouverte, sinon null — aucune caisse ouverte, ou plusieurs : l'écran fait alors
 * choisir le gérant parmi `sessionsOuvertes(db)` (service-cloture.ts) et transmet le `sessionId`.
 */
export function sessionOuverte(db: Db, utilisateurId?: number): SessionCaisse | null {
  const colonnes =
    'SELECT id, fond_ouverture AS fondOuverture, date_ouverture AS dateOuverture FROM sessions_caisse'
  if (utilisateurId !== undefined) {
    return (
      une<SessionCaisse>(db, `${colonnes} WHERE utilisateur_id = ? AND statut = 'ouverte'`, utilisateurId) ??
      null
    )
  }
  const ouvertes = toutes<SessionCaisse>(db, `${colonnes} WHERE statut = 'ouverte' LIMIT 2`)
  return ouvertes.length === 1 ? ouvertes[0] : null
}

export function ouvrirSession(db: Db, utilisateurId: number, fondOuverture: number): SessionCaisse {
  if (!Number.isInteger(fondOuverture) || fondOuverture < 0) {
    throw new ErreurMetier('Fond de caisse invalide : saisissez un montant en francs, sans virgule.')
  }
  return avecTransaction(db, () => {
    if (sessionOuverte(db, utilisateurId)) {
      throw new ErreurMetier('Votre caisse est déjà ouverte : continuez à vendre sur cette session.')
    }
    const { id } = executer(
      db,
      'INSERT INTO sessions_caisse (utilisateur_id, fond_ouverture) VALUES (?, ?)',
      utilisateurId,
      fondOuverture
    )
    journaliser(db, {
      utilisateurId,
      action: 'ouverture_session_caisse',
      entite: 'sessions_caisse',
      entiteId: id,
      apres: { fondOuverture }
    })
    return sessionOuverte(db, utilisateurId)!
  })
}
