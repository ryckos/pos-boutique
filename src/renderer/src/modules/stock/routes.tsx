/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PagePeremptions } from './PagePeremptions'
import { PageStock } from './PageStock'
import { PageStockInitial } from './PageStockInitial'

export const routesStock: DefinitionRoute[] = [
  { chemin: '/stock', libelle: 'Stock', element: <PageStock />, roles: ['gerant'] },
  { chemin: '/peremptions', libelle: 'Péremptions', element: <PagePeremptions />, roles: ['gerant'] },
  { chemin: '/stock-initial', libelle: 'Stock initial', element: <PageStockInitial />, roles: ['gerant'] }
]
