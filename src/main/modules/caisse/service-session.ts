/**
 * Propriétaire : Dev A.
 *
 * Sessions de caisse — le minimum nécessaire pour vendre (règle 6.1), avancé en A2 parce qu'une
 * vente est toujours rattachée à une session. Clôture, rapports X et Z : tâche A4.
 */
import type { SessionCaisse } from '@shared/ipc/caisse'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'

/** La session ouverte du caissier, ou null. Un caissier a au plus une session ouverte. */
export function sessionOuverte(db: Db, utilisateurId: number): SessionCaisse | null {
  return (
    une<SessionCaisse>(
      db,
      `SELECT id, fond_ouverture AS fondOuverture, date_ouverture AS dateOuverture
       FROM sessions_caisse WHERE utilisateur_id = ? AND statut = 'ouverte'`,
      utilisateurId
    ) ?? null
  )
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
