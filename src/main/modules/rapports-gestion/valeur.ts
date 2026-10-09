/**
 * Valeur du stock par rayon (B14). Propriétaire : Dev B.
 * Aujourd'hui seulement, au CUMP actuel (validé par Dev B le 2026-10-09) : une valeur passée
 * demanderait de reconstruire le CUMP de l'époque. Même source que l'écran Stock (`v_stock_produits`),
 * donc même total ; un produit en stock négatif compte négativement, comme là-bas.
 */
import type { RapportValeurStock, ValeurRayon } from '@shared/ipc/rapports-gestion'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'

// Même libellé que l'écran Stock.
export const SANS_RAYON = 'Non classé'

export function rapportValeurStock(db: Db): RapportValeurStock {
  // Un sous-rayon compte dans son rayon, comme sur l'écran Stock.
  const rayons = toutes<{ rayon: string | null; nbProduits: number; valeur: number }>(
    db,
    `SELECT COALESCE(parent.nom, c.nom) AS rayon, COUNT(*) AS nbProduits, SUM(s.valeur_stock) AS valeur
     FROM v_stock_produits s
     JOIN produits p ON p.id = s.id
     LEFT JOIN categories c ON c.id = p.categorie_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     GROUP BY COALESCE(parent.id, c.id)`
  )
  const lignes: ValeurRayon[] = rayons
    .map((r) => ({ rayon: r.rayon ?? SANS_RAYON, nbProduits: r.nbProduits, valeur: r.valeur }))
    .sort((a, b) => b.valeur - a.valeur || a.rayon.localeCompare(b.rayon, 'fr'))
  return { total: lignes.reduce((s, r) => s + r.valeur, 0), rayons: lignes }
}
