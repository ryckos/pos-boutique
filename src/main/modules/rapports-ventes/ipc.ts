/** Propriétaire : Dev A. Canaux rapports-ventes:* — gérant (et admin), lecture seule. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { classementProduits, historiqueSessions, ventesParCaissier, ventesParHeure } from './service'

export function enregistrerIpcRapportsVentes(): void {
  gerer('rapports-ventes:parHeure', (periode) => {
    session.exiger(['gerant'])
    return ventesParHeure(base(), periode)
  })
  gerer('rapports-ventes:parCaissier', (periode) => {
    session.exiger(['gerant'])
    return ventesParCaissier(base(), periode)
  })
  gerer('rapports-ventes:produits', (requete) => {
    session.exiger(['gerant'])
    return classementProduits(base(), requete)
  })
  gerer('rapports-ventes:sessions', (periode) => {
    session.exiger(['gerant'])
    return historiqueSessions(base(), periode)
  })
}
