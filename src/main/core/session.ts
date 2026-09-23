/**
 * Utilisateur connecté, conservé côté processus principal.
 * L'interface ne transmet JAMAIS d'identifiant d'utilisateur : chaque service
 * demande session.exiger() — l'identité ne peut donc pas être falsifiée.
 * ZONE PARTAGÉE.
 */
import type { Role, UtilisateurConnecte } from '@shared/types'
import { ErreurMetier } from './erreurs'

let courant: UtilisateurConnecte | null = null

export const session = {
  definir(u: UtilisateurConnecte): void {
    courant = u
  },
  effacer(): void {
    courant = null
  },
  utilisateur(): UtilisateurConnecte | null {
    return courant
  },
  /** Renvoie l'utilisateur connecté, ou refuse. L'admin a tous les droits. */
  exiger(roles?: Role[]): UtilisateurConnecte {
    if (!courant) throw new ErreurMetier('Session expirée : reconnectez-vous')
    if (roles && courant.role !== 'admin' && !roles.includes(courant.role)) {
      throw new ErreurMetier('Action non autorisée pour votre profil')
    }
    return courant
  }
}
