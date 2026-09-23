/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageMonCode } from './PageMonCode'
import { PageUtilisateurs } from './PageUtilisateurs'

export const routesUtilisateurs: DefinitionRoute[] = [
  // Gérer les comptes : admin seulement (matrice des droits). L'admin voit toutes les routes.
  { chemin: '/comptes', libelle: 'Comptes utilisateurs', element: <PageUtilisateurs />, roles: [] },
  // Chacun change son propre code.
  { chemin: '/mon-code', libelle: 'Mon code', element: <PageMonCode />, roles: ['caissier', 'gerant'] }
]
