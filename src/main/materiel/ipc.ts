/** Propriétaire : Dev A. */
import { app } from 'electron'
import { join } from 'path'
import { base } from '../db/connexion'
import { gerer } from '../ipc/gerer'
import { journaliser } from '../core/audit'
import { session } from '../core/session'
import { enregistrerRelaisEcranClient, ouvrirEcranClient } from '../fenetres'
import { buildDrawerPulse, buildTestTicket } from './escpos'
import { envoyerBrut, listerImprimantes } from './imprimante'
import { ecrireReglages, lireReglages } from './reglages'

/** Fichier des réglages de l'imprimante, à côté de la base (en attendant les paramètres de B5). */
export function cheminReglages(): string {
  return join(app.getPath('userData'), 'materiel.json')
}

export function enregistrerIpcMateriel(): void {
  enregistrerRelaisEcranClient()

  gerer('materiel:lireReglages', () => {
    session.exiger()
    return lireReglages(cheminReglages())
  })

  gerer('materiel:enregistrerReglages', (reglages) => {
    const u = session.exiger(['gerant'])
    const avant = lireReglages(cheminReglages())
    const apres = ecrireReglages(cheminReglages(), reglages)
    // Changer d'imprimante ou de page de codes touche tous les tickets : on garde la trace.
    journaliser(base(), { utilisateurId: u.id, action: 'reglages_imprimante', avant, apres })
    return apres
  })

  // La liste des imprimantes ne sert qu'aux réglages matériel, réservés au gérant (comme le ticket test).
  gerer('materiel:imprimantes', () => {
    session.exiger(['gerant'])
    return listerImprimantes()
  })

  gerer('materiel:ticketTest', async ({ methode, cible, pageDeCodes }) => {
    session.exiger(['gerant'])
    await envoyerBrut(methode, cible, buildTestTicket(pageDeCodes))
  })

  gerer('materiel:ouvrirTiroir', async ({ methode, cible }) => {
    const u = session.exiger()
    await envoyerBrut(methode, cible, buildDrawerPulse())
    // Ouverture hors vente = action sensible, toujours journalisée.
    journaliser(base(), { utilisateurId: u.id, action: 'ouverture_tiroir_hors_vente' })
  })

  // Ouvert depuis la caisse : toute personne connectée, caissière comprise.
  gerer('materiel:ouvrirEcranClient', () => {
    session.exiger()
    return ouvrirEcranClient()
  })
}
