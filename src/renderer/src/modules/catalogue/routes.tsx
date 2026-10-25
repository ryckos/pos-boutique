/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCategories } from './PageCategories'
import { PageProduits } from './PageProduits'

export const routesCatalogue: DefinitionRoute[] = [
  {
    chemin: '/produits',
    icone: 'produits',
    libelle: 'Produits',
    element: <PageProduits />,
    roles: ['gerant']
  },
  {
    chemin: '/categories',
    icone: 'categories',
    libelle: 'Catégories',
    element: <PageCategories />,
    roles: ['gerant']
  }
]
