/**
 * Propriétaire : Dev A.
 *
 * Logique pure de l'écran de clôture (A4, UI_UX § 5.4) : écart affiché en direct pendant la saisie
 * du compté. Affichage seulement : à la clôture, le processus principal recalcule tout.
 */
import { lireMontant } from './paiement'

export type TonEcart = 'manque' | 'surplus' | 'juste'

export interface EtatCompte {
  /** null tant que rien n'est saisi. */
  compte: number | null
  ecart: number | null
  /** Rouge si négatif, ambre si positif, vert si nul (UI_UX § 5.4). */
  ton: TonEcart | null
  /** Un écart non nul exige un commentaire (règle 6.9, validée par Dev A). */
  commentaireRequis: boolean
  peutCloturer: boolean
}

export function etatCompte(especesTheoriques: number, saisie: string, commentaire: string): EtatCompte {
  if (saisie.trim() === '') {
    return { compte: null, ecart: null, ton: null, commentaireRequis: false, peutCloturer: false }
  }
  const compte = lireMontant(saisie)
  const ecart = compte - especesTheoriques
  const commentaireRequis = ecart !== 0
  return {
    compte,
    ecart,
    ton: ecart < 0 ? 'manque' : ecart > 0 ? 'surplus' : 'juste',
    commentaireRequis,
    peutCloturer: !commentaireRequis || commentaire.trim() !== ''
  }
}

/** '2026-09-24 07:45:12' → '24/09/2026 à 07:45' */
export function dateHeure(dateSql: string): string {
  const [date = '', heure = ''] = dateSql.split(' ')
  const [a, m, j] = date.split('-')
  return `${j}/${m}/${a} à ${heure.slice(0, 5)}`
}
