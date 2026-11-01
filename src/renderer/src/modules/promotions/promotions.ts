/**
 * Propriétaire : Dev A.
 * Logique pure de l'écran « Promotions » (A16, UI_UX § 5.28) : formulaire, aperçu des prix, états.
 * Le processus principal revérifie chaque règle ; ici on guide la saisie.
 */
import type { Categorie } from '@shared/ipc/catalogue'
import type { EtatPromotion, Promotion, SaisiePromotion } from '@shared/ipc/promotions'
import { formaterFCFA } from '@shared/format'
import { libelleRegle, prixPromotionnel, type TypePromotion } from '@shared/promotions'
import type { ArticleCatalogue } from '@shared/types'

export type CibleFormulaire = 'produit' | 'rayon'

export interface FormulairePromotion {
  /** Vide = le nom suggéré est utilisé. */
  nom: string
  type: TypePromotion
  /** Saisie brute : pourcentage ou francs par unité selon le type. */
  valeur: string
  cible: CibleFormulaire
  produit: { id: number; nom: string } | null
  categorieId: number | null
  dateDebut: string
  dateFin: string
}

export function formulaireVide(dateDebut: string, dateFin: string): FormulairePromotion {
  return {
    nom: '',
    type: 'remise_pourcent',
    valeur: '',
    cible: 'produit',
    produit: null,
    categorieId: null,
    dateDebut,
    dateFin
  }
}

/** Une promotion existante, pour la modifier. */
export function formulaireDepuis(p: Promotion): FormulairePromotion {
  return {
    nom: p.nom,
    type: p.type,
    valeur: String(p.valeur),
    cible: p.produitId !== null ? 'produit' : 'rayon',
    produit: p.produitId !== null ? { id: p.produitId, nom: p.produit ?? '' } : null,
    categorieId: p.categorieId,
    dateDebut: p.dateDebut,
    dateFin: p.dateFin
  }
}

/** Nombre entier saisi (espaces tolérés) ; NaN si ce n'est pas un entier positif. */
export function lireValeur(saisie: string): number {
  const t = saisie.replace(/\s/g, '')
  return /^\d+$/.test(t) ? Number(t) : NaN
}

/** Le nom du produit sans son conditionnement : « Tomate — Carton de 24 » → « Tomate ». */
export function nomDuProduit(designation: string): string {
  return designation.split(' — ')[0]
}

/** « Yaourt −20 % » : proposé tant que le gérant n'a pas tapé son propre nom. */
export function nomSuggere(f: FormulairePromotion, nomRayon: string | null): string {
  const cible = f.cible === 'produit' ? f.produit?.nom : nomRayon
  const valeur = lireValeur(f.valeur)
  if (!cible || Number.isNaN(valeur)) return ''
  return `${cible} ${libelleRegle({ type: f.type, valeur }, formaterFCFA)}`
}

/** Pourquoi on ne peut pas encore valider ; null quand tout est bon. */
export function blocage(f: FormulairePromotion, nomRayon: string | null): string | null {
  if (f.cible === 'produit' && !f.produit) return 'Choisissez le produit en promotion.'
  if (f.cible === 'rayon' && f.categorieId === null) return 'Choisissez le rayon en promotion.'
  const valeur = lireValeur(f.valeur)
  if (Number.isNaN(valeur) || valeur < 1) return 'Indiquez la valeur de la promotion (un nombre entier).'
  if (f.type === 'remise_pourcent' && valeur > 99) return 'Un pourcentage de remise va de 1 à 99.'
  if (!f.dateDebut || !f.dateFin) return 'Choisissez les dates de début et de fin.'
  if (f.dateDebut > f.dateFin) return 'Le début de la promotion doit précéder sa fin.'
  if (f.nom.trim() === '' && nomSuggere(f, nomRayon) === '') return 'Donnez un nom à la promotion.'
  return null
}

/** Ce qui est envoyé au processus principal ; null tant que le formulaire est incomplet. */
export function versSaisie(f: FormulairePromotion, nomRayon: string | null): SaisiePromotion | null {
  if (blocage(f, nomRayon) !== null) return null
  return {
    nom: f.nom.trim() || nomSuggere(f, nomRayon),
    type: f.type,
    valeur: lireValeur(f.valeur),
    produitId: f.cible === 'produit' ? f.produit!.id : null,
    categorieId: f.cible === 'rayon' ? f.categorieId : null,
    dateDebut: f.dateDebut,
    dateFin: f.dateFin
  }
}

export interface LigneApercu {
  designation: string
  prixNormal: number
  /** null = la promotion n'a pas d'effet sur ce conditionnement. */
  prixPromo: number | null
}

/** Les prix de chaque conditionnement du produit, avant et après la promotion. */
export function apercuPrix(f: FormulairePromotion, conditionnements: ArticleCatalogue[]): LigneApercu[] {
  const valeur = lireValeur(f.valeur)
  return conditionnements.map((a) => ({
    designation: a.designation,
    prixNormal: a.prixVente,
    prixPromo:
      Number.isNaN(valeur) || valeur < 1
        ? null
        : prixPromotionnel({ type: f.type, valeur }, a.prixVente, a.quantiteBase)
  }))
}

/** Rayons et sous-rayons actifs pour la liste de choix : « Alimentation », « Alimentation › Conserves ». */
export function optionsRayons(categories: Categorie[]): { id: number; libelle: string }[] {
  const actives = categories.filter((c) => c.actif)
  const nom = new Map(actives.map((c) => [c.id, c.nom]))
  return actives
    .map((c) => ({
      id: c.id,
      libelle: c.parentId !== null && nom.has(c.parentId) ? `${nom.get(c.parentId)} › ${c.nom}` : c.nom
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
}

export type OngletPromotions = 'actives' | 'terminees'

export const ONGLETS_PROMOTIONS: { cle: OngletPromotions; libelle: string }[] = [
  { cle: 'actives', libelle: 'En cours et à venir' },
  { cle: 'terminees', libelle: 'Terminées et arrêtées' }
]

/** « En cours et à venir » : en cours d'abord, puis celles qui commencent le plus tôt. */
export function filtrerPromotions(promotions: Promotion[], onglet: OngletPromotions): Promotion[] {
  const active = (p: Promotion): boolean => p.etat === 'en_cours' || p.etat === 'a_venir'
  const liste = promotions.filter((p) => (onglet === 'actives' ? active(p) : !active(p)))
  if (onglet === 'terminees') return liste
  return [...liste].sort(
    (a, b) =>
      Number(b.etat === 'en_cours') - Number(a.etat === 'en_cours') || a.dateDebut.localeCompare(b.dateDebut)
  )
}

export const LIBELLES_ETAT: Record<EtatPromotion, string> = {
  en_cours: 'En cours',
  a_venir: 'À venir',
  terminee: 'Terminée',
  arretee: 'Arrêtée'
}

export const CLASSE_ETAT: Record<EtatPromotion, string> = {
  en_cours: 'pastille-ok',
  a_venir: 'pastille-info',
  terminee: 'pastille-inactif',
  arretee: 'pastille-inactif'
}

/** Une promotion qu'on peut encore modifier ou arrêter. */
export function estModifiable(p: Pick<Promotion, 'etat'>): boolean {
  return p.etat === 'en_cours' || p.etat === 'a_venir'
}

export interface PreRemplissage {
  produitId: number
  pourcent: number | null
  fin: string | null
}

/**
 * Lien d'un autre écran, par exemple le bouton « Promo » de la page Péremptions :
 * `/promotions?produit=12&pourcent=20&fin=2026-11-15`. null si le lien n'a pas de produit.
 */
export function lirePreRemplissage(recherche: URLSearchParams): PreRemplissage | null {
  const produitId = Number(recherche.get('produit'))
  if (!Number.isInteger(produitId) || produitId < 1) return null
  const pourcent = Number(recherche.get('pourcent'))
  const fin = recherche.get('fin')
  return {
    produitId,
    pourcent: Number.isInteger(pourcent) && pourcent >= 1 && pourcent <= 99 ? pourcent : null,
    fin: fin && /^\d{4}-\d{2}-\d{2}$/.test(fin) ? fin : null
  }
}
