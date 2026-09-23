import type { ReactNode } from 'react'
import type { Role } from '@shared/types'

/** Une entrée du menu. Chaque module exporte les siennes depuis son fichier routes.tsx. */
export interface DefinitionRoute {
  chemin: string
  libelle: string
  element: ReactNode
  /** Profils autorisés (l'admin voit tout). */
  roles: Role[]
}
