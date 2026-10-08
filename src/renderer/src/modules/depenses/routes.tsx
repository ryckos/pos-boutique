/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageDepenses } from './PageDepenses'

// Gérant tant que les dépenses payées au tiroir (caissière) attendent A8 de Dev A.
export const routesDepenses: DefinitionRoute[] = [
  { chemin: '/depenses', libelle: 'Dépenses', element: <PageDepenses />, roles: ['gerant'] }
]
