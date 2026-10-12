/**
 * Propriétaire : Dev A.
 * Canaux caisse:* — minces : droits, puis appel du service. Organisation du module :
 *   service-session.ts · service-vente.ts · service-ticket.ts · service-cloture.ts ·
 *   service-mouvements.ts · calculs.ts (TVA, totaux — testés) · ipc.ts
 */
import type { MouvementCaisse, MouvementEnregistre } from '@shared/ipc/caisse'
import type { UtilisateurConnecte } from '@shared/types'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { buildDrawerPulse } from '../../materiel/escpos'
import { envoyerBrut } from '../../materiel/imprimante'
import { enteteDepuis, reglagesDepuis } from '../../materiel/reglages'
import { mettreEnPageRapport } from '../../materiel/rapport'
import { mettreEnPageTicket } from '../../materiel/ticket'
import { lireParametres } from '../parametres/service'
import {
  cloturerSession,
  noterImpressionZ,
  rapportSession,
  rapportZImprime,
  sessionsOuvertes,
  sessionVisee,
  verifierAccesSession,
  verifierTypeRapport
} from './service-cloture'
import {
  annulerMouvementAuTiroir,
  mouvementsSession,
  saisirMouvementAuTiroir,
  sessionPourMouvement
} from './service-mouvements'
import { ouvrirSession, sessionOuverte } from './service-session'
import { autoriserRemise, enregistrerVente, gerantsActifs } from './service-vente'
import { journaliserLignesAnnulees } from './service-lignes-annulees'
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

/**
 * Ouvre le tiroir après un mouvement de caisse, HORS transaction. Le mouvement est déjà enregistré :
 * une imprimante en panne ne l'annule pas, l'écran dit seulement d'ouvrir le tiroir à la clé.
 * Pas de journal `ouverture_tiroir_hors_vente` : le mouvement lui-même est journalisé.
 */
async function ouvrirTiroirApresMouvement(mouvement: MouvementCaisse): Promise<MouvementEnregistre> {
  try {
    const reglages = reglagesDepuis(lireParametres(base()))
    await envoyerBrut(reglages.methode, reglages.cible, buildDrawerPulse())
    return { mouvement, tiroirOuvert: true }
  } catch {
    return { mouvement, tiroirOuvert: false }
  }
}

/** Rapport X ou Z, toujours APRÈS la clôture : une imprimante en panne ne l'annule jamais. */
async function imprimerRapport(
  u: UtilisateurConnecte,
  sessionId: number,
  type: 'X' | 'Z'
): Promise<{ duplicata: boolean }> {
  const db = base()
  verifierAccesSession(db, u, sessionId)
  const rapport = rapportSession(db, sessionId)
  verifierTypeRapport(rapport, type)
  const duplicata = type === 'Z' && rapportZImprime(db, sessionId)
  const parametres = lireParametres(db)
  const reglages = reglagesDepuis(parametres)
  const octets = mettreEnPageRapport(rapport, enteteDepuis(parametres), reglages.pageDeCodes, {
    type,
    duplicata
  })
  await envoyerBrut(reglages.methode, reglages.cible, octets)
  if (type === 'Z') noterImpressionZ(db, u.id, sessionId, duplicata)
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
  gerer('caisse:gerants', () => {
    session.exiger(['caissier', 'gerant'])
    return gerantsActifs(base())
  })
  gerer('caisse:autoriserRemise', (demande) => {
    const u = session.exiger(['caissier', 'gerant'])
    return autoriserRemise(base(), u.id, demande)
  })
  gerer('caisse:journaliserAnnulationLigne', ({ lignes, abandon }) => {
    const u = session.exiger(['caissier', 'gerant'])
    journaliserLignesAnnulees(base(), u.id, lignes, abandon)
  })
  gerer('caisse:imprimerTicket', ({ venteId }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return imprimer(u, venteId)
  })
  gerer('caisse:reimprimerTicket', ({ numeroTicket }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return imprimer(u, venteParNumero(base(), numeroTicket))
  })
  gerer('caisse:sessionsOuvertes', () => {
    session.exiger(['gerant'])
    return sessionsOuvertes(base())
  })
  gerer('caisse:rapportSession', ({ sessionId }) => {
    const u = session.exiger(['caissier', 'gerant'])
    const db = base()
    const id = sessionVisee(db, u, sessionId)
    verifierAccesSession(db, u, id)
    return rapportSession(db, id)
  })
  gerer('caisse:cloturerSession', (requete) => {
    const u = session.exiger(['caissier', 'gerant'])
    return cloturerSession(base(), u, requete)
  })
  gerer('caisse:imprimerRapport', ({ sessionId, type }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return imprimerRapport(u, sessionId, type)
  })
  gerer('caisse:mouvementsSession', ({ sessionId }) => {
    session.exiger(['gerant'])
    const db = base()
    return mouvementsSession(db, sessionPourMouvement(db, sessionId))
  })
  gerer('caisse:enregistrerMouvement', (requete) => {
    const u = session.exiger(['gerant'])
    return ouvrirTiroirApresMouvement(saisirMouvementAuTiroir(base(), u, requete))
  })
  gerer('caisse:annulerMouvement', (annulation) => {
    const u = session.exiger(['gerant'])
    return ouvrirTiroirApresMouvement(annulerMouvementAuTiroir(base(), u, annulation))
  })
}
