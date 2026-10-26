/**
 * Pagination des tableaux de gestion. ZONE PARTAGÉE.
 *
 * On ne pagine que l'affichage : filtres, totaux et exports Excel travaillent toujours sur la liste
 * entière (un export reprend « ce que l'écran affiche, filtres compris », pas la seule page visible).
 */
import { useEffect, useState } from 'react'

/** 20 lignes tiennent sur l'écran du terminal (1366 × 768) sans défiler, en-tête de page compris. */
export const TAILLE_PAGE_DEFAUT = 20
export const TAILLES_PAGE = [10, 20, 50, 100] as const

export interface Tranche {
  /** Page affichée, ramenée entre 1 et `nbPages`. */
  page: number
  nbPages: number
  /** Indice du premier élément affiché (inclus) et du dernier (exclu). */
  debut: number
  fin: number
  total: number
}

/** Règle pure : quelle tranche afficher pour `total` éléments, une page demandée et une taille. */
export function tranche(total: number, page: number, taille: number): Tranche {
  const t = Math.max(1, Math.floor(taille))
  const nbPages = Math.max(1, Math.ceil(total / t))
  const p = Math.min(Math.max(1, Math.floor(page) || 1), nbPages)
  const debut = (p - 1) * t
  return { page: p, nbPages, debut, fin: Math.min(debut + t, total), total }
}

export interface Pagination<T> extends Tranche {
  elements: T[]
  taille: number
  allerA: (page: number) => void
  changerTaille: (taille: number) => void
}

/**
 * Découpe `liste` en pages. On revient à la première page quand le nombre d'éléments change (nouveau
 * filtre, nouvelle recherche) ; une modification sur place (même nombre de lignes) garde la page.
 */
export function usePagination<T>(liste: T[], tailleInitiale = TAILLE_PAGE_DEFAUT): Pagination<T> {
  const [page, setPage] = useState(1)
  const [taille, setTaille] = useState(tailleInitiale)
  const total = liste.length

  useEffect(() => setPage(1), [total])

  const t = tranche(total, page, taille)
  return {
    ...t,
    elements: liste.slice(t.debut, t.fin),
    taille,
    allerA: setPage,
    changerTaille: (n) => {
      setTaille(n)
      setPage(1)
    }
  }
}
