import type { ReactNode } from 'react'
import type { Role } from '@shared/types'
import type { NomIcone } from '@renderer/ui/Icone'

/** Une entrée du menu. Chaque module exporte les siennes depuis son fichier routes.tsx. */
export interface DefinitionRoute {
  chemin: string
  libelle: string
  /** Icône du menu : seule visible quand le menu est replié (écran étroit). */
  icone: NomIcone
  element: ReactNode
  /** Profils autorisés (l'admin voit tout). */
  roles: Role[]
}
