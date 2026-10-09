/** Propriétaire : Dev B. */
import type { DefinitionRoute } from '@renderer/app/types'
import { PageJournal } from './PageJournal'

// Matrice des droits : admin seulement ; l'admin voit tout, donc aucun autre profil.
export const routesAudit: DefinitionRoute[] = [
  { chemin: '/journal', libelle: 'Journal des opérations', element: <PageJournal />, roles: [] }
]
