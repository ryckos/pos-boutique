/**
 * Propriétaire : Dev A.
 *
 * Écran de caisse (maquette docs/UI_UX.md § 5.2) : grille tactile à gauche, ticket à droite,
 * total en très grand. L'état (ticket courant et tickets en attente) vit dans panier.ts et
 * attente.ts (fonctions pures, testées). Sans session ouverte, seul « Ouvrir la caisse » s'affiche.
 * À venir : onglets de catégories et changement de conditionnement (A1.2) · ticket et tiroir (A3) ·
 * clôture, X et Z (A4).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { ArticleCatalogue } from '@shared/types'
import type { ModePaiementCaisse, SessionCaisse, VenteEnregistree } from '@shared/ipc/caisse'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { useUtilisateur } from '@renderer/app/contexte'
import { totalLigne, totalPanier, trouverLigne, versPanierClient, type ActionPanier } from './panier'
import { etatCaisseInitial, reducteurCaisse, resumeAttente, type EtatCaisse } from './attente'
import { actionClavier } from './clavier'
import { versRequete, type EtatPaiement } from './paiement'
import { FenetreRecherche } from './FenetreRecherche'
import { FenetrePaiement } from './FenetrePaiement'
import { OuvertureCaisse } from './OuvertureCaisse'

/** Durée du surlignage d'une ligne ajoutée : un retour visuel, pas une animation décorative. */
const DUREE_SURLIGNAGE_MS = 600

/**
 * Ticket courant et tickets en attente de chaque caissière, gardés en mémoire tant que
 * l'application tourne : quitter l'écran de caisse ou se déconnecter ne perd rien. Jamais en base
 * (choix validé par Dev A, 2026-09-23).
 */
const memoireParUtilisateur = new Map<number, EtatCaisse>()

export function PageCaisse(): React.JSX.Element {
  const utilisateur = useUtilisateur()
  const [etat, dispatch] = useReducer(
    reducteurCaisse,
    utilisateur.id,
    (id) => memoireParUtilisateur.get(id) ?? etatCaisseInitial
  )
  const [grille, setGrille] = useState<ArticleCatalogue[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  /** Mode choisi pour ouvrir la fenêtre de paiement ; null = fenêtre fermée. */
  const [paiement, setPaiement] = useState<ModePaiementCaisse | null>(null)
  /** undefined = en cours de lecture ; null = caisse fermée. */
  const [session, setSession] = useState<SessionCaisse | null | undefined>(undefined)
  const [derniereVente, setDerniereVente] = useState<VenteEnregistree | null>(null)
  const [surlignee, setSurlignee] = useState<{ id: number; n: number } | null>(null)
  const fileScans = useRef<Promise<void>>(Promise.resolve())
  const ligneSelectionnee = useRef<HTMLLIElement | null>(null)
  const panier = etat.courant
  const caisseOuverte = !!session

  useEffect(() => {
    memoireParUtilisateur.set(utilisateur.id, etat)
  }, [utilisateur.id, etat])

  useEffect(() => {
    appel('caisse:sessionCourante')
      .then(setSession)
      .catch((e: Error) => {
        setSession(null)
        setMessage(e.message)
      })
  }, [])

  // La grille est chargée une seule fois : pas de requête pendant la vente.
  useEffect(() => {
    appel('catalogue:grille')
      .then(setGrille)
      .catch((e: Error) => setMessage(e.message))
  }, [])

  const agir = useCallback((action: ActionPanier) => dispatch({ type: 'panier', action }), [])

  const ajouter = useCallback(
    (article: ArticleCatalogue) => {
      setMessage(null)
      setDerniereVente(null)
      agir({ type: 'ajouter', article })
      setSurlignee((s) => ({ id: article.conditionnementId, n: (s?.n ?? 0) + 1 }))
    },
    [agir]
  )

  useEffect(() => {
    if (!surlignee) return
    const minuteur = setTimeout(() => setSurlignee(null), DUREE_SURLIGNAGE_MS)
    return () => clearTimeout(minuteur)
  }, [surlignee])

  // Les scans sont traités un par un, dans l'ordre d'arrivée : une rafale plus rapide que les
  // réponses du catalogue ne perd ni n'inverse aucun article. Une erreur n'arrête pas la file.
  // Pendant le paiement, la douchette est ignorée : le ticket ne doit plus bouger.
  useScanner(
    (code) => {
      fileScans.current = fileScans.current.then(async () => {
        try {
          const article = await appel('catalogue:rechercherCode', { code })
          if (article) ajouter(article)
          else setMessage(`Code ${code} inconnu. Créez le produit ou vérifiez le code.`)
        } catch (e) {
          setMessage((e as Error).message)
        }
      })
    },
    { actif: caisseOuverte && paiement === null }
  )

  // Raccourcis clavier (UI_UX § 3). Ignorés dans un champ de saisie et quand une fenêtre est
  // ouverte : elle gère ses propres touches.
  const etatCourant = useRef(etat)
  etatCourant.current = etat
  useEffect(() => {
    if (rechercheOuverte || paiement !== null || !caisseOuverte) return
    const surTouche = (e: KeyboardEvent): void => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return
      const action = actionClavier(e.key)
      if (!action) return
      e.preventDefault()
      const selection = etatCourant.current.courant.selection
      switch (action) {
        case 'rechercher':
          setRechercheOuverte(true)
          break
        case 'mettreEnAttente':
          dispatch({ type: 'mettreEnAttente', maintenant: Date.now() })
          break
        case 'fermer':
          agir({ type: 'selectionner', conditionnementId: null })
          break
        case 'supprimerLigne':
          if (selection !== null) agir({ type: 'supprimer', conditionnementId: selection })
          break
        case 'plus':
          if (selection !== null) agir({ type: 'incrementer', conditionnementId: selection })
          break
        case 'moins':
          if (selection !== null) agir({ type: 'decrementer', conditionnementId: selection })
          break
        case 'encaisser':
          if (etatCourant.current.courant.lignes.length > 0) setPaiement('especes')
          break
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [rechercheOuverte, paiement, caisseOuverte, agir])

  // La vente est enregistrée en base avant de vider le ticket ; un refus du service remonte dans
  // la fenêtre de paiement, qui reste ouverte avec sa saisie. Impression et tiroir : tâche A3.
  const encaisser = async (etatPaiement: EtatPaiement): Promise<void> => {
    const lignes = panier.lignes.map((l) => ({
      conditionnementId: l.article.conditionnementId,
      quantite: l.quantite
    }))
    const vente = await appel('caisse:enregistrerVente', versRequete(etatPaiement, lignes))
    agir({ type: 'vider' })
    setPaiement(null)
    setMessage(null)
    setDerniereVente(vente)
  }

  const total = totalPanier(panier)
  const selection = panier.selection !== null ? trouverLigne(panier, panier.selection) : undefined

  useEffect(() => {
    window.pos.envoyerPanierClient(versPanierClient(panier))
  }, [panier])

  // Garde la ligne touchée visible quand le ticket est long.
  useEffect(() => {
    ligneSelectionnee.current?.scrollIntoView({ block: 'nearest' })
  }, [panier.selection, surlignee])

  // Aucune vente sans session ouverte (règle 6.1).
  if (session === undefined) {
    return (
      <div className="caisse-fermee">
        <p className="vide">Vérification de la caisse…</p>
      </div>
    )
  }
  if (session === null) return <OuvertureCaisse nomCaissier={utilisateur.nom} onOuverte={setSession} />

  const peutEncaisser = panier.lignes.length > 0

  return (
    <div className="caisse">
      <section className="caisse-grille">
        <button className="caisse-recherche" onClick={() => setRechercheOuverte(true)}>
          Rechercher un produit par nom ou code PLU (F2)
        </button>
        {grille.length === 0 ? (
          <p className="vide">Aucun bouton tactile. Scannez un article ou recherchez-le avec F2.</p>
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

        {etat.attente.length > 0 && (
          <div className="attente-liste" aria-label="Tickets en attente">
            {etat.attente.map((t) => {
              const r = resumeAttente(t)
              return (
                <button
                  key={t.numero}
                  className="attente-ticket"
                  onClick={() => dispatch({ type: 'reprendre', numero: t.numero, maintenant: Date.now() })}
                >
                  <span>Reprendre le ticket {t.numero}</span>
                  <span className="vide">
                    {r.nbArticles} article{r.nbArticles > 1 ? 's' : ''} · depuis {r.heure}
                  </span>
                  <span className="montant">{formaterFCFA(r.total)}</span>
                </button>
              )
            })}
          </div>
        )}

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
                    agir({ type: 'selectionner', conditionnementId: estSelectionnee ? null : id })
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
              aria-label="Diminuer la quantité (−)"
              onClick={() =>
                agir({ type: 'decrementer', conditionnementId: selection.article.conditionnementId })
              }
            >
              −
            </button>
            <span className="montant ticket-actions-quantite">{selection.quantite}</span>
            <button
              className="btn btn-discret"
              aria-label="Augmenter la quantité (+)"
              onClick={() =>
                agir({ type: 'incrementer', conditionnementId: selection.article.conditionnementId })
              }
            >
              +
            </button>
            <button
              className="btn btn-discret ticket-actions-supprimer"
              onClick={() =>
                agir({ type: 'supprimer', conditionnementId: selection.article.conditionnementId })
              }
            >
              Supprimer la ligne (Suppr)
            </button>
          </div>
        )}

        {message && (
          <p className="alerte" role="alert">
            {message}
          </p>
        )}

        {derniereVente && (
          <>
            <p className="succes" role="status">
              Vente {derniereVente.numeroTicket} enregistrée.
              {derniereVente.monnaieRendue > 0 &&
                ` Monnaie à rendre : ${formaterFCFA(derniereVente.monnaieRendue)}.`}
            </p>
            {/* Stock négatif : jamais bloquant (D-A1 en attente), mais signalé. */}
            {derniereVente.alertesStock.map((a) => (
              <p key={a.produitId} className="bandeau">
                Stock insuffisant d’après le logiciel : {a.designation} ({formaterQuantite(a.stockApres)}).
                Prévenez le gérant pour vérifier le stock.
              </p>
            ))}
          </>
        )}

        <div className="ticket-total">
          <span>Total</span>
          <span className="montant">{formaterFCFA(total)}</span>
        </div>

        <div className="caisse-paiements">
          <button
            className="btn caisse-paiement-principal"
            disabled={!peutEncaisser}
            onClick={() => setPaiement('especes')}
          >
            Espèces (F4)
          </button>
          <button className="btn" disabled={!peutEncaisser} onClick={() => setPaiement('tmoney')}>
            TMoney
          </button>
          <button className="btn" disabled={!peutEncaisser} onClick={() => setPaiement('flooz')}>
            Flooz
          </button>
          {/* Vente à crédit : avec la fiche client (A11). */}
          <button className="btn" disabled>
            Crédit
          </button>
        </div>
        <div className="caisse-ticket-actions">
          <button
            className="btn btn-discret"
            disabled={panier.lignes.length === 0}
            onClick={() => dispatch({ type: 'mettreEnAttente', maintenant: Date.now() })}
          >
            Mettre en attente (F8)
          </button>
          <button
            className="btn btn-discret"
            disabled={panier.lignes.length === 0}
            onClick={() => agir({ type: 'vider' })}
          >
            Vider le ticket
          </button>
        </div>
      </section>

      {rechercheOuverte && (
        <FenetreRecherche
          onChoisir={(a) => {
            ajouter(a)
            setRechercheOuverte(false)
          }}
          onFermer={() => setRechercheOuverte(false)}
        />
      )}

      {paiement !== null && (
        <FenetrePaiement
          total={total}
          modeInitial={paiement}
          onEncaisser={encaisser}
          onFermer={() => setPaiement(null)}
        />
      )}
    </div>
  )
}
