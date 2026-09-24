/**
 * Menu de l'application. ZONE PARTAGÉE — une ligne par module, dans l'ordre d'affichage.
 * Une fonctionnalité non terminée peut être fusionnée SANS apparaître ici.
 */
import type { DefinitionRoute } from './types'
import { routesCaisse } from '@renderer/modules/caisse/routes'
import { routesCatalogue } from '@renderer/modules/catalogue/routes'
import { routesParametres } from '@renderer/modules/parametres/routes'
import { routesUtilisateurs } from '@renderer/modules/utilisateurs/routes'

export const routes: DefinitionRoute[] = [
  ...routesCaisse, // Dev A
  ...routesCatalogue, // Dev B
  ...routesUtilisateurs, // Dev B
  ...routesParametres // Dev B
]
