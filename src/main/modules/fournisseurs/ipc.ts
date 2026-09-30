/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  creerFournisseur,
  desactiverFournisseur,
  listerFournisseurs,
  modifierFournisseur
} from './service'

// Gérant : les fournisseurs vont avec les réceptions (matrice : « réceptionner une livraison »).
export function enregistrerIpcFournisseurs(): void {
  gerer('fournisseurs:liste', () => {
    session.exiger(['gerant'])
    return listerFournisseurs(base())
  })
  gerer('fournisseurs:creer', (saisie) => {
    session.exiger(['gerant'])
    return { id: creerFournisseur(base(), saisie) }
  })
  gerer('fournisseurs:modifier', ({ id, ...saisie }) => {
    session.exiger(['gerant'])
    modifierFournisseur(base(), id, saisie)
  })
  gerer('fournisseurs:desactiver', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    desactiverFournisseur(base(), u.id, id, motif)
  })
}
