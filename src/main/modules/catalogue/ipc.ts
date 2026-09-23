/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { grille, produitsAvecStock, rechercherParCode, rechercherTexte } from './service'
import { creerCategorie, desactiverCategorie, listerCategories, renommerCategorie } from './categories'

export function enregistrerIpcCatalogue(): void {
  gerer('catalogue:rechercherCode', ({ code }) => {
    session.exiger()
    return rechercherParCode(base(), code)
  })
  gerer('catalogue:rechercher', ({ texte }) => {
    session.exiger()
    return rechercherTexte(base(), texte)
  })
  gerer('catalogue:grille', () => {
    session.exiger()
    return grille(base())
  })
  gerer('catalogue:produitsStock', () => {
    // Valeur du stock au CUMP : donnée de gestion, pas pour la caisse.
    session.exiger(['gerant'])
    return produitsAvecStock(base())
  })

  // Catégories : lecture pour tous (grille, fiches), modification par le gérant (matrice :
  // « créer ou modifier un produit »).
  gerer('catalogue:categories', () => {
    session.exiger()
    return listerCategories(base())
  })
  gerer('catalogue:creerCategorie', ({ nom, parentId }) => {
    session.exiger(['gerant'])
    return { id: creerCategorie(base(), nom, parentId ?? null) }
  })
  gerer('catalogue:renommerCategorie', ({ id, nom }) => {
    session.exiger(['gerant'])
    renommerCategorie(base(), id, nom)
  })
  gerer('catalogue:desactiverCategorie', ({ id }) => {
    session.exiger(['gerant'])
    desactiverCategorie(base(), id)
  })
}
