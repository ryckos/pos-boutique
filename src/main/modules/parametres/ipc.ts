/** Propriétaire : Dev B. Lecture : tous les rôles. Écriture : admin (gérant pour l'imprimante, voir le service). */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { ecrireParametres, lireParametres } from './service'
import { appliquerDemarrageAutomatique } from '../../demarrage'

export function enregistrerIpcParametres(): void {
  gerer('parametres:lire', () => {
    session.exiger()
    return lireParametres(base())
  })
  gerer('parametres:ecrire', (modifications) => {
    const u = session.exiger(['gerant'])
    const parametres = ecrireParametres(base(), u, modifications)
    // Hors transaction : Windows suit le paramètre dès qu'il est enregistré.
    if ('demarrageAutomatique' in modifications) appliquerDemarrageAutomatique(base())
    return parametres
  })
}
