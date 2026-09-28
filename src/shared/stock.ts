/**
 * Règles pures du stock, partagées par le service et les écrans. Propriétaire : Dev B.
 * REGLES_METIER § 3.3.
 */
import type { TypeMouvement } from './types'

export interface ConditionnementRepartition {
  nom: string
  quantiteBase: number
}

export interface PartRepartition {
  nom: string
  nombre: number
}

/**
 * Répartition indicative d'un stock en conditionnements : on remplit d'abord le plus grand, puis le
 * suivant, le reste en unités. 46 avec Carton de 24 et Lot de 3 → 1 carton + 7 lots + 1 unité.
 * Rien (null) si le stock est ≤ 0 ou si la répartition ne dirait rien de plus que le stock lui-même
 * (produit sans conditionnement plus grand que l'Unité, ou stock plus petit que le moindre).
 */
export function repartirStock(
  stock: number,
  conditionnements: ConditionnementRepartition[],
  nomUnite = 'Unité'
): PartRepartition[] | null {
  if (!(stock > 0)) return null
  const grands = conditionnements
    .filter((c) => c.quantiteBase > 1)
    .sort((a, b) => b.quantiteBase - a.quantiteBase)
    // Deux conditionnements de même quantité : on garde le premier, l'autre n'apprendrait rien.
    .filter((c, i, liste) => i === 0 || liste[i - 1].quantiteBase !== c.quantiteBase)

  const parts: PartRepartition[] = []
  let reste = stock
  for (const c of grands) {
    const nombre = Math.floor(reste / c.quantiteBase)
    if (nombre > 0) {
      parts.push({ nom: c.nom, nombre })
      reste = arrondir(reste - nombre * c.quantiteBase)
    }
  }
  if (parts.length === 0) return null
  if (reste > 0) parts.push({ nom: nomUnite, nombre: reste })
  return parts
}

/** Évite les restes du type 0,30000000000000004 sur les produits au poids. */
const arrondir = (n: number): number => Math.round(n * 1000) / 1000

/** Libellé d'un type de mouvement pour le gérant (jamais le code technique à l'écran). */
export const LIBELLES_MOUVEMENT: Record<TypeMouvement, string> = {
  reception: 'Réception',
  vente: 'Vente',
  retour_client: 'Retour client',
  retour_fournisseur: 'Retour fournisseur',
  ajustement_inventaire: 'Ajustement',
  perte_peremption: 'Périmé retiré',
  casse: 'Casse',
  vol: 'Vol',
  contre_passation: 'Annulation'
}
