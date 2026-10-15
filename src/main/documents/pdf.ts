/**
 * Propriétaire : Dev A.
 *
 * Sortie d'un document A4 (facture, proforma — tâche A10) : la page HTML est chargée dans une
 * fenêtre cachée, puis convertie en PDF (`printToPDF`) et enregistrée où l'utilisateur le choisit, ou
 * envoyée à la fenêtre d'impression de Windows (imprimante A4, s'il y en a une). Toujours HORS de toute
 * transaction. Rien ici n'est testé automatiquement : la mise en page l'est (documents/*.ts).
 */
import { writeFileSync } from 'node:fs'
import { BrowserWindow, dialog } from 'electron'
import { ErreurMetier } from '../core/erreurs'

export type SortieDocument = 'enregistrer' | 'imprimer'

/** Fenêtre cachée, sans JavaScript : le HTML est le nôtre, mais il contient des saisies (noms). */
async function fenetreDocument(html: string): Promise<BrowserWindow> {
  const fenetre = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true }
  })
  await fenetre.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return fenetre
}

async function enregistrer(html: string, nomFichier: string): Promise<boolean> {
  const fenetre = await fenetreDocument(html)
  try {
    const pdf = await fenetre.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    })
    const parent = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Enregistrer le PDF',
      defaultPath: nomFichier,
      filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
    }
    const choix = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
    if (choix.canceled || !choix.filePath) return false
    try {
      writeFileSync(choix.filePath, pdf)
    } catch {
      throw new ErreurMetier(
        'Le PDF n’a pas pu être enregistré : fermez-le s’il est ouvert ou choisissez un autre dossier.'
      )
    }
    return true
  } finally {
    fenetre.destroy()
  }
}

async function imprimer(html: string): Promise<boolean> {
  const fenetre = await fenetreDocument(html)
  try {
    return await new Promise<boolean>((resolve, reject) => {
      fenetre.webContents.print({ silent: false, printBackground: true }, (reussi, raison) => {
        if (reussi) resolve(true)
        // Annulé par l'utilisateur : rien à signaler.
        else if (/cancel/i.test(raison)) resolve(false)
        else
          reject(new ErreurMetier('Impression impossible : vérifiez l’imprimante A4, ou enregistrez le PDF.'))
      })
    })
  } finally {
    fenetre.destroy()
  }
}

/** Renvoie false si l'utilisateur a annulé (rien n'a été produit). */
export function sortirDocument(html: string, nomFichier: string, sortie: SortieDocument): Promise<boolean> {
  return sortie === 'imprimer' ? imprimer(html) : enregistrer(html, nomFichier)
}
