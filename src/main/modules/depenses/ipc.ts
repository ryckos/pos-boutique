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

// Gérant pour tout. La caissière enregistre une dépense payée au tiroir de sa caisse ouverte
// (matrice : « Depuis la caisse ») ; le service lui refuse les fonds propres.
export function enregistrerIpcDepenses(): void {
  gerer('depenses:categories', (requete) => {
    const u = session.exiger(['gerant', 'caissier'])
    return listerCategories(base(), u.role !== 'caissier' && (requete?.inclureInactives ?? false))
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
    const u = session.exiger(['gerant', 'caissier'])
    return listerDepenses(base(), filtre, u.role === 'caissier' ? u.id : undefined)
  })
  gerer('depenses:enregistrer', (saisie) => {
    const u = session.exiger(['gerant', 'caissier'])
    return enregistrerDepense(base(), u, saisie)
  })
  gerer('depenses:annuler', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    annulerDepense(base(), u.id, id, motif)
  })
}
