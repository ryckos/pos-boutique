/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { articleReception, lireReception, listerReceptions, validerReception } from './receptions'
import {
  annulerCommande,
  cloturerCommande,
  commandesOuvertes,
  creerCommande,
  envoyerCommande,
  lireCommande,
  listerCommandes,
  modifierCommande,
  produitsEnAlerte
} from './commandes'

// Gérant : matrice des droits, « réceptionner une livraison ».
export function enregistrerIpcAchats(): void {
  gerer('achats:articleReception', ({ conditionnementId }) => {
    session.exiger(['gerant'])
    return articleReception(base(), conditionnementId)
  })
  gerer('achats:validerReception', (saisie) => {
    const u = session.exiger(['gerant'])
    return validerReception(base(), u.id, saisie)
  })
  gerer('achats:reception', ({ id }) => {
    session.exiger(['gerant'])
    return lireReception(base(), id)
  })
  gerer('achats:listeReceptions', () => {
    session.exiger(['gerant'])
    return listerReceptions(base())
  })

  // Commandes fournisseur (REGLES_METIER § 4.7) : gérant, comme la réception.
  gerer('achats:creerCommande', (saisie) => {
    const u = session.exiger(['gerant'])
    return creerCommande(base(), u.id, saisie)
  })
  gerer('achats:modifierCommande', ({ id, ...saisie }) => {
    session.exiger(['gerant'])
    modifierCommande(base(), id, saisie)
  })
  gerer('achats:envoyerCommande', ({ id }) => {
    session.exiger(['gerant'])
    envoyerCommande(base(), id)
  })
  gerer('achats:annulerCommande', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    annulerCommande(base(), u.id, id, motif)
  })
  gerer('achats:cloturerCommande', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    cloturerCommande(base(), u.id, id, motif)
  })
  gerer('achats:commande', ({ id }) => {
    session.exiger(['gerant'])
    return lireCommande(base(), id)
  })
  gerer('achats:listeCommandes', () => {
    session.exiger(['gerant'])
    return listerCommandes(base())
  })
  gerer('achats:commandesOuvertes', ({ fournisseurId }) => {
    session.exiger(['gerant'])
    return commandesOuvertes(base(), fournisseurId)
  })
  gerer('achats:produitsEnAlerte', () => {
    session.exiger(['gerant'])
    return produitsEnAlerte(base())
  })
}
