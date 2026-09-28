/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { etatStock } from './etat'
import { historiqueProduit } from './historique'
import {
  annulerStockInitial,
  enregistrerStockInitial,
  etatStockInitial,
  ficheStockInitial
} from './stock-initial'

export function enregistrerIpcStock(): void {
  // Écran stock : gérant, car il montre la valeur du stock au CUMP.
  gerer('stock:etat', () => {
    session.exiger(['gerant'])
    return etatStock(base())
  })
  gerer('stock:historiqueProduit', ({ produitId, du, au }) => {
    session.exiger(['gerant'])
    return historiqueProduit(base(), produitId, { du, au })
  })

  // Stock initial : gérant (matrice : « valider un inventaire », même mécanisme).
  gerer('stock:stockInitial', () => {
    session.exiger(['gerant'])
    return etatStockInitial(base())
  })
  gerer('stock:ficheStockInitial', ({ produitId }) => {
    session.exiger(['gerant'])
    return ficheStockInitial(base(), produitId)
  })
  gerer('stock:enregistrerStockInitial', (saisie) => {
    const u = session.exiger(['gerant'])
    return enregistrerStockInitial(base(), u.id, saisie)
  })
  gerer('stock:annulerStockInitial', ({ produitId, motif }) => {
    const u = session.exiger(['gerant'])
    annulerStockInitial(base(), u.id, produitId, motif)
  })
}
