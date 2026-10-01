/** Propriétaire : Dev A. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageCaisse } from './PageCaisse'
import { PageClotureCaisse } from './PageClotureCaisse'

export const routesCaisse: DefinitionRoute[] = [
  { chemin: '/caisse', libelle: 'Caisse', element: <PageCaisse />, roles: ['caissier', 'gerant'] },
  // Chemin hors de /caisse : le lien Caisse du menu ne reste pas surligné pendant la clôture.
  {
    chemin: '/cloture',
    libelle: 'Clôture de caisse',
    element: <PageClotureCaisse />,
    roles: ['caissier', 'gerant']
  }
]
