/** Propriétaire : Dev B. Consommé par Dev A (écran de caisse). */
import type { ArticleCatalogue, ProduitStock } from '../types'

export interface ContratCatalogue {
  /** LE canal du scan : code-barres OU code PLU → un conditionnement, ou null si inconnu. */
  'catalogue:rechercherCode': { requete: { code: string }; reponse: ArticleCatalogue | null }
  /** Recherche par nom (touche F2 de la caisse, écrans de gestion). */
  'catalogue:rechercher': { requete: { texte: string }; reponse: ArticleCatalogue[] }
  /** Boutons tactiles de la caisse (produits sans code-barres, lots, cartons…). */
  'catalogue:grille': { requete: void; reponse: ArticleCatalogue[] }
  /** Liste des produits avec leur stock calculé. */
  'catalogue:produitsStock': { requete: void; reponse: ProduitStock[] }
}
