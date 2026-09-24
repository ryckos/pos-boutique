/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  conditionnementsProduit,
  grille,
  produitsAvecStock,
  rechercherParCode,
  rechercherTexte
} from './service'
import {
  creerProduit,
  desactiverProduit,
  ficheProduit,
  genererCodeInterne,
  listeProduits,
  modifierProduit
} from './produits'
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
  gerer('catalogue:conditionnementsProduit', ({ produitId }) => {
    session.exiger()
    return conditionnementsProduit(base(), produitId)
  })
  gerer('catalogue:produitsStock', () => {
    // Valeur du stock au CUMP : donnée de gestion, pas pour la caisse.
    session.exiger(['gerant'])
    return produitsAvecStock(base())
  })

  // Produits : gérant (matrice : « créer ou modifier un produit »). La caisse ne lit le catalogue
  // que par les canaux ci-dessus.
  gerer('catalogue:listeProduits', () => {
    session.exiger(['gerant'])
    return listeProduits(base())
  })
  gerer('catalogue:ficheProduit', ({ id }) => {
    session.exiger(['gerant'])
    return ficheProduit(base(), id)
  })
  gerer('catalogue:creerProduit', (saisie) => {
    session.exiger(['gerant'])
    return creerProduit(base(), saisie)
  })
  gerer('catalogue:modifierProduit', ({ id, ...saisie }) => {
    const u = session.exiger(['gerant'])
    return modifierProduit(base(), u.id, id, saisie)
  })
  gerer('catalogue:desactiverProduit', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    desactiverProduit(base(), u.id, id, motif)
  })
  gerer('catalogue:genererCodeInterne', () => {
    session.exiger(['gerant'])
    return { code: genererCodeInterne(base()) }
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
