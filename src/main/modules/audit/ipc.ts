/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { choixJournal, lireJournal } from './service'

// Matrice des droits : « Consulter le journal des opérations » = admin seulement.
export function enregistrerIpcAudit(): void {
  gerer('audit:journal', (filtre) => {
    session.exiger(['admin'])
    return lireJournal(base(), filtre)
  })
  gerer('audit:choix', () => {
    session.exiger(['admin'])
    return choixJournal(base())
  })
}
