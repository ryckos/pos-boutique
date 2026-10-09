/**
 * Export Excel d'un écran (B15). ZONE PARTAGÉE — utilisable par tous les écrans, Dev A compris.
 *
 *   const ok = await exporterExcel({ nomFichier: 'Stock_2026-10-09', titre: 'Stock au 09/10/2026', feuilles })
 *
 * On exporte ce que l'écran affiche, filtres compris (REGLES_METIER § 11.2) : chaque écran transforme
 * son tableau en feuille ; le principal écrit le fichier après « Enregistrer sous ».
 * Renvoie false si la personne a annulé ; lève une Error affichable si l'écriture échoue.
 */
import type { DemandeExport } from '@shared/ipc/exports'
import { appel } from './api'

export async function exporterExcel(demande: DemandeExport): Promise<boolean> {
  const { enregistre } = await appel('exports:excel', demande)
  return enregistre
}

/** Message de succès commun à tous les écrans. */
export const MESSAGE_EXPORT = 'Fichier Excel enregistré.'

/** Suffixe de nom de fichier pour une période : « 2026-10-01_2026-10-09 », ou le seul jour. */
export function suffixePeriode(du: string, au: string): string {
  return du === au ? du : `${du}_${au}`
}

/** Date du jour du terminal, « AAAA-MM-JJ » : nom de fichier et titre d'un état « au … ». */
export function jourLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
