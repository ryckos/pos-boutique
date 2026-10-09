/** Propriétaire : Dev B. */
import { writeFileSync } from 'node:fs'
import { BrowserWindow, dialog } from 'electron'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { ErreurMetier } from '../../core/erreurs'
import { classeurExcel, horodatageExport, nomFichierExport } from './service'

// Toute personne connectée : chaque écran n'affiche son bouton qu'à ceux qui le voient, et l'export
// ne contient que ce que l'écran a déjà reçu de son propre canal (protégé par son rôle).
export function enregistrerIpcExports(): void {
  gerer('exports:excel', async (demande) => {
    const u = session.exiger()
    // Classeur construit avant la fenêtre : une demande invalide est refusée sans rien demander.
    const contenu = classeurExcel(demande, u.nom, horodatageExport())
    const fenetre = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Enregistrer le fichier Excel',
      defaultPath: nomFichierExport(demande.nomFichier),
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    }
    const choix = fenetre
      ? await dialog.showSaveDialog(fenetre, options)
      : await dialog.showSaveDialog(options)
    if (choix.canceled || !choix.filePath) return { enregistre: false }
    try {
      writeFileSync(choix.filePath, contenu)
    } catch {
      throw new ErreurMetier(
        'Le fichier n’a pas pu être enregistré : fermez-le dans Excel ou choisissez un autre dossier'
      )
    }
    return { enregistre: true }
  })
}
