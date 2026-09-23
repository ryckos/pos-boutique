/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCatalogue } from './PageCatalogue'

export const routesCatalogue: DefinitionRoute[] = [
  { chemin: '/produits', libelle: 'Produits et stock', element: <PageCatalogue />, roles: ['gerant'] }
]
