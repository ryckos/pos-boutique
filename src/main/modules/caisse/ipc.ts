/**
 * Propriétaire : Dev A.
 * Canaux caisse:* — minces : droits, puis appel du service. Organisation du module :
 *   service-session.ts · service-vente.ts · calculs.ts (TVA, totaux — testés) · ipc.ts
 */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { ouvrirSession, sessionOuverte } from './service-session'
import { enregistrerVente } from './service-vente'

export function enregistrerIpcCaisse(): void {
  gerer('caisse:sessionCourante', () => {
    const u = session.exiger(['caissier', 'gerant'])
    return sessionOuverte(base(), u.id)
  })
  gerer('caisse:ouvrirSession', ({ fondOuverture }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return ouvrirSession(base(), u.id, fondOuverture)
  })
  gerer('caisse:enregistrerVente', (requete) => {
    const u = session.exiger(['caissier', 'gerant'])
    return enregistrerVente(base(), u.id, requete)
  })
}
