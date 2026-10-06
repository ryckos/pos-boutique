/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { achatsFournisseur } from './achats'
import { noterAvoirRecu, refuserAvoir } from './avoirs'
import { annulerReglement, dettesFournisseur, enregistrerReglement } from './reglements'
import { creerFournisseur, desactiverFournisseur, listerFournisseurs, modifierFournisseur } from './service'

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
  gerer('fournisseurs:achats', ({ fournisseurId, du, au }) => {
    session.exiger(['gerant'])
    return achatsFournisseur(base(), fournisseurId, { du, au })
  })
  gerer('fournisseurs:enregistrerReglement', (saisie) => {
    const u = session.exiger(['gerant'])
    return { id: enregistrerReglement(base(), u.id, saisie) }
  })
  gerer('fournisseurs:annulerReglement', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    annulerReglement(base(), u.id, id, motif)
  })
  gerer('fournisseurs:avoirRecu', (saisie) => {
    const u = session.exiger(['gerant'])
    noterAvoirRecu(base(), u.id, saisie)
  })
  gerer('fournisseurs:refuserAvoir', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    refuserAvoir(base(), u.id, id, motif)
  })
  gerer('fournisseurs:dettes', ({ fournisseurId }) => {
    session.exiger(['gerant'])
    return dettesFournisseur(base(), fournisseurId)
  })
}
