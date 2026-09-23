/** Propriétaire : Dev A. */
import { base } from '../db/connexion'
import { gerer } from '../ipc/gerer'
import { journaliser } from '../core/audit'
import { session } from '../core/session'
import { enregistrerRelaisEcranClient, ouvrirEcranClient } from '../fenetres'
import { buildDrawerPulse, buildTestTicket } from './escpos'
import { envoyerBrut, listerImprimantes } from './imprimante'

export function enregistrerIpcMateriel(): void {
  enregistrerRelaisEcranClient()

  gerer('materiel:imprimantes', () => listerImprimantes())

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

  gerer('materiel:ouvrirEcranClient', () => ouvrirEcranClient())
}
