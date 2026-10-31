/**
 * Règles pures du retour client, partagées par le service et l'écran. Propriétaire : Dev A.
 * REGLES_METIER § 6.8 (précisions validées par Dev A le 2026-10-13, tâche A7).
 */

export type MotifRetour = 'defectueux' | 'erreur_article' | 'autre'
export type SortRetour = 'detruire' | 'remettre_en_stock'
export type ModeRemboursement = 'especes' | 'tmoney' | 'flooz' | 'avoir'

export const LIBELLES_MOTIF_RETOUR: Record<MotifRetour, string> = {
  defectueux: 'Produit défectueux',
  erreur_article: 'Erreur d’article',
  autre: 'Autre'
}

export const LIBELLES_SORT_RETOUR: Record<SortRetour, string> = {
  detruire: 'Détruire',
  remettre_en_stock: 'Remettre en stock'
}

/**
 * Motif en clair, tel qu'il est gardé sur le retour et imprimé : « Produit défectueux »,
 * « Produit défectueux (boîte bombée) », « Autre : taille trop petite ». Null si incomplet
 * (« Autre » sans précision).
 */
export function texteMotifRetour(motif: MotifRetour, precision?: string): string | null {
  const p = precision?.trim()
  if (motif === 'autre') return p ? `Autre : ${p}` : null
  return p ? `${LIBELLES_MOTIF_RETOUR[motif]} (${p})` : LIBELLES_MOTIF_RETOUR[motif]
}

/** Une ligne vendue, vue du retour. */
export interface LigneRetournable {
  quantiteVendue: number
  quantiteDejaRetournee: number
  /** Ce que le client a réellement payé pour la ligne : nette de sa remise et de sa part de la remise du ticket. */
  montantPaye: number
  montantDejaRembourse: number
}

export const quantiteRetournable = (l: LigneRetournable): number => l.quantiteVendue - l.quantiteDejaRetournee

/**
 * Montant rendu pour `quantite` conditionnements de la ligne : au prorata de ce qui a été payé, en
 * francs entiers (partie entière). Le retour qui rend les DERNIERS conditionnements de la ligne prend
 * le reste : une ligne entièrement retournée, en une ou plusieurs fois, rend exactement le payé.
 */
export function montantRetourLigne(l: LigneRetournable, quantite: number): number {
  if (quantite <= 0) return 0
  if (quantite >= quantiteRetournable(l)) return l.montantPaye - l.montantDejaRembourse
  return Math.floor((l.montantPaye * quantite) / l.quantiteVendue)
}

/** « 158 » → « T-2026-000158 » (ticket de l'année en cours) ; un numéro complet reste tel quel. */
export function numeroTicketComplet(saisie: string, annee: number): string {
  const s = saisie.trim().toUpperCase()
  return /^\d{1,6}$/.test(s) ? `T-${annee}-${s.padStart(6, '0')}` : s
}

/** Le crédit d'un ticket vendu à crédit, tel que le retour le voit (A12, REGLES_METIER § 6.8). */
export interface CreditDuTicket {
  /** Part du ticket payée à crédit. */
  totalCredit: number
  /** Ce que le client doit encore sur la créance de ce ticket. */
  restantCreance: number
  /** Valeur déjà rendue par les retours précédents (créance et remboursements confondus). */
  dejaRendu: number
  /** Total du ticket. */
  totalTtc: number
}

/**
 * Sépare la valeur d'un retour : la part qui était à crédit réduit d'abord la créance (au prorata
 * du ticket, le retour qui solde le ticket prenant le reste), jamais plus que ce que le client doit
 * encore ; le reste se rembourse. Un ticket sans crédit rembourse tout.
 */
export function repartirRetourCredit(
  credit: CreditDuTicket | null,
  valeur: number
): { creanceReduite: number; aRembourser: number } {
  if (!credit || credit.totalCredit <= 0 || valeur <= 0) return { creanceReduite: 0, aRembourser: valeur }
  const cible = (cumul: number): number =>
    cumul >= credit.totalTtc ? credit.totalCredit : Math.floor((cumul * credit.totalCredit) / credit.totalTtc)
  const part = cible(credit.dejaRendu + valeur) - cible(credit.dejaRendu)
  const creanceReduite = Math.max(0, Math.min(part, credit.restantCreance))
  return { creanceReduite, aRembourser: valeur - creanceReduite }
}
