/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageInventaires } from './PageInventaires'

export const routesInventaires: DefinitionRoute[] = [
  { chemin: '/inventaires', libelle: 'Inventaires', element: <PageInventaires />, roles: ['gerant'] }
]
