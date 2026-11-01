/**
 * Démarrage automatique avec Windows (B-P5). Propriétaire : Dev B. ZONE PARTAGÉE.
 * Appliqué au lancement et à chaque changement du paramètre : Windows suit toujours la base.
 */
import { app } from 'electron'
import { reglageDemarrage } from '@shared/demarrage'
import type { Db } from './db/connexion'
import { lireParametres } from './modules/parametres/service'

export function appliquerDemarrageAutomatique(db: Db): void {
  try {
    const choix = reglageDemarrage({
      installee: app.isPackaged,
      baseEssai: !!process.env['POS_DB'],
      parametre: lireParametres(db).demarrageAutomatique
    })
    if (choix !== null) app.setLoginItemSettings({ openAtLogin: choix })
  } catch (e) {
    // Jamais bloquant : au pire, on lance l'application à la main.
    console.error('[DEMARRAGE]', e)
  }
}
