/**
 * Propriétaire : Dev A.
 * Canaux caisse:* — minces : droits, puis appel du service. Organisation du module :
 *   service-session.ts · service-vente.ts · service-ticket.ts · service-cloture.ts ·
 *   service-mouvements.ts · service-annulation.ts · service-retour.ts · service-facture.ts ·
 *   service-proforma.ts ·
 *   calculs.ts (TVA, totaux — testés) · ipc.ts. Documents A4 (facture, proforma) : ../../documents/.
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
import { sauvegarderEnFond } from '../sauvegardes/automatique'
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
import { annulerTicket, consulterTicket } from './service-annulation'
import {
  annulerMouvementAuTiroir,
  mouvementsSession,
  saisirMouvementAuTiroir,
  sessionPourMouvement
} from './service-mouvements'
import { consulterRetour, enregistrerRetour } from './service-retour'
import {
  dejaEditee,
  facturer,
  lireFacture,
  noterEdition,
  trouverFacture,
  verifierEdition
} from './service-facture'
import { creerProforma, donneesProforma, lireProforma } from './service-proforma'
import { htmlFacture } from '../../documents/facture'
import { htmlProforma } from '../../documents/proforma'
import { sortirDocument } from '../../documents/pdf'
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
 * Ouvre le tiroir après un mouvement de caisse ou une annulation, HORS transaction. L'opération est
 * déjà enregistrée : une imprimante en panne ne l'annule pas, l'écran dit seulement d'ouvrir le tiroir
 * à la clé. Pas de journal `ouverture_tiroir_hors_vente` : l'opération elle-même est journalisée.
 */
async function ouvrirTiroir(): Promise<boolean> {
  try {
    const reglages = reglagesDepuis(lireParametres(base()))
    await envoyerBrut(reglages.methode, reglages.cible, buildDrawerPulse())
    return true
  } catch {
    return false
  }
}

async function ouvrirTiroirApresMouvement(mouvement: MouvementCaisse): Promise<MouvementEnregistre> {
  return { mouvement, tiroirOuvert: await ouvrirTiroir() }
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
    const rapport = cloturerSession(base(), u, requete)
    // Sauvegarde de la base après chaque clôture (Dev B, B16) : APRÈS la transaction, sans
    // l'attendre ; elle ne lève jamais d'erreur, une clôture n'est jamais bloquée.
    sauvegarderEnFond('cloture')
    return rapport
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
  gerer('caisse:consulterTicket', ({ numeroTicket }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return consulterTicket(base(), u, numeroTicket)
  })
  gerer('caisse:annulerTicket', async (demande) => {
    const u = session.exiger(['caissier', 'gerant'])
    const resultat = annulerTicket(base(), u, demande)
    // Espèces à rendre : le tiroir s'ouvre APRÈS la transaction ; jamais pour du mobile money seul.
    return resultat.especesARendre > 0 ? { ...resultat, tiroirOuvert: await ouvrirTiroir() } : resultat
  })
  gerer('caisse:annulerMouvement', (annulation) => {
    const u = session.exiger(['gerant'])
    return ouvrirTiroirApresMouvement(annulerMouvementAuTiroir(base(), u, annulation))
  })
  gerer('caisse:consulterRetour', ({ numeroTicket }) => {
    const u = session.exiger(['caissier', 'gerant'])
    return consulterRetour(base(), u, numeroTicket)
  })
  gerer('caisse:enregistrerRetour', async (demande) => {
    const u = session.exiger(['caissier', 'gerant'])
    const retour = enregistrerRetour(base(), u, demande)
    // Espèces à rendre : le tiroir s'ouvre APRÈS la transaction ; jamais pour du mobile money.
    return retour.mode === 'especes' && retour.montant > 0
      ? { ...retour, tiroirOuvert: await ouvrirTiroir() }
      : retour
  })
  gerer('caisse:facturer', (demande) => {
    const u = session.exiger(['caissier', 'gerant'])
    return facturer(base(), u, demande)
  })
  gerer('caisse:trouverFacture', ({ numero }) => {
    session.exiger(['caissier', 'gerant'])
    return trouverFacture(base(), numero)
  })
  gerer('caisse:editerFacture', async ({ factureId, sortie }) => {
    const u = session.exiger(['caissier', 'gerant'])
    const db = base()
    verifierEdition(factureId, sortie)
    const facture = lireFacture(db, factureId, lireParametres(db))
    const copie = dejaEditee(db, factureId, sortie)
    // PDF ou impression APRÈS la création de la facture, hors de toute transaction.
    const fait = await sortirDocument(
      htmlFacture(facture, { copie }),
      `Facture ${facture.numero}.pdf`,
      sortie
    )
    if (fait) noterEdition(db, u.id, factureId, sortie, copie)
    return { fait, copie }
  })
  gerer('caisse:creerProforma', (demande) => {
    const u = session.exiger(['caissier', 'gerant'])
    return creerProforma(base(), u, demande)
  })
  gerer('caisse:lireProforma', ({ numero }) => {
    session.exiger(['caissier', 'gerant'])
    return lireProforma(base(), numero)
  })
  gerer('caisse:editerProforma', async ({ proformaId, sortie }) => {
    session.exiger(['caissier', 'gerant'])
    const db = base()
    verifierEdition(proformaId, sortie, 'Proforma')
    const p = donneesProforma(db, proformaId, lireParametres(db))
    // PDF ou impression hors de toute transaction ; un devis n'a ni original ni copie.
    return { fait: await sortirDocument(htmlProforma(p), `Proforma ${p.numero}.pdf`, sortie) }
  })
}
