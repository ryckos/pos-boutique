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

// ─── Sorties de stock (B11, REGLES_METIER § 8) ───────────────────────────────

export type MotifSortie = 'casse' | 'perime' | 'vol' | 'don'

/**
 * Motif choisi par le gérant → type de mouvement et libellé. Le don passe par `casse` avec le
 * libellé « Don » : aucun type dédié n'existe dans le schéma (REGLES_METIER § 8).
 * `retourPossible` : seule une marchandise défectueuse ou périmée se renvoie au fournisseur.
 */
export const MOTIFS_SORTIE: Record<
  MotifSortie,
  { libelle: string; type: TypeMouvement; retourPossible: boolean }
> = {
  casse: { libelle: 'Défectueux ou casse', type: 'casse', retourPossible: true },
  perime: { libelle: 'Périmé', type: 'perte_peremption', retourPossible: true },
  vol: { libelle: 'Vol constaté', type: 'vol', retourPossible: false },
  don: { libelle: 'Don', type: 'casse', retourPossible: false }
}

/** Ce qu'on sait du prix payé pour calculer un avoir attendu. */
export interface SourcesCoutRetour {
  /** Lot choisi pour la sortie : son prix d'achat et le fournisseur qui l'a livré. */
  lot?: { fournisseurId: number | null; prixAchat: number } | null
  /** Dernier coût par unité de base payé à chaque fournisseur pour ce produit. */
  prixFournisseurs: Array<{ fournisseurId: number; coutUnitaire: number }>
  cump: number
}

/**
 * Coût par unité de base d'un retour à ce fournisseur (validé par Dev B le 2026-10-06) : le prix
 * d'achat du lot s'il vient de lui, sinon le dernier prix qu'on lui a payé pour ce produit, sinon
 * le CUMP.
 */
export function coutRetour(fournisseurId: number, sources: SourcesCoutRetour): number {
  if (sources.lot && sources.lot.fournisseurId === fournisseurId && sources.lot.prixAchat > 0) {
    return sources.lot.prixAchat
  }
  const prix = sources.prixFournisseurs.find((p) => p.fournisseurId === fournisseurId)
  return prix ? prix.coutUnitaire : sources.cump
}

/** Avoir attendu = quantité × coût, arrondi au franc. 2 boîtes × 250 → 500. */
export function avoirAttendu(quantite: number, coutUnitaire: number): number {
  return Math.round(quantite * coutUnitaire)
}
