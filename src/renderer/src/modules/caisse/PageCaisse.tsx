/**
 * Propriétaire : Dev A.
 *
 * Écran de caisse (maquette docs/UI_UX.md § 5.2) : grille tactile à gauche, ticket à droite,
 * total en très grand. L'état du panier vit dans panier.ts (fonctions pures, testées).
 * À venir : onglets, recherche F2, conditionnement, attente (A1.2) · encaissement (A2) · session (A4).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { ArticleCatalogue } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { useUtilisateur } from '@renderer/app/contexte'
import {
  panierVide,
  reducteurPanier,
  totalLigne,
  totalPanier,
  trouverLigne,
  versPanierClient
} from './panier'

/** Durée du surlignage d'une ligne ajoutée : un retour visuel, pas une animation décorative. */
const DUREE_SURLIGNAGE_MS = 600

export function PageCaisse(): React.JSX.Element {
  const utilisateur = useUtilisateur()
  const [panier, dispatch] = useReducer(reducteurPanier, panierVide)
  const [grille, setGrille] = useState<ArticleCatalogue[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [surlignee, setSurlignee] = useState<{ id: number; n: number } | null>(null)
  const fileScans = useRef<Promise<void>>(Promise.resolve())
  const ligneSelectionnee = useRef<HTMLLIElement | null>(null)

  // La grille est chargée une seule fois : pas de requête pendant la vente.
  useEffect(() => {
    appel('catalogue:grille')
      .then(setGrille)
      .catch((e: Error) => setMessage(e.message))
  }, [])

  const ajouter = useCallback((article: ArticleCatalogue) => {
    setMessage(null)
    dispatch({ type: 'ajouter', article })
    setSurlignee((s) => ({ id: article.conditionnementId, n: (s?.n ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!surlignee) return
    const minuteur = setTimeout(() => setSurlignee(null), DUREE_SURLIGNAGE_MS)
    return () => clearTimeout(minuteur)
  }, [surlignee])

  // Les scans sont traités un par un, dans l'ordre d'arrivée : une rafale plus rapide que les
  // réponses du catalogue ne perd ni n'inverse aucun article. Une erreur n'arrête pas la file.
  useScanner((code) => {
    fileScans.current = fileScans.current.then(async () => {
      try {
        const article = await appel('catalogue:rechercherCode', { code })
        if (article) ajouter(article)
        else setMessage(`Code ${code} inconnu. Créez le produit ou vérifiez le code.`)
      } catch (e) {
        setMessage((e as Error).message)
      }
    })
  })

  const total = totalPanier(panier)
  const selection = panier.selection !== null ? trouverLigne(panier, panier.selection) : undefined

  useEffect(() => {
    window.pos.envoyerPanierClient(versPanierClient(panier))
  }, [panier])

  // Garde la ligne touchée visible quand le ticket est long.
  useEffect(() => {
    ligneSelectionnee.current?.scrollIntoView({ block: 'nearest' })
  }, [panier.selection, surlignee])

  return (
    <div className="caisse">
      <section className="caisse-grille">
        {grille.length === 0 ? (
          <p className="vide">Aucun bouton tactile. Scannez un article pour commencer.</p>
        ) : (
          <div className="grille-boutons">
            {grille.map((a) => (
              <button key={a.conditionnementId} className="bouton-article" onClick={() => ajouter(a)}>
                <span>{a.designation}</span>
                <span className="montant">{formaterFCFA(a.prixVente)}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className="btn btn-discret caisse-ecran-client"
          onClick={() => appel('materiel:ouvrirEcranClient')}
        >
          Ouvrir l’écran client
        </button>
      </section>

      <section className="caisse-ticket">
        <div className="ticket-entete">
          <h2>Ticket en cours</h2>
          <span className="vide">Caisse : {utilisateur.nom}</span>
        </div>

        {panier.lignes.length === 0 ? (
          <p className="vide">Scannez un article ou touchez un bouton pour commencer.</p>
        ) : (
          <ul className="ticket-lignes">
            {panier.lignes.map((l) => {
              const id = l.article.conditionnementId
              const estSelectionnee = id === panier.selection
              const classes = [
                'ticket-ligne',
                estSelectionnee ? 'ticket-ligne-selectionnee' : '',
                surlignee?.id === id ? 'ticket-ligne-surlignee' : ''
              ].join(' ')
              return (
                <li
                  // La clé change à chaque ajout pour relancer le surlignage sur la même ligne.
                  key={surlignee?.id === id ? `${id}-${surlignee.n}` : id}
                  ref={estSelectionnee ? ligneSelectionnee : undefined}
                  className={classes}
                  onClick={() =>
                    dispatch({ type: 'selectionner', conditionnementId: estSelectionnee ? null : id })
                  }
                >
                  <span className="ticket-ligne-libelle">
                    {l.quantite > 1 && `${l.quantite} × `}
                    {l.article.designation}
                    {/* Pastille si ce n'est pas l'unité : le piège du code unité lu à travers le carton. */}
                    {l.article.quantiteBase !== 1 && (
                      <span className="pastille pastille-conditionnement">{l.article.conditionnement}</span>
                    )}
                  </span>
                  <span className="montant">{formaterFCFA(totalLigne(l))}</span>
                </li>
              )
            })}
          </ul>
        )}

        {selection && (
          <div className="ticket-actions">
            <button
              className="btn btn-discret"
              aria-label="Diminuer la quantité"
              onClick={() =>
                dispatch({ type: 'decrementer', conditionnementId: selection.article.conditionnementId })
              }
            >
              −
            </button>
            <span className="montant ticket-actions-quantite">{selection.quantite}</span>
            <button
              className="btn btn-discret"
              aria-label="Augmenter la quantité"
              onClick={() =>
                dispatch({ type: 'incrementer', conditionnementId: selection.article.conditionnementId })
              }
            >
              +
            </button>
            <button
              className="btn btn-discret ticket-actions-supprimer"
              onClick={() =>
                dispatch({ type: 'supprimer', conditionnementId: selection.article.conditionnementId })
              }
            >
              Supprimer la ligne
            </button>
          </div>
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

        {/* L'encaissement arrive avec A2 : les boutons sont en place mais inactifs. */}
        <div className="caisse-paiements">
          <button className="btn caisse-paiement-principal" disabled>
            Espèces
          </button>
          <button className="btn" disabled>
            TMoney
          </button>
          <button className="btn" disabled>
            Flooz
          </button>
          <button className="btn" disabled>
            Crédit
          </button>
        </div>
        <button
          className="btn btn-discret"
          disabled={panier.lignes.length === 0}
          onClick={() => dispatch({ type: 'vider' })}
        >
          Vider le ticket
        </button>
      </section>
    </div>
  )
}
