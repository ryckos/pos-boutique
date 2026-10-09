/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  annulerDepense,
  creerCategorie,
  desactiverCategorie,
  enregistrerDepense,
  listerCategories,
  listerDepenses
} from './service'

// Gérant pour tout tant que la source « caisse » attend A8. Ensuite, la caissière pourra
// enregistrer une dépense payée au tiroir de sa session (matrice : « Depuis la caisse »).
export function enregistrerIpcDepenses(): void {
  gerer('depenses:categories', (requete) => {
    session.exiger(['gerant'])
    return listerCategories(base(), requete?.inclureInactives ?? false)
  })
  gerer('depenses:creerCategorie', ({ nom }) => {
    session.exiger(['gerant'])
    return creerCategorie(base(), nom)
  })
  gerer('depenses:desactiverCategorie', ({ id }) => {
    session.exiger(['gerant'])
    desactiverCategorie(base(), id)
  })
  gerer('depenses:liste', (filtre) => {
    session.exiger(['gerant'])
    return listerDepenses(base(), filtre)
  })
  gerer('depenses:enregistrer', (saisie) => {
    const u = session.exiger(['gerant'])
    return enregistrerDepense(base(), u.id, saisie)
  })
  gerer('depenses:annuler', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    annulerDepense(base(), u.id, id, motif)
  })
}
