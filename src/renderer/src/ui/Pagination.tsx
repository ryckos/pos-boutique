/**
 * Barre de pagination sous un tableau de gestion. ZONE PARTAGÉE.
 *
 *   const pages = usePagination(visibles)
 *   … {pages.elements.map(…)} …
 *   <Pagination pages={pages} />
 *
 * Masquée tant que la liste tient sur la plus petite page : une liste courte reste simple.
 */
import { TAILLES_PAGE, type Pagination as EtatPagination } from '@renderer/lib/pagination'
import { BoutonIcone } from './BoutonIcone'

export function Pagination(props: { pages: EtatPagination<unknown> }): React.JSX.Element | null {
  const { page, nbPages, debut, fin, total, taille, allerA, changerTaille } = props.pages
  if (total <= TAILLES_PAGE[0]) return null

  return (
    <nav className="pagination" aria-label="Pagination du tableau">
      <span className="pagination-compte">
        Lignes {debut + 1} à {fin} sur {total}
      </span>
      <label className="pagination-taille">
        Par page
        <select value={taille} onChange={(e) => changerTaille(Number(e.target.value))}>
          {TAILLES_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="pagination-boutons">
        <BoutonIcone
          icone="premier"
          libelle="Première page"
          disabled={page === 1}
          onClick={() => allerA(1)}
        />
        <BoutonIcone
          icone="precedent"
          libelle="Page précédente"
          disabled={page === 1}
          onClick={() => allerA(page - 1)}
        />
        <span className="pagination-page" aria-live="polite">
          Page {page} / {nbPages}
        </span>
        <BoutonIcone
          icone="suivant"
          libelle="Page suivante"
          disabled={page === nbPages}
          onClick={() => allerA(page + 1)}
        />
        <BoutonIcone
          icone="dernier"
          libelle="Dernière page"
          disabled={page === nbPages}
          onClick={() => allerA(nbPages)}
        />
      </div>
    </nav>
  )
}
