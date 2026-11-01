/**
 * Fenêtres de l'application : caisse (écran principal 15,6″) et écran client (11,6″).
 * Propriétaire : Dev A (placement validé en Phase 0, test T4). Création mode kiosque : Dev B (Phase 5).
 */
import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import type { PanierClient } from '@shared/types'
import { choisirEcranClient } from '@shared/ecran-client'
import { base } from './db/connexion'
import { lireParametres } from './modules/parametres/service'

let principale: BrowserWindow | null = null
let client: BrowserWindow | null = null
/** Dernier état envoyé par la caisse : rejoué si l'écran client s'ouvre ou se recharge en cours de ticket. */
let dernierEtat: PanierClient | null = null

const urlDev = process.env['ELECTRON_RENDERER_URL']
const preload = join(__dirname, '../preload/index.js')

function charger(fenetre: BrowserWindow, page: 'index' | 'client'): void {
  if (urlDev) fenetre.loadURL(page === 'index' ? urlDev : `${urlDev}/client.html`)
  else fenetre.loadFile(join(__dirname, `../renderer/${page}.html`))
}

/**
 * `pleinEcran` (application installée, B-P5) : la caisse occupe tout l'écran, sans barre de titre ni
 * croix, pour que la caissière ne la ferme ni ne la réduise par erreur. On en sort par « Quitter
 * l'application » (gérant, admin) ; Alt+F4 reste possible pour le technicien.
 */
export function creerFenetrePrincipale(options: { pleinEcran: boolean }): BrowserWindow {
  principale = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    fullscreen: options.pleinEcran,
    title: 'Ma Boutique',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, sandbox: false }
  })
  principale.once('ready-to-show', () => {
    if (!options.pleinEcran) principale?.maximize()
    principale?.show()
  })
  principale.on('closed', () => {
    principale = null
    fermerEcranClient()
  })
  charger(principale, 'index')
  return principale
}

export function fenetrePrincipale(): BrowserWindow | null {
  return principale
}

/** Second lancement (double-clic sur l'icône) : on remet la caisse déjà ouverte au premier plan. */
export function ramenerFenetrePrincipale(): void {
  if (!principale || principale.isDestroyed()) return
  if (principale.isMinimized()) principale.restore()
  principale.show()
  principale.focus()
}

function second(): Electron.Display | null {
  return choisirEcranClient(screen.getAllDisplays(), screen.getPrimaryDisplay().id)
}

/** Nom de la boutique pour l'écran client, qui n'a pas de session pour le demander lui-même. */
function nomBoutique(): string {
  try {
    return lireParametres(base()).boutiqueNom ?? 'Ma Boutique'
  } catch {
    return 'Ma Boutique'
  }
}

function envoyerEtat(): void {
  if (!client || client.isDestroyed()) return
  client.webContents.send('ecran-client:panier', {
    lignes: [],
    total: 0,
    ...dernierEtat,
    boutique: nomBoutique()
  })
}

/** Ouvre l'écran client en plein écran sur le second écran s'il existe. */
export function ouvrirEcranClient(): { secondEcran: boolean } {
  const autre = second()
  if (client && !client.isDestroyed()) return { secondEcran: !!autre }

  client = new BrowserWindow({
    x: autre?.bounds.x,
    y: autre?.bounds.y,
    width: autre?.bounds.width ?? 800,
    height: autre?.bounds.height ?? 500,
    fullscreen: !!autre,
    frame: !autre,
    title: 'Écran client',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, sandbox: false }
  })
  client.on('closed', () => (client = null))
  // Rejoue le dernier état (et donne le nom de la boutique) dès que la page peut l'écouter.
  client.webContents.on('did-finish-load', envoyerEtat)
  charger(client, 'client')
  return { secondEcran: !!autre }
}

/** Démarrage : ouvre l'écran client seulement s'il y a un second écran (pas de fenêtre en trop sur un portable). */
export function ouvrirEcranClientAuDemarrage(): void {
  if (second()) ouvrirEcranClient()
}

/** Relais : la caisse envoie son panier, l'écran client le reçoit. */
export function enregistrerRelaisEcranClient(): void {
  ipcMain.on('ecran-client:maj', (_e, donnees) => {
    dernierEtat = donnees as PanierClient
    envoyerEtat()
  })
}

/** Ferme l'écran client avec la caisse (sinon l'application resterait ouverte sur le 11,6″). */
export function fermerEcranClient(): void {
  if (client && !client.isDestroyed()) client.destroy()
}
