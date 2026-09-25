/** Propriétaire : Dev A. */
import { base } from '../db/connexion'
import { gerer } from '../ipc/gerer'
import { journaliser } from '../core/audit'
import { session } from '../core/session'
import { enregistrerRelaisEcranClient, ouvrirEcranClient } from '../fenetres'
import { buildDrawerPulse, buildTestTicket } from './escpos'
import { envoyerBrut, listerImprimantes } from './imprimante'
import { ecrireReglages, lireReglages } from './reglages'

export function enregistrerIpcMateriel(): void {
  enregistrerRelaisEcranClient()

  // Réglages de l'imprimante = clés imprimante_* des paramètres (Dev B, B5).
  gerer('materiel:lireReglages', () => {
    session.exiger()
    return lireReglages(base())
  })

  // Le service des paramètres revérifie le rôle et journalise chaque clé modifiée.
  gerer('materiel:enregistrerReglages', (reglages) => {
    const u = session.exiger(['gerant'])
    return ecrireReglages(base(), u, reglages)
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
