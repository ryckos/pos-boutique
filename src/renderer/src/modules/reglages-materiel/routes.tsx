/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageReglagesMateriel } from './PageReglagesMateriel'

export const routesReglagesMateriel: DefinitionRoute[] = [
  {
    chemin: '/reglages-materiel',
    libelle: 'Réglages matériel',
    element: <PageReglagesMateriel />,
    roles: ['gerant']
  }
]
