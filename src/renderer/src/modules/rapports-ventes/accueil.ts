/**
 * Propriétaire : Dev A.
 * Logique pure du tableau de bord d'accueil (A15, UI_UX § 5.27) : les chiffres viennent du processus
 * principal, ici on ne fait que les mettre en phrases.
 */
import type { AlertesAccueil, LotPerimable, ProduitEnAlerte } from '@shared/ipc/stock'
import { formaterQuantite } from '@shared/format'

/** « 1 rupture », « 3 ruptures ». */
export function pluriel(n: number, singulier: string, plur = `${singulier}s`): string {
  return `${n} ${n > 1 ? plur : singulier}`
}

/** Résumé de la carte Stock ; « Aucune alerte » quand tout va bien. */
export function phraseStock(stock: AlertesAccueil['stock']): string {
  const parties = [
    stock.nbRuptures > 0 ? pluriel(stock.nbRuptures, 'rupture') : null,
    stock.nbStockBas > 0 ? pluriel(stock.nbStockBas, 'stock bas', 'stocks bas') : null
  ].filter((p): p is string => p !== null)
  return parties.length > 0 ? parties.join(' · ') : 'Aucune alerte de stock'
}

/** « Rupture : 0 boîte » / « Stock bas : 4 boîtes (seuil 10) ». */
export function detailProduit(p: ProduitEnAlerte): string {
  const stock = `${formaterQuantite(p.stock)} ${p.unite}`
  return p.niveau === 'rupture' ? `En rupture (${stock})` : `${stock} (seuil ${formaterQuantite(p.seuil)})`
}

/** Résumé de la carte Péremptions ; « Aucun produit proche de sa date » quand il n'y a rien. */
export function phrasePeremptions(p: AlertesAccueil['peremptions']): string {
  const parties = [
    p.nbPerimes > 0 ? pluriel(p.nbPerimes, 'périmé') : null,
    p.nbUrgents > 0 ? pluriel(p.nbUrgents, 'urgent') : null,
    p.nbProches > 0 ? pluriel(p.nbProches, 'à surveiller', 'à surveiller') : null
  ].filter((x): x is string => x !== null)
  return parties.length > 0 ? parties.join(' · ') : 'Aucun lot proche de sa date'
}

/** « Périmé depuis 2 jours », « Périme aujourd’hui », « Périme demain », « Périme dans 5 jours ». */
export function delaiLot(lot: Pick<LotPerimable, 'joursRestants'>): string {
  const j = lot.joursRestants
  if (j < 0) return `Périmé depuis ${pluriel(-j, 'jour')}`
  if (j === 0) return 'Périme aujourd’hui'
  if (j === 1) return 'Périme demain'
  return `Périme dans ${j} jours`
}

export interface OuvertureCaisse {
  texte: string
  /** Ouverte depuis la veille ou avant : probablement oubliée, la clôture est à faire. */
  ancienne: boolean
}

/** « depuis 07 h 45 » le jour même ; « depuis le 31/10 à 18 h 05 » sinon (caisse peut-être oubliée). */
export function depuisQuand(dateOuverture: string, jour: string): OuvertureCaisse {
  const [date = '', heure = ''] = dateOuverture.split(' ')
  const hhmm = heure.slice(0, 5).replace(':', ' h ')
  if (date === jour) return { texte: `depuis ${hhmm}`, ancienne: false }
  const [, m, jj] = date.split('-')
  return { texte: `depuis le ${jj}/${m} à ${hhmm}`, ancienne: true }
}
