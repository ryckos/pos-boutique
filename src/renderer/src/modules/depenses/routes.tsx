/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageDepenses } from './PageDepenses'

// Gérant ; la caissière y saisit les dépenses payées au tiroir de sa caisse (vue restreinte).
export const routesDepenses: DefinitionRoute[] = [
  {
    chemin: '/depenses',
    icone: 'depenses',
    libelle: 'Dépenses',
    element: <PageDepenses />,
    roles: ['gerant', 'caissier']
  }
]
