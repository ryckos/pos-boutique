/**
 * FEFO — premier périmé, premier sorti (tâche B9). Propriétaire : Dev B, consommé par la vente de
 * Dev A (A9), qui fait un mouvement de stock par part renvoyée.
 * Règles (REGLES_METIER § 5.1) : seuls les lots en stock et non périmés sont servis, date la plus
 * proche d'abord ; la répartition couvre toujours toute la quantité, le reste sortant sans lot, car
 * une vente n'est jamais bloquée pour cause de stock (D-A1).
 */
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'

export interface PartFefo {
  /** Lot d'arrivage servi ; null pour la part qu'aucun lot ne couvre. */
  lotId: number | null
  /** En unités de base, toujours > 0. */
  quantite: number
}

/** En deçà, un reste de quantité au poids n'est qu'une erreur d'arrondi des nombres à virgule. */
const EPSILON = 1e-9

/**
 * Répartit `qteBase` unités de base du produit sur ses lots. Lecture seule : s'appelle dans la
 * transaction de la vente, avant d'écrire les mouvements. La somme des parts vaut `qteBase`.
 */
export function allouerFefo(db: Db, produitId: number, qteBase: number): PartFefo[] {
  if (!(qteBase > 0)) return []

  // Requête ciblée sur un produit (et non la vue v_stock_lots entière) : elle tourne à chaque vente.
  const lots = toutes<{ lotId: number; restant: number }>(
    db,
    `SELECT l.id AS lotId, SUM(m.quantite) AS restant
     FROM lots l
     JOIN mouvements_stock m ON m.lot_id = l.id
     WHERE l.produit_id = ?
       AND l.date_peremption IS NOT NULL
       AND l.date_peremption >= date('now','localtime')
     GROUP BY l.id
     HAVING SUM(m.quantite) > 0
     ORDER BY l.date_peremption, l.id`,
    produitId
  )

  const parts: PartFefo[] = []
  let reste = qteBase
  for (const lot of lots) {
    if (reste <= EPSILON) break
    const prise = Math.min(lot.restant, reste)
    parts.push({ lotId: lot.lotId, quantite: prise })
    reste -= prise
  }
  if (reste > EPSILON) parts.push({ lotId: null, quantite: reste })
  return parts
}
