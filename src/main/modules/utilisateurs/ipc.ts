/** Propriétaire : Dev B. Gestion des comptes : admin seulement (matrice des droits, chapitre 5). */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { changerRole, creerCompte, desactiverCompte, listerComptes, reinitialiserCode } from './service'

export function enregistrerIpcUtilisateurs(): void {
  gerer('utilisateurs:lister', () => {
    session.exiger(['admin'])
    return listerComptes(base())
  })
  gerer('utilisateurs:creer', ({ nom, pin, role }) => {
    const u = session.exiger(['admin'])
    return { id: creerCompte(base(), u, nom, pin, role) }
  })
  gerer('utilisateurs:reinitialiserCode', ({ id, pin }) => {
    const u = session.exiger(['admin'])
    reinitialiserCode(base(), u, id, pin)
  })
  gerer('utilisateurs:changerRole', ({ id, role }) => {
    const u = session.exiger(['admin'])
    changerRole(base(), u, id, role)
    // L'admin qui change son propre rôle perd ses droits tout de suite, pas à la prochaine connexion.
    if (id === u.id) session.definir({ ...u, role })
  })
  gerer('utilisateurs:desactiver', ({ id, motif }) => {
    const u = session.exiger(['admin'])
    desactiverCompte(base(), u, id, motif)
  })
}
