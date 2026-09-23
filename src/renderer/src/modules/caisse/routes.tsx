/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCaisse } from './PageCaisse'

export const routesCaisse: DefinitionRoute[] = [
  { chemin: '/caisse', libelle: 'Caisse', element: <PageCaisse />, roles: ['caissier', 'gerant'] }
]
