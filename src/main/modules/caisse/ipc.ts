/**
 * Propriétaire : Dev A.
 * Canaux caisse:* — minces : droits, puis appel du service. Organisation du module :
 *   service-session.ts · service-vente.ts · service-ticket.ts · calculs.ts (TVA, totaux — testés) · ipc.ts
 */
import type { UtilisateurConnecte } from '@shared/types'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { envoyerBrut } from '../../materiel/imprimante'
import { enteteDepuis, reglagesDepuis } from '../../materiel/reglages'
import { mettreEnPageTicket } from '../../materiel/ticket'
import { lireParametres } from '../parametres/service'
import { ouvrirSession, sessionOuverte } from './service-session'
import { enregistrerVente } from './service-vente'
import {
  dejaImprime,
  lireTicket,
  noterImpression,
  ouvrirTiroirPour,
  venteParNumero,
  verifierDroitImpression
} from './service-ticket'

/**
 * Relit la vente, l'imprime puis la note au journal. Toujours APRÈS la transaction de vente :
 * une imprimante en panne ne bloque jamais une vente (elle lève seulement une erreur à afficher).
 */
async function imprimer(u: UtilisateurConnecte, venteId: number): Promise<{ duplicata: boolean }> {
  const db = base()
  verifierDroitImpression(db, u, venteId)
  const ticket = lireTicket(db, venteId)
  const duplicata = dejaImprime(db, venteId)
  // En-tête, pied et imprimante : paramètres de la boutique (Dev B, B5), relus à chaque ticket.
  const parametres = lireParametres(db)
  const reglages = reglagesDepuis(parametres)
  const octets = mettreEnPageTicket(ticket, enteteDepuis(parametres), reglages.pageDeCodes, {
    duplicata,
    tiroir: ouvrirTiroirPour(ticket, duplicata)
  })
  await envoyerBrut(reglages.methode, reglages.cible, octets)
  noterImpression(db, u.id, venteId, duplicata)
  return { duplicata }
}

export function enregistrerIpcCaisse(): void {
  gerer('caisse:sessionCourante', () => {
    const u = session.exiger(['caissier', 'gerant'])
    return sessionOuverte(base(), u.id)
  })
  gerer('caisse:ouvrirSession', ({ fondOuverture }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return ouvrirSession(base(), u.id, fondOuverture)
  })
  gerer('caisse:enregistrerVente', (requete) => {
    const u = session.exiger(['caissier', 'gerant'])
    return enregistrerVente(base(), u.id, requete)
  })
  gerer('caisse:imprimerTicket', ({ venteId }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return imprimer(u, venteId)
  })
  gerer('caisse:reimprimerTicket', ({ numeroTicket }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return imprimer(u, venteParNumero(base(), numeroTicket))
  })
}
