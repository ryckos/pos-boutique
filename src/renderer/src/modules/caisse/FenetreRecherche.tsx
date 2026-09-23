/**
 * Propriétaire : Dev A.
 *
 * Recherche F2 de la caisse : par nom, ou par code PLU tapé au clavier (règle 2.4).
 * Le champ ne porte pas data-scan : la douchette reste écoutée par la page, pas par ce champ.
 */
import { useEffect, useRef, useState } from 'react'
import type { ArticleCatalogue } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'

/** Attente après la dernière frappe avant d'interroger le catalogue : pas de requête à chaque touche. */
const DELAI_FRAPPE_MS = 200

interface Props {
  onChoisir: (article: ArticleCatalogue) => void
  onFermer: () => void
}

export function FenetreRecherche({ onChoisir, onFermer }: Props): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const [resultats, setResultats] = useState<ArticleCatalogue[]>([])
  const [actif, setActif] = useState(0)
  const [recherche, setRecherche] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Seule la réponse à la dernière frappe est affichée, même si une plus ancienne arrive après.
  const derniere = useRef(0)

  useEffect(() => {
    const t = texte.trim()
    const n = ++derniere.current
    if (!t) {
      setResultats([])
      setRecherche(null)
      return
    }
    const minuteur = setTimeout(async () => {
      try {
        let trouves: ArticleCatalogue[] = []
        // Un nombre peut être un code PLU (« 101 ») : on l'essaie d'abord comme code.
        if (/^\d+$/.test(t)) {
          const article = await appel('catalogue:rechercherCode', { code: t })
          if (article) trouves = [article]
        }
        if (trouves.length === 0) trouves = await appel('catalogue:rechercher', { texte: t })
        if (n !== derniere.current) return
        setResultats(trouves)
        setActif(0)
        setRecherche(t)
        setMessage(null)
      } catch (e) {
        if (n === derniere.current) setMessage((e as Error).message)
      }
    }, DELAI_FRAPPE_MS)
    return () => clearTimeout(minuteur)
  }, [texte])

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onFermer()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActif((i) => Math.min(i + 1, resultats.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActif((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && resultats[actif]) {
      e.preventDefault()
      onChoisir(resultats[actif])
    }
  }

  return (
    <div className="voile" onClick={onFermer}>
      <div
        className="fenetre fenetre-recherche"
        role="dialog"
        aria-label="Rechercher un produit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fenetre-entete">
          <h2>Rechercher un produit</h2>
          <button className="btn btn-discret" onClick={onFermer}>
            Fermer (Échap)
          </button>
        </div>
        <input
          className="recherche-champ"
          autoFocus
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={surTouche}
          placeholder="Nom du produit ou code PLU"
          aria-label="Nom du produit ou code PLU"
        />
        {message && (
          <p className="alerte" role="alert">
            {message}
          </p>
        )}
        {recherche === null ? (
          <p className="vide">Tapez au moins 2 lettres du nom, ou un code PLU.</p>
        ) : resultats.length === 0 ? (
          <p className="vide">
            Aucun produit ne correspond à « {recherche} ». Vérifiez l’orthographe ou scannez l’article.
          </p>
        ) : (
          <ul className="recherche-resultats">
            {resultats.map((a, i) => (
              <li key={a.conditionnementId}>
                <button
                  className={i === actif ? 'recherche-resultat actif' : 'recherche-resultat'}
                  onClick={() => onChoisir(a)}
                  onMouseEnter={() => setActif(i)}
                >
                  <span>
                    {a.designation}
                    {a.codePlu && <span className="vide"> · PLU {a.codePlu}</span>}
                  </span>
                  <span className="montant">{formaterFCFA(a.prixVente)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
