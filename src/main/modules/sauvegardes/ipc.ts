/** Propriétaire : Dev B. */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import type { UtilisateurConnecte } from '@shared/types'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { ErreurMetier } from '../../core/erreurs'
import { ecrireParametres, lireParametres } from '../parametres/service'
import { cheminBaseCourant, dernierEchecSauvegarde, dossierCourant, sauvegarderEnFile } from './automatique'
import { abandonnerRestauration, confirmerRestauration, preparerRestauration } from './restauration'
import { lireNom, listeSauvegardes, sauvegardeEnRetard } from './service'

let restaurationEnCours = false

function choisir(options: OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const fenetre = BrowserWindow.getFocusedWindow()
  return fenetre ? dialog.showOpenDialog(fenetre, options) : dialog.showOpenDialog(options)
}

/**
 * REGLES_METIER § 14 : la copie choisie est mise de côté, la base en place est sauvegardée (sinon on
 * ne restaure pas), puis l'application redémarre et remplace la base avant de l'ouvrir.
 */
async function restaurerDepuis(source: string, u: UtilisateurConnecte): Promise<{ redemarrage: boolean }> {
  if (restaurationEnCours)
    throw new ErreurMetier('Une restauration est déjà en cours : l’application va redémarrer')
  restaurationEnCours = true
  const cheminBase = cheminBaseCourant()
  try {
    const prete = preparerRestauration(cheminBase, source)
    let avant: string
    try {
      avant = (await sauvegarderEnFile(base(), 'avant_restauration')).sauvegarde.nom
    } catch {
      abandonnerRestauration(cheminBase)
      throw new ErreurMetier(
        'La base actuelle n’a pas pu être sauvegardée : restauration abandonnée, rien n’a changé'
      )
    }
    confirmerRestauration(cheminBase, { ...prete, sauvegardeAvant: avant, utilisateurId: u.id })
  } catch (e) {
    restaurationEnCours = false
    throw e
  }
  // Laisser la réponse arriver à l'écran (« L'application redémarre… ») avant de quitter.
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 1500)
  return { redemarrage: true }
}

// Consulter et « Sauvegarder maintenant » = gérant ; dossier de la clé et restauration = admin.
export function enregistrerIpcSauvegardes(): void {
  gerer('sauvegardes:etat', () => {
    session.exiger(['gerant'])
    const derniere = listeSauvegardes(dossierCourant())[0] ?? null
    const dossierExterne = lireParametres(base()).sauvegardeDossierExterne
    return {
      derniere,
      enRetard: sauvegardeEnRetard(derniere, new Date()),
      dossierExterne,
      dossierExternePresent: dossierExterne !== null && existsSync(dossierExterne),
      dernierEchec: dernierEchecSauvegarde()
    }
  })
  gerer('sauvegardes:liste', () => {
    session.exiger(['gerant'])
    return listeSauvegardes(dossierCourant())
  })
  gerer('sauvegardes:creer', () => {
    session.exiger(['gerant'])
    return sauvegarderEnFile(base(), 'manuelle')
  })
  gerer('sauvegardes:choisirDossierExterne', async () => {
    const u = session.exiger(['admin'])
    const choix = await choisir({
      title: 'Choisir le dossier de la clé USB',
      properties: ['openDirectory', 'createDirectory']
    })
    if (choix.canceled || !choix.filePaths[0]) return null
    return ecrireParametres(base(), u, { sauvegardeDossierExterne: choix.filePaths[0] })
      .sauvegardeDossierExterne
  })
  gerer('sauvegardes:restaurer', ({ nom }) => {
    const u = session.exiger(['admin'])
    // Seul un nom de la liste est accepté : jamais un chemin envoyé par l'interface.
    const chemin = join(dossierCourant(), nom)
    if (!lireNom(nom) || !existsSync(chemin)) throw new ErreurMetier('Cette sauvegarde n’existe plus')
    return restaurerDepuis(chemin, u)
  })
  gerer('sauvegardes:restaurerFichier', async () => {
    const u = session.exiger(['admin'])
    const choix = await choisir({
      title: 'Choisir la sauvegarde à restaurer',
      properties: ['openFile'],
      filters: [{ name: 'Sauvegarde de la boutique', extensions: ['db'] }]
    })
    if (choix.canceled || !choix.filePaths[0]) return { redemarrage: false }
    return restaurerDepuis(choix.filePaths[0], u)
  })
}
