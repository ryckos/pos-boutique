/**
 * Règles pures des réceptions, partagées par le service et l'écran (conversion en direct).
 * Propriétaire : Dev B. REGLES_METIER § 4.1 à 4.3.
 */

/** Unités de base qui acceptent une quantité à virgule (2,5 kg). */
export const UNITES_FRACTIONNAIRES = ['kg', 'g', 'litre', 'ml']

export interface ConversionLigne {
  /** Unités de base entrées en stock : 3 cartons de 24 → 72. */
  quantiteBase: number
  /** Coût par unité de base : 6 000 / 24 → 250. Non arrondi : il nourrit le CUMP. */
  coutBase: number
  /** Montant de la ligne en FCFA, arrondi au franc (utile seulement au poids). */
  total: number
}

/** Ce que l'utilisateur saisit (3 cartons à 6 000) traduit en unités de base. */
export function convertirLigne(
  quantite: number,
  prix: number,
  quantiteBaseConditionnement: number
): ConversionLigne {
  return {
    // Arrondi des quantités fractionnaires (kg) : jamais de 2,9999999.
    quantiteBase: Math.round(quantite * quantiteBaseConditionnement * 1000) / 1000,
    coutBase: prix / quantiteBaseConditionnement,
    total: Math.round(quantite * prix)
  }
}

/**
 * CUMP après une entrée : (stock × ancien + qte × coût) / (stock + qte).
 * Stock nul ou négatif avant l'entrée : l'ancien coût ne pèse plus rien, le CUMP devient le coût reçu.
 * 46 à 250 + 48 à 275 → 262,77 (affiché 262,8).
 */
export function nouveauCump(
  stockAvant: number,
  ancienCump: number,
  quantiteBase: number,
  coutBase: number
): number {
  if (stockAvant <= 0) return coutBase
  return (stockAvant * ancienCump + quantiteBase * coutBase) / (stockAvant + quantiteBase)
}
