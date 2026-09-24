/**
 * Règles pures du catalogue, partagées par le service (qui décide) et la fiche produit (qui les
 * affiche en direct). Propriétaire : Dev B. REGLES_METIER § 2.2 et 2.3.
 */

/** Code-barres saisi ou scanné : EAN-8, EAN-13, ITF-14… de 8 à 14 chiffres. */
export const FORMAT_CODE_BARRES = /^\d{8,14}$/
/** Code PLU tapé au clavier : 1 à 5 chiffres (`101` = baguette). */
export const FORMAT_CODE_PLU = /^\d{1,5}$/

/** Clé de contrôle EAN-13 des 12 premiers chiffres : poids 1 et 3 en alternance depuis la gauche. */
export function cleEan13(douzeChiffres: string): number {
  if (!/^\d{12}$/.test(douzeChiffres))
    throw new Error(`EAN-13 : 12 chiffres attendus, reçu « ${douzeChiffres} »`)
  const somme = [...douzeChiffres].reduce((s, c, i) => s + Number(c) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (somme % 10)) % 10
}

/**
 * Code interne n° `numero` : préfixe 20, numéro sur 10 chiffres, clé de contrôle.
 * `codeInterne(1)` = `2000000000015`.
 */
export function codeInterne(numero: number): string {
  const douze = `20${String(numero).padStart(10, '0')}`
  return `${douze}${cleEan13(douze)}`
}

export interface PrixConditionnement {
  nom: string
  quantiteBase: number
  prixVente: number
}

/** Un conditionnement plus cher que la même quantité achetée à l'unité. */
export interface AlertePrix {
  conditionnement: string
  prixVente: number
  /** Prix de la même quantité à l'unité : quantité × prix de l'Unité. */
  prixALUnite: number
}

/**
 * Garde-fou prix (REGLES_METIER § 2.2) : alerte sans bloquer quand
 * `prix > prixUnité × quantite_base`. Probablement une erreur de saisie, mais cela peut être voulu.
 */
export function alertesPrix(prixUnite: number, autres: PrixConditionnement[]): AlertePrix[] {
  return autres
    .filter((c) => c.quantiteBase > 0 && c.prixVente > prixUnite * c.quantiteBase)
    .map((c) => ({
      conditionnement: c.nom,
      prixVente: c.prixVente,
      prixALUnite: Math.round(prixUnite * c.quantiteBase)
    }))
}
