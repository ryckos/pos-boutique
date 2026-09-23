/** Point d'entrée du processus principal. ZONE PARTAGÉE. */
import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { initialiserBase } from './db/connexion'
import { migrer } from './db/migrations'
import { semerDonneesDemo } from './db/seed'
import { enregistrerTousLesIpc } from './ipc'
import { creerFenetrePrincipale } from './fenetres'

// POS_SIMULER_PROD=1 : se comporter comme l'application installée (pas de données de démo,
// assistant de premier démarrage), pour tester en développement. À utiliser avec POS_DB.
const modeDev = !app.isPackaged && !process.env['POS_SIMULER_PROD']

app.whenReady().then(() => {
  // POS_DB permet de pointer une autre base en développement (ex : POS_DB=C:\temp\test.db).
  const cheminBase = process.env['POS_DB'] ?? join(app.getPath('userData'), 'boutique.db')

  try {
    const db = initialiserBase(cheminBase)
    const appliquees = migrer(db)
    if (appliquees.length) console.log('[BASE] Migrations appliquées :', appliquees.join(', '))
    if (modeDev && semerDonneesDemo(db)) console.log('[BASE] Données de démonstration créées')
  } catch (e) {
    dialog.showErrorBox('Démarrage impossible', `La base de données n'a pas pu être préparée.\n\n${String(e)}`)
    app.quit()
    return
  }

  console.log('[BASE]', cheminBase)
  enregistrerTousLesIpc({ cheminBase, modeDev })
  creerFenetrePrincipale()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetrePrincipale()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
