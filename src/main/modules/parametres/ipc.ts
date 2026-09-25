/** Propriétaire : Dev B. Lecture pour tous les rôles ; l'écriture viendra avec l'écran (admin). */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { lireParametres } from './service'

export function enregistrerIpcParametres(): void {
  gerer('parametres:lire', () => {
    session.exiger()
    return lireParametres(base())
  })
}
