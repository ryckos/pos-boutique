/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { grille, produitsAvecStock, rechercherParCode, rechercherTexte } from './service'

export function enregistrerIpcCatalogue(): void {
  gerer('catalogue:rechercherCode', ({ code }) => {
    session.exiger()
    return rechercherParCode(base(), code)
  })
  gerer('catalogue:rechercher', ({ texte }) => {
    session.exiger()
    return rechercherTexte(base(), texte)
  })
  gerer('catalogue:grille', () => {
    session.exiger()
    return grille(base())
  })
  gerer('catalogue:produitsStock', () => {
    session.exiger()
    return produitsAvecStock(base())
  })
}
