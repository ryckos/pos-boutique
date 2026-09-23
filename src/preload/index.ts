/**
 * Pont sécurisé entre l'interface et le processus principal. ZONE PARTAGÉE.
 * Volontairement générique : ajouter un canal ne nécessite JAMAIS de modifier ce fichier.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const api = {
  invoke: (canal: string, requete?: unknown): Promise<unknown> => ipcRenderer.invoke(canal, requete),

  /** Caisse → écran client (Dev A). */
  envoyerPanierClient: (donnees: unknown): void => ipcRenderer.send('ecran-client:maj', donnees),

  /** Écran client : abonnement aux mises à jour du panier. Renvoie la fonction de désabonnement. */
  surPanierClient: (rappel: (donnees: unknown) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, d: unknown): void => rappel(d)
    ipcRenderer.on('ecran-client:panier', h)
    return () => ipcRenderer.removeListener('ecran-client:panier', h)
  }
}

export type ApiPreload = typeof api

contextBridge.exposeInMainWorld('pos', api)
