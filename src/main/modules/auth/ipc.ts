/** Propriétaire : Dev B. */
import type { UtilisateurConnecte } from '@shared/types'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { journaliser } from '../../core/audit'
import { session } from '../../core/session'
import {
  changerMonCode,
  comptesConnexion,
  connexion,
  creerPremierAdmin,
  definirCodePersonnel,
  etatDemarrage,
  etatVerrouillage
} from './service'

function ouvrirSession(u: UtilisateurConnecte): UtilisateurConnecte {
  session.definir(u)
  journaliser(base(), { utilisateurId: u.id, action: 'connexion' })
  return u
}

export function enregistrerIpcAuth(options: { modeDev: boolean }): void {
  // Les canaux suivants sont appelés AVANT toute connexion : pas de session.exiger().
  // La protection est dans le service (code vérifié, verrouillage, refus si un compte existe).
  gerer('auth:comptesConnexion', () => comptesConnexion(base()))

  gerer('auth:connexion', ({ utilisateurId, pin }) => {
    const r = connexion(base(), utilisateurId, pin)
    if ('utilisateur' in r) ouvrirSession(r.utilisateur)
    return r
  })

  gerer('auth:definirCodePersonnel', ({ utilisateurId, codeProvisoire, nouveauCode }) =>
    ouvrirSession(definirCodePersonnel(base(), utilisateurId, codeProvisoire, nouveauCode))
  )

  // Permet à l'écran de connexion d'afficher le compte à rebours et de bloquer le pavé.
  gerer('auth:etatVerrouillage', ({ utilisateurId }) => etatVerrouillage(base(), utilisateurId))

  gerer('auth:etatDemarrage', () => etatDemarrage(base(), !options.modeDev))

  gerer('auth:creerPremierAdmin', ({ nom, pin }) => ouvrirSession(creerPremierAdmin(base(), nom, pin)))

  // ─── Avec session ───
  gerer('auth:changerMonCode', ({ codeActuel, nouveauCode }) => {
    const u = session.exiger()
    changerMonCode(base(), u, codeActuel, nouveauCode)
  })

  gerer('auth:deconnexion', () => {
    const u = session.utilisateur()
    if (u) journaliser(base(), { utilisateurId: u.id, action: 'deconnexion' })
    session.effacer()
  })

  gerer('auth:utilisateurCourant', () => session.utilisateur())
}
