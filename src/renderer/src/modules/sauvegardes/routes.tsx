/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageSauvegardes } from './PageSauvegardes'

// Gérant : consulter et sauvegarder ; la clé USB et la restauration sont réservées à l'admin dans la page.
export const routesSauvegardes: DefinitionRoute[] = [
  {
    chemin: '/sauvegardes',
    icone: 'sauvegarder',
    libelle: 'Sauvegardes',
    element: <PageSauvegardes />,
    roles: ['gerant']
  }
]
