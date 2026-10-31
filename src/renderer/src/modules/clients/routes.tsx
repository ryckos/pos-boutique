/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageClients } from './PageClients'
import { PageRecouvrement } from './PageRecouvrement'

export const routesClients: DefinitionRoute[] = [
  {
    chemin: '/clients',
    icone: 'utilisateur',
    libelle: 'Clients',
    element: <PageClients />,
    roles: ['caissier', 'gerant']
  },
  {
    chemin: '/recouvrement',
    icone: 'payer',
    libelle: 'Recouvrement',
    element: <PageRecouvrement />,
    roles: ['gerant']
  }
]
