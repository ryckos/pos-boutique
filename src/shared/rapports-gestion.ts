/** Règles pures des rapports de gestion (B14, REGLES_METIER § 11). Propriétaire : Dev B. */
import type { CausePerte } from './ipc/rapports-gestion'

/** Dans l'ordre d'affichage du rapport des pertes. */
export const CAUSES_PERTE: Record<CausePerte, string> = {
  peremption: 'Péremption',
  casse: 'Casse',
  don: 'Dons',
  vol: 'Vol',
  demarque_inventaire: 'Démarque d’inventaire',
  avoir_fournisseur: 'Avoirs fournisseur non obtenus'
}

/**
 * Perte d'un retour fournisseur dont l'avoir est clos : tout l'attendu s'il est refusé, sinon ce qui
 * manque à l'avoir reçu. Un avoir reçu au-dessus de l'attendu n'est pas un gain compté ici.
 */
export function manqueAvoir(statut: 'recu' | 'refuse', attendu: number, recu: number | null): number {
  if (statut === 'refuse') return attendu
  return Math.max(0, attendu - (recu ?? 0))
}

/** Premier jour du mois d'une date AAAA-MM-JJ. */
export function debutDuMois(jour: string): string {
  return `${jour.slice(0, 8)}01`
}
