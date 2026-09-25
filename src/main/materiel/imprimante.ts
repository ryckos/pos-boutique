/**
 * Envoi brut (ESC/POS) vers l'imprimante. Propriétaire : Dev A.
 * Deux méthodes validées en Phase 0 : spouleur Windows (A) et partage réseau (B).
 */
import { app } from 'electron'
import { execFile, exec } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { MethodeImpression } from '@shared/ipc/materiel'
import { ErreurMetier } from '../core/erreurs'
import { fenetrePrincipale } from '../fenetres'

function cheminScript(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'raw-print.ps1')
    : join(app.getAppPath(), 'resources', 'raw-print.ps1')
}

/** Voie native Electron d'abord (instantanée), repli PowerShell avec délai large (correctif Phase 0). */
export async function listerImprimantes(): Promise<string[]> {
  try {
    const f = fenetrePrincipale()
    if (f && !f.isDestroyed()) {
      const noms = (await f.webContents.getPrintersAsync()).map((p) => p.name).filter(Boolean)
      if (noms.length > 0) return noms
    }
  } catch {
    // repli ci-dessous
  }
  if (process.platform !== 'win32') return []
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
      { windowsHide: true, timeout: 30000 },
      (err, stdout) =>
        resolve(
          err
            ? []
            : stdout
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
        )
    )
  })
}

export function envoyerBrut(methode: MethodeImpression, cible: string, donnees: Buffer): Promise<void> {
  if (process.platform !== 'win32') {
    return Promise.reject(new ErreurMetier('Impression disponible uniquement sous Windows'))
  }
  if (!cible.trim()) return Promise.reject(new ErreurMetier('Aucune imprimante sélectionnée'))

  const fichier = join(app.getPath('temp'), `escpos-${Date.now()}.bin`)
  writeFileSync(fichier, donnees)
  const nettoyer = (): void => {
    try {
      unlinkSync(fichier)
    } catch {
      /* fichier temporaire déjà supprimé */
    }
  }

  return new Promise((resolve, reject) => {
    const fin = (err: Error | null, stderr?: string): void => {
      nettoyer()
      if (err) reject(new ErreurMetier(`Impression impossible : ${stderr?.trim() || err.message}`))
      else resolve()
    }
    if (methode === 'spooler') {
      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          cheminScript(),
          '-PrinterName',
          cible,
          '-FilePath',
          fichier
        ],
        { windowsHide: true, timeout: 15000 },
        (err, _out, stderr) => fin(err, stderr)
      )
    } else {
      exec(
        `copy /b "${fichier}" "\\\\localhost\\${cible}"`,
        { windowsHide: true, timeout: 15000, shell: 'cmd.exe' },
        (err, _out, stderr) => fin(err, stderr)
      )
    }
  })
}
