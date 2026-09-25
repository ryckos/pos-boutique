/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageStockInitial } from './PageStockInitial'

export const routesStock: DefinitionRoute[] = [
  { chemin: '/stock-initial', libelle: 'Stock initial', element: <PageStockInitial />, roles: ['gerant'] }
]
