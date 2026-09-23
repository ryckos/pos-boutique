/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { journaliser } from '../../core/audit'
import { session } from '../../core/session'
import { connexion } from './service'

export function enregistrerIpcAuth(): void {
  gerer('auth:connexion', ({ pin }) => {
    const u = connexion(base(), pin)
    session.definir(u)
    journaliser(base(), { utilisateurId: u.id, action: 'connexion' })
    return u
  })

  gerer('auth:deconnexion', () => {
    const u = session.utilisateur()
    if (u) journaliser(base(), { utilisateurId: u.id, action: 'deconnexion' })
    session.effacer()
  })

  gerer('auth:utilisateurCourant', () => session.utilisateur())
}
