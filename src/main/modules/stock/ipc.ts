/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { etatStock } from './etat'
import { historiqueProduit } from './historique'
import { retirerLot, tableauPeremptions } from './peremptions'
import { annulerSortie, enregistrerSortie, ficheSortie, listerSorties } from './sorties'
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

  // Péremptions : gérant (valeur en jeu au prix d'achat, retrait = perte chiffrée).
  gerer('stock:peremptions', () => {
    session.exiger(['gerant'])
    return tableauPeremptions(base())
  })
  gerer('stock:retirerLot', (requete) => {
    const u = session.exiger(['gerant'])
    return retirerLot(base(), u.id, requete)
  })

  // Sorties de stock et retours fournisseur : gérant (pertes chiffrées, avoirs).
  gerer('stock:ficheSortie', ({ produitId }) => {
    session.exiger(['gerant'])
    return ficheSortie(base(), produitId)
  })
  gerer('stock:enregistrerSortie', (saisie) => {
    const u = session.exiger(['gerant'])
    return enregistrerSortie(base(), u.id, saisie)
  })
  gerer('stock:sorties', (periode) => {
    session.exiger(['gerant'])
    return listerSorties(base(), periode)
  })
  gerer('stock:annulerSortie', ({ mouvementId, motif }) => {
    const u = session.exiger(['gerant'])
    annulerSortie(base(), u.id, mouvementId, motif)
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
