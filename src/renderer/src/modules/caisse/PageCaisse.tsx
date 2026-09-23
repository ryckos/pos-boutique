/**
 * Propriétaire : Dev A.
 *
 * DÉMONSTRATION DU SOCLE — à remplacer par le vrai écran de caisse (tâches A1 à A5).
 * Elle prouve que toute la chaîne fonctionne : douchette → contrat catalogue (Dev B)
 * → base → panier → écran client. Scannez, ou tapez vite « 16181000000049 » puis Entrée.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ArticleCatalogue } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'

interface Ligne {
  article: ArticleCatalogue
  quantite: number
}

export function PageCaisse(): React.JSX.Element {
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [grille, setGrille] = useState<ArticleCatalogue[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    appel('catalogue:grille').then(setGrille).catch((e: Error) => setMessage(e.message))
  }, [])

  const ajouter = useCallback((article: ArticleCatalogue) => {
    setMessage(null)
    setLignes((ls) => {
      const i = ls.findIndex((l) => l.article.conditionnementId === article.conditionnementId)
      if (i === -1) return [...ls, { article, quantite: 1 }]
      return ls.map((l, j) => (j === i ? { ...l, quantite: l.quantite + 1 } : l))
    })
  }, [])

  useScanner(async (code) => {
    try {
      const article = await appel('catalogue:rechercherCode', { code })
      if (article) ajouter(article)
      else setMessage(`Code ${code} inconnu`)
    } catch (e) {
      setMessage((e as Error).message)
    }
  })

  const total = lignes.reduce((s, l) => s + l.quantite * l.article.prixVente, 0)

  useEffect(() => {
    window.pos.envoyerPanierClient({
      total,
      lignes: lignes.map((l) => ({
        designation: l.article.designation,
        quantite: l.quantite,
        total: l.quantite * l.article.prixVente
      }))
    })
  }, [lignes, total])

  return (
    <div className="caisse">
      <section className="caisse-grille">
        <p className="bandeau">Écran de démonstration du socle — le vrai écran de caisse arrive avec les tâches A1 à A5.</p>
        <div className="grille-boutons">
          {grille.map((a) => (
            <button key={a.conditionnementId} className="bouton-article" onClick={() => ajouter(a)}>
              <span>{a.designation}</span>
              <span className="montant">{formaterFCFA(a.prixVente)}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-discret" onClick={() => appel('materiel:ouvrirEcranClient')}>
          Ouvrir l’écran client
        </button>
      </section>

      <section className="caisse-ticket">
        <h2>Ticket en cours</h2>
        {lignes.length === 0 ? (
          <p className="vide">Scannez un article ou touchez un bouton pour commencer.</p>
        ) : (
          <ul className="ticket-lignes">
            {lignes.map((l) => (
              <li key={l.article.conditionnementId}>
                <span>
                  {l.quantite} × {l.article.designation}
                </span>
                <span className="montant">{formaterFCFA(l.quantite * l.article.prixVente)}</span>
              </li>
            ))}
          </ul>
        )}
        {message && (
          <p className="alerte" role="alert">
            {message}
          </p>
        )}
        <div className="ticket-total">
          <span>Total</span>
          <span className="montant">{formaterFCFA(total)}</span>
        </div>
        <button className="btn" disabled={lignes.length === 0} onClick={() => setLignes([])}>
          Vider le ticket
        </button>
      </section>
    </div>
  )
}
