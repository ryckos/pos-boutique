/**
 * Propriétaire : Dev A.
 *
 * Montant en toutes lettres, pour la mention « Arrêtée la présente facture à la somme de … » (A10).
 * Règles du français (orthographe traditionnelle, celle des factures) : traits d'union sous cent,
 * « et » pour 21, 31… 71, « quatre-vingts » et « deux cents » prennent un s seulement en fin de
 * nombre ou devant « millions » / « milliards » (des noms), jamais devant « mille » ; « mille » est
 * invariable et ne prend pas « un ».
 */

const UNITES = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf'
]
const DIZAINES = [
  '',
  '',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante',
  'quatre-vingt',
  'quatre-vingt'
]

/** 0 à 99. `final` : le nombre se termine ici (ou devant million / milliard), « quatre-vingts » prend un s. */
function deuxChiffres(n: number, final: boolean): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  let u = n % 10
  // 70 à 79 et 90 à 99 : soixante-dix…, quatre-vingt-dix…
  if (d === 7 || d === 9) u += 10
  const base = DIZAINES[d]
  if (u === 0) return d === 8 && final ? 'quatre-vingts' : base
  if ((u === 1 || u === 11) && d !== 8 && d !== 9) return `${base} et ${UNITES[u]}`
  return `${base}-${UNITES[u]}`
}

/** 0 à 999. */
function troisChiffres(n: number, final: boolean): string {
  const c = Math.floor(n / 100)
  const reste = n % 100
  const fin = reste === 0 ? '' : deuxChiffres(reste, final)
  if (c === 0) return fin
  const cent = c === 1 ? 'cent' : `${UNITES[c]} cent${reste === 0 && final ? 's' : ''}`
  return fin ? `${cent} ${fin}` : cent
}

/** 1 234 567 → « un million deux cent trente-quatre mille cinq cent soixante-sept ». Entier ≥ 0. */
export function nombreEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Nombre invalide : ${n}`)
  if (n === 0) return 'zéro'
  const milliards = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const reste = n % 1000
  const mots: string[] = []
  if (milliards) mots.push(`${troisChiffres(milliards, true)} milliard${milliards > 1 ? 's' : ''}`)
  if (millions) mots.push(`${troisChiffres(millions, true)} million${millions > 1 ? 's' : ''}`)
  if (milliers) mots.push(milliers === 1 ? 'mille' : `${troisChiffres(milliers, false)} mille`)
  if (reste) mots.push(troisChiffres(reste, true))
  return mots.join(' ')
}

/** « Dix mille cent francs CFA ». */
export function montantEnLettres(montant: number): string {
  const texte = `${nombreEnLettres(montant)} franc${montant > 1 ? 's' : ''} CFA`
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}
