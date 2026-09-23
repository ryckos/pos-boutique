/**
 * Enregistrement typé d'un canal IPC. ZONE PARTAGÉE.
 *
 * - Le typage vérifie que le canal existe dans le contrat et que requête/réponse correspondent.
 * - Toute exception est convertie en { ok:false, erreur } : l'interface ne plante jamais.
 * - ErreurMetier → message affiché tel quel ; autre erreur → message générique + journal console.
 */
import { ipcMain } from 'electron'
import type { Canal, Reponse, Requete, Resultat } from '@shared/ipc'
import { ErreurMetier } from '../core/erreurs'

export function gerer<C extends Canal>(
  canal: C,
  fn: (requete: Requete<C>) => Reponse<C> | Promise<Reponse<C>>
): void {
  ipcMain.handle(canal, async (_evenement, requete: Requete<C>): Promise<Resultat<Reponse<C>>> => {
    try {
      return { ok: true, donnees: await fn(requete) }
    } catch (e) {
      if (e instanceof ErreurMetier) return { ok: false, erreur: e.message }
      console.error(`[IPC ${canal}]`, e)
      return { ok: false, erreur: 'Erreur interne — consultez le journal de l’application' }
    }
  })
}
