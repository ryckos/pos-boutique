/**
 * Propriétaire : Dev A.
 * Canaux clients:* — minces : droits, puis appel du service (service.ts). La caissière crée et cherche
 * un client à la caisse ; le plafond et la désactivation sont au gérant.
 */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { creerClient, desactiverClient, ficheClient, modifierClient, rechercherClients } from './service'

export function enregistrerIpcClients(): void {
  gerer('clients:rechercher', ({ texte, inclureInactifs }) => {
    const u = session.exiger(['caissier', 'gerant'])
    const gerant = u.role !== 'caissier'
    return rechercherClients(base(), texte, gerant && inclureInactifs === true)
  })
  gerer('clients:lire', ({ clientId }) => {
    session.exiger(['caissier', 'gerant'])
    return ficheClient(base(), clientId)
  })
  gerer('clients:creer', (saisie) => {
    const u = session.exiger(['caissier', 'gerant'])
    return creerClient(base(), u, saisie)
  })
  gerer('clients:modifier', ({ clientId, saisie }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return modifierClient(base(), u, clientId, saisie)
  })
  gerer('clients:desactiver', ({ clientId, motif }) => {
    const u = session.exiger(['gerant'])
    desactiverClient(base(), u, clientId, motif)
  })
}
