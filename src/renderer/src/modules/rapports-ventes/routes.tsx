/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageRapportsVentes } from './PageRapportsVentes'

// Matrice des droits : « Consulter les rapports financiers » = gérant et admin.
export const routesRapportsVentes: DefinitionRoute[] = [
  {
    chemin: '/rapports',
    icone: 'rapports',
    libelle: 'Rapports de ventes',
    element: <PageRapportsVentes />,
    roles: ['gerant']
  }
]
