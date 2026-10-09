/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { rapportAchats } from './achats'
import { rapportPertes } from './pertes'
import { rapportResultat } from './resultat'
import { rapportValeurStock } from './valeur'

// Matrice des droits : « Consulter les rapports financiers » = gérant et admin.
export function enregistrerIpcRapportsGestion(): void {
  gerer('rapports:pertes', (periode) => {
    session.exiger(['gerant'])
    return rapportPertes(base(), periode)
  })
  gerer('rapports:valeurStock', () => {
    session.exiger(['gerant'])
    return rapportValeurStock(base())
  })
  gerer('rapports:achats', (periode) => {
    session.exiger(['gerant'])
    return rapportAchats(base(), periode)
  })
  gerer('rapports:resultat', (periode) => {
    session.exiger(['gerant'])
    return rapportResultat(base(), periode)
  })
}
