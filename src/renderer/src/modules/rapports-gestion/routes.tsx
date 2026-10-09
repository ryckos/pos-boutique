/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageRapports } from './PageRapports'

// Matrice des droits : « Consulter les rapports financiers » = gérant et admin.
export const routesRapportsGestion: DefinitionRoute[] = [
  {
    chemin: '/rapports-gestion',
    libelle: 'Rapports de gestion',
    element: <PageRapports />,
    roles: ['gerant']
  }
]
