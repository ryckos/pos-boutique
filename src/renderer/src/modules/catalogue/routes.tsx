/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCatalogue } from './PageCatalogue'
import { PageCategories } from './PageCategories'

export const routesCatalogue: DefinitionRoute[] = [
  { chemin: '/produits', libelle: 'Produits et stock', element: <PageCatalogue />, roles: ['gerant'] },
  { chemin: '/categories', libelle: 'Catégories', element: <PageCategories />, roles: ['gerant'] }
]
