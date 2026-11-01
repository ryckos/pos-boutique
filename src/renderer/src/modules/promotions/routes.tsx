/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PagePromotions } from './PagePromotions'

// Les promotions changent les prix : gérant et admin seulement.
export const routesPromotions: DefinitionRoute[] = [
  {
    chemin: '/promotions',
    icone: 'promotion',
    libelle: 'Promotions',
    element: <PagePromotions />,
    roles: ['gerant']
  }
]
