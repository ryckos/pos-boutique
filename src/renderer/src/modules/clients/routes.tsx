/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageClients } from './PageClients'

export const routesClients: DefinitionRoute[] = [
  {
    chemin: '/clients',
    icone: 'utilisateur',
    libelle: 'Clients',
    element: <PageClients />,
    roles: ['caissier', 'gerant']
  }
]
