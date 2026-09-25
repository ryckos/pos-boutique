/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  annulerStockInitial,
  enregistrerStockInitial,
  etatStockInitial,
  ficheStockInitial
} from './stock-initial'

export function enregistrerIpcStock(): void {
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
