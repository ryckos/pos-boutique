import { createContext, useContext } from 'react'
import type { UtilisateurConnecte } from '@shared/types'

export const ContexteUtilisateur = createContext<UtilisateurConnecte | null>(null)

/** Utilisateur connecté, disponible dans tous les écrans. */
export function useUtilisateur(): UtilisateurConnecte {
  const u = useContext(ContexteUtilisateur)
  if (!u) throw new Error('useUtilisateur doit être utilisé après connexion')
  return u
}
