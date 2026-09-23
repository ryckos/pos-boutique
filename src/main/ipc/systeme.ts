/** ZONE PARTAGÉE. */
import { app } from 'electron'
import { gerer } from './gerer'

export function enregistrerIpcSysteme(options: { cheminBase: string; modeDev: boolean }): void {
  gerer('systeme:infos', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    cheminBase: options.cheminBase,
    modeDev: options.modeDev
  }))
}
