/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCatalogue } from './PageCatalogue'
import { PageCategories } from './PageCategories'
import { PageProduits } from './PageProduits'

export const routesCatalogue: DefinitionRoute[] = [
  { chemin: '/produits', libelle: 'Produits', element: <PageProduits />, roles: ['gerant'] },
  { chemin: '/categories', libelle: 'Catégories', element: <PageCategories />, roles: ['gerant'] },
  // Aperçu du stock, à compléter en B4 (alertes, historique d'un produit).
  { chemin: '/stock', libelle: 'Stock', element: <PageCatalogue />, roles: ['gerant'] }
]
