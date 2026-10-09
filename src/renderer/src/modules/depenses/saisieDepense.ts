/**
 * Logique pure de l'écran des dépenses (B13, REGLES_METIER § 10). Propriétaire : Dev B.
 * Le processus principal revérifie tout ; ici on guide la saisie et on écrit les textes.
 */
import type { Depense, SourceDepense } from '@shared/ipc/depenses'

export const LIBELLES_SOURCE: Record<SourceDepense, string> = {
  fonds_propres: 'Fonds propres',
  caisse: 'Caisse (tiroir)'
}

/** Tant que les mouvements de caisse (A8, Dev A) ne sont pas livrés, seule cette source est ouverte. */
export const SOURCES_OUVERTES: SourceDepense[] = ['fonds_propres']

/** Date du jour du poste, AAAA-MM-JJ. */
export function aujourdhuiLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « 1 000 » → 1000 ; null si vide, NaN si ce n'est pas un nombre entier de francs. */
export function lireMontant(texte: string): number | null {
  const t = texte.replace(/[\s  ]/g, '')
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

export interface SaisieEcranDepense {
  categorieId: number | null
  libelle: string
  montant: number | null
  source: SourceDepense
  date: string
}

/** Ce qui empêche d'enregistrer, ou null si la saisie est bonne. */
export function manqueDepense(s: SaisieEcranDepense, aujourdhui: string): string | null {
  if (s.categorieId === null) return 'Choisissez la catégorie'
  if (s.libelle.trim() === '') return 'Indiquez à quoi correspond la dépense'
  if (s.montant === null) return 'Indiquez le montant'
  if (Number.isNaN(s.montant) || s.montant <= 0) return 'Le montant est un nombre de francs, sans virgule'
  if (!SOURCES_OUVERTES.includes(s.source))
    return 'Les dépenses payées au tiroir ne sont pas encore disponibles'
  if (s.date === '') return 'Indiquez la date de la dépense'
  if (s.date > aujourdhui) return 'La date ne peut pas être dans le futur'
  return null
}

/** Texte de la colonne « État ». */
export function etatDepense(d: Depense): { texte: string; classe: string } {
  return d.annuleLe
    ? { texte: 'Annulée', classe: 'pastille-inactif' }
    : { texte: 'Enregistrée', classe: 'pastille-ok' }
}
