/** Propriétaire : Dev B. Consommé par Dev A (écran de caisse). */
import type { ArticleCatalogue, ProduitStock } from '../types'

/** Rayon (parentId null) ou sous-rayon d'un rayon. Un seul niveau de sous-catégorie. */
export interface Categorie {
  id: number
  nom: string
  parentId: number | null
  actif: boolean
  /** Produits actifs rangés directement dans cette catégorie. */
  nbProduits: number
}

export interface ContratCatalogue {
  /** LE canal du scan : code-barres OU code PLU → un conditionnement, ou null si inconnu. */
  'catalogue:rechercherCode': { requete: { code: string }; reponse: ArticleCatalogue | null }
  /** Recherche par nom (touche F2 de la caisse, écrans de gestion). */
  'catalogue:rechercher': { requete: { texte: string }; reponse: ArticleCatalogue[] }
  /** Boutons tactiles de la caisse (produits sans code-barres, lots, cartons…). */
  'catalogue:grille': { requete: void; reponse: ArticleCatalogue[] }
  /**
   * Conditionnements actifs d'un produit (« changer le conditionnement » d'une ligne du ticket) :
   * l'Unité d'abord, puis par quantité croissante. Vide si le produit est inconnu ou désactivé.
   */
  'catalogue:conditionnementsProduit': { requete: { produitId: number }; reponse: ArticleCatalogue[] }
  /** Liste des produits avec leur stock calculé. */
  'catalogue:produitsStock': { requete: void; reponse: ProduitStock[] }
  /** Rayons suivis de leurs sous-rayons, par ordre alphabétique (désactivées comprises). */
  'catalogue:categories': { requete: void; reponse: Categorie[] }
  /** Sans parentId : un rayon. Avec : un sous-rayon de ce rayon. Gérant. */
  'catalogue:creerCategorie': { requete: { nom: string; parentId?: number | null }; reponse: { id: number } }
  'catalogue:renommerCategorie': { requete: { id: number; nom: string }; reponse: void }
  /** Jamais de suppression. Refusée si la catégorie contient des produits ou sous-catégories actifs. */
  'catalogue:desactiverCategorie': { requete: { id: number }; reponse: void }
}
