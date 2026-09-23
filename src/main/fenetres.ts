/**
 * Fenêtres de l'application : caisse (écran principal 15,6″) et écran client (11,6″).
 * Propriétaire : Dev A (placement validé en Phase 0, test T4). Création mode kiosque : Dev B (Phase 5).
 */
import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'

let principale: BrowserWindow | null = null
let client: BrowserWindow | null = null

const urlDev = process.env['ELECTRON_RENDERER_URL']
const preload = join(__dirname, '../preload/index.js')

function charger(fenetre: BrowserWindow, page: 'index' | 'client'): void {
  if (urlDev) fenetre.loadURL(page === 'index' ? urlDev : `${urlDev}/client.html`)
  else fenetre.loadFile(join(__dirname, `../renderer/${page}.html`))
}

export function creerFenetrePrincipale(): BrowserWindow {
  principale = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'Ma Boutique',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, sandbox: false }
  })
  principale.once('ready-to-show', () => {
    principale?.maximize()
    principale?.show()
  })
  principale.on('closed', () => (principale = null))
  charger(principale, 'index')
  return principale
}

export function fenetrePrincipale(): BrowserWindow | null {
  return principale
}

/** Ouvre l'écran client en plein écran sur le second écran s'il existe. */
export function ouvrirEcranClient(): { secondEcran: boolean } {
  const second = screen.getAllDisplays().find((d) => d.id !== screen.getPrimaryDisplay().id)
  if (client && !client.isDestroyed()) return { secondEcran: !!second }

  client = new BrowserWindow({
    x: second?.bounds.x,
    y: second?.bounds.y,
    width: second?.bounds.width ?? 800,
    height: second?.bounds.height ?? 500,
    fullscreen: !!second,
    frame: !second,
    title: 'Écran client',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, sandbox: false }
  })
  client.on('closed', () => (client = null))
  charger(client, 'client')
  return { secondEcran: !!second }
}

/** Relais : la caisse envoie son panier, l'écran client le reçoit. */
export function enregistrerRelaisEcranClient(): void {
  ipcMain.on('ecran-client:maj', (_e, donnees) => {
    if (client && !client.isDestroyed()) client.webContents.send('ecran-client:panier', donnees)
  })
}
