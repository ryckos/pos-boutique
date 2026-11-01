/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageAccueil } from './PageAccueil'
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

// Première entrée du menu : le gérant (et l'admin) arrivent ici après la connexion, la caissière reste
// sur la caisse (sa première route autorisée).
export const routesAccueil: DefinitionRoute[] = [
  {
    chemin: '/accueil',
    icone: 'boutique',
    libelle: 'Accueil',
    element: <PageAccueil />,
    roles: ['gerant']
  }
]
