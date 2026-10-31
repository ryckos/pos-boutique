/**
 * Propriétaire : Dev A.
 * Canaux clients:* — minces : droits, puis appel du service (service.ts). La caissière crée et cherche
 * un client à la caisse ; le plafond et la désactivation sont au gérant.
 */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { buildDrawerPulse } from '../../materiel/escpos'
import { envoyerBrut } from '../../materiel/imprimante'
import { mettreEnPageRecu, mettreEnPageRelance } from '../../materiel/recouvrement'
import { enteteDepuis, reglagesDepuis } from '../../materiel/reglages'
import { lireParametres } from '../parametres/service'
import { creerClient, desactiverClient, ficheClient, modifierClient, rechercherClients } from './service'
import {
  annulerEncaissement,
  balanceAgee,
  encaisserCreance,
  historiqueClient,
  listeRelance,
  lireRecu
} from './service-recouvrement'

/**
 * Reçu (et tiroir pour les espèces), HORS transaction : le paiement est déjà enregistré, une
 * imprimante en panne ne l'annule pas. Dit ce qui est réellement sorti.
 */
async function imprimerRecu(
  numeroRecu: string,
  tiroir: boolean
): Promise<{ recu: boolean; tiroir: boolean }> {
  const db = base()
  const parametres = lireParametres(db)
  const reglages = reglagesDepuis(parametres)
  try {
    const octets = mettreEnPageRecu(
      lireRecu(db, numeroRecu),
      enteteDepuis(parametres),
      reglages.pageDeCodes,
      {
        tiroir
      }
    )
    await envoyerBrut(reglages.methode, reglages.cible, octets)
    return { recu: true, tiroir }
  } catch {
    // Reçu impossible : on tente au moins d'ouvrir le tiroir, le client a payé.
    if (!tiroir) return { recu: false, tiroir: false }
    try {
      await envoyerBrut(reglages.methode, reglages.cible, buildDrawerPulse())
      return { recu: false, tiroir: true }
    } catch {
      return { recu: false, tiroir: false }
    }
  }
}

export function enregistrerIpcClients(): void {
  gerer('clients:rechercher', ({ texte, inclureInactifs }) => {
    const u = session.exiger(['caissier', 'gerant'])
    const gerant = u.role !== 'caissier'
    return rechercherClients(base(), texte, gerant && inclureInactifs === true)
  })
  gerer('clients:lire', ({ clientId }) => {
    session.exiger(['caissier', 'gerant'])
    return ficheClient(base(), clientId)
  })
  gerer('clients:creer', (saisie) => {
    const u = session.exiger(['caissier', 'gerant'])
    return creerClient(base(), u, saisie)
  })
  gerer('clients:modifier', ({ clientId, saisie }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return modifierClient(base(), u, clientId, saisie)
  })
  gerer('clients:desactiver', ({ clientId, motif }) => {
    const u = session.exiger(['gerant'])
    desactiverClient(base(), u, clientId, motif)
  })
  gerer('clients:encaisserCreance', async (requete) => {
    const u = session.exiger(['caissier', 'gerant'])
    const fait = encaisserCreance(base(), u, requete)
    const sortie = await imprimerRecu(fait.numeroRecu, fait.mode === 'especes')
    return { ...fait, recuImprime: sortie.recu, tiroirOuvert: sortie.tiroir }
  })
  gerer('clients:annulerEncaissement', ({ numeroRecu, motif }) => {
    const u = session.exiger(['gerant'])
    annulerEncaissement(base(), u, { numeroRecu, motif })
  })
  gerer('clients:historique', ({ clientId }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return historiqueClient(base(), u, clientId)
  })
  gerer('clients:balanceAgee', () => {
    session.exiger(['gerant'])
    return balanceAgee(base())
  })
  gerer('clients:listeRelance', () => {
    session.exiger(['gerant'])
    return listeRelance(base())
  })
  gerer('clients:imprimerRelance', async () => {
    session.exiger(['gerant'])
    const db = base()
    const parametres = lireParametres(db)
    const reglages = reglagesDepuis(parametres)
    const date = new Date().toLocaleDateString('fr-FR')
    await envoyerBrut(
      reglages.methode,
      reglages.cible,
      mettreEnPageRelance(listeRelance(db), enteteDepuis(parametres), reglages.pageDeCodes, date)
    )
  })
}
