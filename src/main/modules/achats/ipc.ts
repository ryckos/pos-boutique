/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { articleReception, lireReception, listerReceptions, validerReception } from './receptions'

// Gérant : matrice des droits, « réceptionner une livraison ».
export function enregistrerIpcAchats(): void {
  gerer('achats:articleReception', ({ conditionnementId }) => {
    session.exiger(['gerant'])
    return articleReception(base(), conditionnementId)
  })
  gerer('achats:validerReception', (saisie) => {
    const u = session.exiger(['gerant'])
    return validerReception(base(), u.id, saisie)
  })
  gerer('achats:reception', ({ id }) => {
    session.exiger(['gerant'])
    return lireReception(base(), id)
  })
  gerer('achats:listeReceptions', () => {
    session.exiger(['gerant'])
    return listerReceptions(base())
  })
}
