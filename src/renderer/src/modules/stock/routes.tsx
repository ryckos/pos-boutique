/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PagePeremptions } from './PagePeremptions'
import { PageSorties } from './PageSorties'
import { PageStock } from './PageStock'
import { PageStockInitial } from './PageStockInitial'

export const routesStock: DefinitionRoute[] = [
  { chemin: '/stock', icone: 'stock', libelle: 'Stock', element: <PageStock />, roles: ['gerant'] },
  {
    chemin: '/peremptions',
    icone: 'peremptions',
    libelle: 'Péremptions',
    element: <PagePeremptions />,
    roles: ['gerant']
  },
  {
    chemin: '/sorties',
    icone: 'sorties',
    libelle: 'Sorties de stock',
    element: <PageSorties />,
    roles: ['gerant']
  },
  {
    chemin: '/stock-initial',
    icone: 'inventaires',
    libelle: 'Stock initial',
    element: <PageStockInitial />,
    roles: ['gerant']
  }
]
