/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageFournisseurs } from './PageFournisseurs'

export const routesFournisseurs: DefinitionRoute[] = [
  { chemin: '/fournisseurs', libelle: 'Fournisseurs', element: <PageFournisseurs />, roles: ['gerant'] }
]
