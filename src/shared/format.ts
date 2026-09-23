/** Formatage commun. ZONE PARTAGÉE. */

/** 7500 → "7 500 F". Les montants sont TOUJOURS des entiers en FCFA. */
export function formaterFCFA(montant: number): string {
  return `${Math.round(montant).toLocaleString('fr-FR')} F`
}

/** Quantité lisible : 24 → "24", 1.5 → "1,5". */
export function formaterQuantite(quantite: number): string {
  return quantite.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
}
