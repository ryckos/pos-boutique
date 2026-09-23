/** Formatage commun. ZONE PARTAGÉE. */

/** 7500 → "7 500 F". Les montants sont TOUJOURS des entiers en FCFA. */
export function formaterFCFA(montant: number): string {
  return `${Math.round(montant).toLocaleString('fr-FR')} F`
}

/** Quantité lisible : 24 → "24", 1.5 → "1,5". */
export function formaterQuantite(quantite: number): string {
  return quantite.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
}

/** Durée restante lisible, arrondie au-dessus : 30 000 → "30 s", 61 000 → "2 min". */
export function formaterDelai(ms: number): string {
  const secondes = Math.max(1, Math.ceil(ms / 1000))
  return secondes < 60 ? `${secondes} s` : `${Math.ceil(secondes / 60)} min`
}

/** Date SQLite locale « 2026-09-23 11:21:00 » → "23/09/2026". */
export function formaterDate(dateSql: string): string {
  const [a, m, j] = dateSql.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}
