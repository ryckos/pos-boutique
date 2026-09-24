/**
 * Propriétaire : Dev A.
 *
 * « Changer le conditionnement » d'une ligne du ticket (règles 2.3 et 6.2) : la parade au piège du
 * code de l'unité lu à travers le film d'un carton. Liste les conditionnements vendables du produit
 * (catalogue:conditionnementsProduit, Dev B), l'actuel mis en évidence ; un toucher change la ligne.
 * Fenêtre de caisse : `.voile` / `.fenetre`, comme la recherche F2.
 */
import { useEffect, useState } from 'react'
import type { ArticleCatalogue } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import type { LignePanier } from './panier'

interface Props {
  ligne: LignePanier
  onChoisir: (article: ArticleCatalogue) => void
  onFermer: () => void
}

export function FenetreConditionnement({ ligne, onChoisir, onFermer }: Props): React.JSX.Element {
  /** undefined = en cours de chargement. */
  const [choix, setChoix] = useState<ArticleCatalogue[] | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const actuel = ligne.article.conditionnementId

  useEffect(() => {
    appel('catalogue:conditionnementsProduit', { produitId: ligne.article.produitId })
      .then(setChoix)
      .catch((e: Error) => {
        setChoix([])
        setMessage(e.message)
      })
  }, [ligne.article.produitId])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div className="voile" onClick={onFermer}>
      <div
        className="fenetre fenetre-conditionnement"
        role="dialog"
        aria-modal="true"
        aria-label="Changer le conditionnement"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fenetre-entete">
          <h2>Changer le conditionnement</h2>
          <button className="btn btn-discret" onClick={onFermer}>
            Fermer (Échap)
          </button>
        </div>
        <p className="vide">
          {ligne.quantite} × {ligne.article.designation} : touchez le bon conditionnement. La quantité est
          gardée.
        </p>

        {message && (
          <p className="alerte" role="alert">
            {message}
          </p>
        )}

        {choix === undefined ? (
          <p className="vide">Chargement des conditionnements…</p>
        ) : choix.length <= 1 && !message ? (
          <p className="vide">Ce produit ne se vend qu’à l’unité.</p>
        ) : (
          <ul className="conditionnement-choix">
            {choix.map((a) => {
              const estActuel = a.conditionnementId === actuel
              return (
                <li key={a.conditionnementId}>
                  <button
                    className={estActuel ? 'conditionnement-option actuel' : 'conditionnement-option'}
                    disabled={estActuel}
                    onClick={() => onChoisir(a)}
                  >
                    <span>
                      {a.conditionnement}
                      {a.quantiteBase !== 1 && <span className="vide"> · {a.quantiteBase} unités</span>}
                      {estActuel && <span className="pastille pastille-conditionnement">Actuel</span>}
                    </span>
                    <span className="montant">{formaterFCFA(a.prixVente)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
