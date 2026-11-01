/** Point d'entrée du processus principal. ZONE PARTAGÉE. */
import { app, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { base, initialiserBase } from './db/connexion'
import { migrationsEnAttente, migrer } from './db/migrations'
import { semerDonneesDemo } from './db/seed'
import { enregistrerTousLesIpc } from './ipc'
import { creerFenetrePrincipale, ouvrirEcranClientAuDemarrage, ramenerFenetrePrincipale } from './fenetres'
import { appliquerDemarrageAutomatique } from './demarrage'
import {
  configurerSauvegardes,
  sauvegardeDuDemarrage,
  sauvegarderEnFile
} from './modules/sauvegardes/automatique'
import { appliquerRestauration, journaliserRestauration } from './modules/sauvegardes/restauration'

// POS_SIMULER_PROD=1 : se comporter comme l'application installée (pas de données de démo,
// assistant de premier démarrage), pour tester en développement. À utiliser avec POS_DB.
const modeDev = !app.isPackaged && !process.env['POS_SIMULER_PROD']

// Une seule instance sur le terminal : un double-clic sur l'icône pendant que l'application
// tourne déjà (lancée avec Windows) ramène sa fenêtre, au lieu d'ouvrir une seconde caisse sur la
// même base. En développement, on laisse lancer à côté de l'application installée. Sur une base
// d'essai (POS_DB) aussi : sinon le script d'essai, lancé alors que la vraie caisse s'est ouverte
// avec Windows, ramènerait la vraie caisse et l'essai se jouerait sur la vraie base.
const instanceUnique = modeDev || !!process.env['POS_DB'] || app.requestSingleInstanceLock()
if (!instanceUnique) app.quit()
else app.on('second-instance', ramenerFenetrePrincipale)

app.whenReady().then(async () => {
  if (!instanceUnique) return
  // POS_DB permet de pointer une autre base en développement (ex : POS_DB=C:\temp\test.db).
  const cheminBase = process.env['POS_DB'] ?? join(app.getPath('userData'), 'boutique.db')
  configurerSauvegardes(cheminBase)

  try {
    // Restauration demandée avant le redémarrage : la base est remplacée avant d'être ouverte.
    const restauree = appliquerRestauration(cheminBase)
    const baseExistante = existsSync(cheminBase)
    const db = initialiserBase(cheminBase)
    // Mise à jour sur site : copie de la base avant d'en changer la structure (REGLES_METIER § 14).
    // Un échec n'empêche pas de démarrer : chaque migration reste tout ou rien.
    if (baseExistante && migrationsEnAttente(db).length) {
      await sauvegarderEnFile(db, 'mise_a_jour').catch(() => undefined)
    }
    const appliquees = migrer(db)
    if (appliquees.length) console.log('[BASE] Migrations appliquées :', appliquees.join(', '))
    if (restauree) journaliserRestauration(db, cheminBase, restauree)
    if (modeDev && semerDonneesDemo(db)) console.log('[BASE] Données de démonstration créées')
  } catch (e) {
    dialog.showErrorBox('Démarrage impossible', `La base de données n'a pas pu être préparée.\n\n${String(e)}`)
    app.quit()
    return
  }

  console.log('[BASE]', cheminBase)
  appliquerDemarrageAutomatique(base())
  sauvegardeDuDemarrage()
  enregistrerTousLesIpc({ cheminBase, modeDev })
  // Application installée : plein écran, sans barre de titre (mode kiosque, B-P5).
  creerFenetrePrincipale({ pleinEcran: !modeDev })
  ouvrirEcranClientAuDemarrage()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetrePrincipale({ pleinEcran: !modeDev })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
