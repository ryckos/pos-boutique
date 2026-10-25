/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCommandes } from './PageCommandes'
import { PageReceptions } from './PageReceptions'

export const routesAchats: DefinitionRoute[] = [
  {
    chemin: '/commandes',
    icone: 'commandes',
    libelle: 'Commandes',
    element: <PageCommandes />,
    roles: ['gerant']
  },
  {
    chemin: '/receptions',
    icone: 'livrer',
    libelle: 'Réceptions',
    element: <PageReceptions />,
    roles: ['gerant']
  }
]
