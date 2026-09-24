/**
 * Propriétaire : Dev A.
 *
 * Onglets de la grille tactile (UI_UX § 5.2, règle 2.5) : un onglet par rayon, par ordre
 * alphabétique, précédés de « Tout ». Filtre local, sans nouvelle requête : la grille est chargée
 * une seule fois à l'ouverture de la caisse. Fonctions pures, testées dans tests/grille.test.ts.
 *
 * Choix validés par Dev A (2026-09-24) : onglets affichés dès deux rayons ; les articles non
 * classés sont regroupés sous « Sans rayon », en dernier.
 */
import type { ArticleCatalogue } from '@shared/types'

export const TOUT = 'Tout'
export const SANS_RAYON = 'Sans rayon'

const rayonDe = (a: ArticleCatalogue): string => a.categorie ?? SANS_RAYON

/** « Tout », puis les rayons présents (ordre alphabétique français), puis « Sans rayon ». */
export function ongletsDeGrille(articles: ArticleCatalogue[]): string[] {
  const rayons = [...new Set(articles.map((a) => a.categorie).filter((c): c is string => !!c))].sort((x, y) =>
    x.localeCompare(y, 'fr', { sensitivity: 'base' })
  )
  const sansRayon = articles.some((a) => !a.categorie) ? [SANS_RAYON] : []
  return [TOUT, ...rayons, ...sansRayon]
}

/** Moins de deux rayons : les onglets n'apporteraient rien. */
export function afficherOnglets(articles: ArticleCatalogue[]): boolean {
  return ongletsDeGrille(articles).length > 2
}

/** Les boutons de l'onglet, dans l'ordre choisi par le gérant. */
export function filtrerGrille(articles: ArticleCatalogue[], onglet: string): ArticleCatalogue[] {
  return onglet === TOUT ? articles : articles.filter((a) => rayonDe(a) === onglet)
}
