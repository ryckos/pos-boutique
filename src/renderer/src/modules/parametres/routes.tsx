/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageParametres } from './PageParametres'

export const routesParametres: DefinitionRoute[] = [
  // Admin seulement (l'admin voit toutes les routes).
  { chemin: '/parametres', libelle: 'Paramètres', element: <PageParametres />, roles: [] }
]
