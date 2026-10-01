/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageReceptions } from './PageReceptions'

export const routesAchats: DefinitionRoute[] = [
  { chemin: '/receptions', libelle: 'Réceptions', element: <PageReceptions />, roles: ['gerant'] }
]
