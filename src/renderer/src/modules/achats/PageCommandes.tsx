/**
 * Commandes fournisseur (B8 partie 3, REGLES_METIER § 4.7, UI_UX § 5.18). Propriétaire : Dev B. Gérant.
 * La liste des commandes et leurs actions selon l'état : un brouillon se modifie, s'envoie (aperçu à
 * copier pour WhatsApp) ou s'annule ; une commande envoyée s'annule ; une commande reçue en partie se
 * clôture. Les réceptions se lient à une commande depuis l'écran Réceptions.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ArticleReception, Commande, ProduitEnAlerte, ResumeCommande } from '@shared/ipc/achats'
import type { Fournisseur } from '@shared/ipc/fournisseurs'
import type { ArticleCatalogue } from '@shared/types'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonExporter } from '@renderer/ui/BoutonExporter'
import { jourLocal } from '@renderer/lib/exportExcel'
import type { DemandeExport } from '@shared/ipc/exports'
import {
  LIBELLES_STATUT,
  PASTILLE_STATUT,
  ajouterArticleCommande,
  changerConditionnementCommande,
  commandeVide,
  depuisCommande,
  etatLigneCommande,
  manqueCommande,
  modifierLigneCommande,
  retirerLigneCommande,
  texteApercu,
  texteConversionCommande,
  texteReste,
  totalPrevuCommande,
  versSaisieCommande,
  type BrouillonCommande,
  type LigneCommandeSaisie
} from './saisieCommande'
import { texteUnitesBase } from './saisieReception'

type Fenetre =
  | { type: 'saisie'; brouillon: BrouillonCommande; retires: string[] }
  | { type: 'detail'; commande: Commande }
  | { type: 'envoyer'; commande: Commande }
  | { type: 'annuler'; commande: ResumeCommande }
  | { type: 'cloturer'; commande: ResumeCommande }
  | null

/** L'export reprend la liste affichée (REGLES_METIER § 11.2). */
function exportCommandes(commandes: ResumeCommande[]): DemandeExport {
  const jour = jourLocal()
  return {
    nomFichier: `Commandes_${jour}`,
    titre: `Commandes fournisseur au ${formaterDate(jour)}`,
    feuilles: [
      {
        nom: 'Commandes',
        colonnes: [
          { titre: 'Numéro', type: 'texte' },
          { titre: 'Date', type: 'date' },
          { titre: 'Fournisseur', type: 'texte' },
          { titre: 'Articles', type: 'nombre' },
          { titre: 'Total prévu', type: 'montant' },
          { titre: 'État', type: 'texte' },
          { titre: 'Saisie par', type: 'texte' }
        ],
        lignes: commandes.map((c) => [
          c.numero,
          c.dateCommande,
          c.fournisseur,
          c.nbLignes,
          c.totalPrevu || null,
          LIBELLES_STATUT[c.statut],
          c.utilisateur
        ])
      }
    ]
  }
}

export function PageCommandes(): React.JSX.Element {
  const [commandes, setCommandes] = useState<ResumeCommande[] | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [boutique, setBoutique] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('achats:listeCommandes')
      .then(setCommandes)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(() => {
    charger()
    appel('parametres:lire')
      .then((p) => setBoutique(p.boutiqueNom))
      .catch(() => undefined)
  }, [charger])

  const terminer = (message: string): void => {
    setFenetre(null)
    setSucces(message)
    setErreur(null)
    charger()
  }

  const lire = (id: number, suite: (c: Commande) => void): void => {
    appel('achats:commande', { id })
      .then(suite)
      .catch((e: Error) => setErreur(e.message))
  }

  // Un brouillon rouvert : on relit chaque article pour retrouver unité, prix proposé, conditionnements.
  const modifier = (id: number): void => {
    lire(id, (c) => {
      Promise.all(
        c.lignes.map((l) =>
          appel('achats:articleReception', { conditionnementId: l.conditionnementId }).then(
            (a) => [l.conditionnementId, a] as const
          )
        )
      )
        .then((paires) => {
          const { brouillon, retires } = depuisCommande(c, new Map(paires))
          setFenetre({ type: 'saisie', brouillon, retires })
        })
        .catch((e: Error) => setErreur(e.message))
    })
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Commandes fournisseur</h1>
        <div className="tableau-actions">
          <BoutonExporter
            demande={() => exportCommandes(commandes ?? [])}
            desactive={!commandes || commandes.length === 0}
          />
          <button
            className="btn"
            onClick={() => {
              setSucces(null)
              setFenetre({ type: 'saisie', brouillon: commandeVide(), retires: [] })
            }}
          >
            Nouvelle commande
          </button>
        </div>
      </header>
      {succes && (
        <p className="succes page-message" role="status">
          {succes}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {commandes === null ? null : commandes.length === 0 ? (
        <p className="vide">
          Aucune commande pour l’instant. Touchez « Nouvelle commande » : vous pourrez partir des produits en
          rupture ou en stock bas.
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date</th>
                <th>Fournisseur</th>
                <th className="nombre">Articles</th>
                <th className="nombre">Total prévu</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero}</td>
                  <td>
                    {formaterDate(c.dateCommande)}
                    <span className="detail">par {c.utilisateur}</span>
                  </td>
                  <td>{c.fournisseur}</td>
                  <td className="nombre">{c.nbLignes}</td>
                  <td className="nombre montant">{c.totalPrevu > 0 ? formaterFCFA(c.totalPrevu) : ''}</td>
                  <td>
                    <span className={PASTILLE_STATUT[c.statut]}>{LIBELLES_STATUT[c.statut]}</span>
                  </td>
                  <td>
                    <div className="tableau-actions">
                      <button
                        className="btn btn-secondaire"
                        onClick={() => lire(c.id, (commande) => setFenetre({ type: 'detail', commande }))}
                      >
                        Voir
                      </button>
                      {c.statut === 'brouillon' && (
                        <>
                          <button className="btn btn-secondaire" onClick={() => modifier(c.id)}>
                            Modifier
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              lire(c.id, (commande) => setFenetre({ type: 'envoyer', commande }))
                            }
                          >
                            Marquer comme envoyée
                          </button>
                        </>
                      )}
                      {(c.statut === 'brouillon' || c.statut === 'envoyee') && (
                        <button
                          className="btn btn-secondaire"
                          onClick={() => setFenetre({ type: 'annuler', commande: c })}
                        >
                          Annuler
                        </button>
                      )}
                      {c.statut === 'recue_partiel' && (
                        <button
                          className="btn btn-secondaire"
                          onClick={() => setFenetre({ type: 'cloturer', commande: c })}
                        >
                          Clôturer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fenetre?.type === 'saisie' && (
        <FenetreSaisieCommande
          initial={fenetre.brouillon}
          retires={fenetre.retires}
          onFermer={() => setFenetre(null)}
          onEnregistree={terminer}
        />
      )}
      {fenetre?.type === 'detail' && (
        <FenetreDetailCommande
          commande={fenetre.commande}
          boutique={boutique}
          onFermer={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'envoyer' && (
        <FenetreFormulaire
          titre={`Envoyer la commande ${fenetre.commande.numero}`}
          libelleValider="Marquer comme envoyée"
          valide
          large
          onFermer={() => setFenetre(null)}
          onValider={async () => {
            await appel('achats:envoyerCommande', { id: fenetre.commande.id })
            terminer(
              `Commande ${fenetre.commande.numero} envoyée. À la livraison, choisissez-la sur l’écran Réceptions.`
            )
          }}
        >
          <p className="formulaire-bloc">
            Copiez le texte ci-dessous et envoyez-le à {fenetre.commande.fournisseur} (WhatsApp, SMS), ou
            recopiez-le. Une fois envoyée, la commande ne se modifie plus.
          </p>
          <Apercu texte={texteApercu(fenetre.commande, boutique)} />
        </FenetreFormulaire>
      )}
      {fenetre?.type === 'annuler' && (
        <FenetreMotif
          titre={`Annuler la commande ${fenetre.commande.numero}`}
          libelleValider="Annuler la commande"
          explication={
            fenetre.commande.statut === 'envoyee'
              ? `Prévenez ${fenetre.commande.fournisseur} : la commande ne pourra plus être livrée ici. Elle garde son numéro.`
              : 'Le brouillon garde son numéro et reste visible dans la liste, à l’état « Annulée ».'
          }
          onFermer={() => setFenetre(null)}
          onValider={async (motif) => {
            await appel('achats:annulerCommande', { id: fenetre.commande.id, motif })
            terminer(`Commande ${fenetre.commande.numero} annulée.`)
          }}
        />
      )}
      {fenetre?.type === 'cloturer' && (
        <FenetreMotif
          titre={`Clôturer la commande ${fenetre.commande.numero}`}
          libelleValider="Clôturer la commande"
          explication="Le reste à recevoir ne viendra pas : la commande passe à « Reçue » et le reste non livré est noté au journal."
          onFermer={() => setFenetre(null)}
          onValider={async (motif) => {
            await appel('achats:cloturerCommande', { id: fenetre.commande.id, motif })
            terminer(`Commande ${fenetre.commande.numero} clôturée.`)
          }}
        />
      )}
    </div>
  )
}

// ─── Aperçu à copier ──────────────────────────────────────────────────────────

function Apercu(props: { texte: string }): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const copier = (): void => {
    navigator.clipboard
      .writeText(props.texte)
      .then(() => setMessage('Texte copié : collez-le dans WhatsApp ou un SMS.'))
      .catch(() => setMessage('Copie impossible : sélectionnez le texte au doigt ou à la souris.'))
  }
  return (
    <div className="formulaire-bloc">
      <pre className="apercu">{props.texte}</pre>
      <div className="tableau-actions">
        <button type="button" className="btn btn-secondaire" onClick={copier}>
          Copier le texte
        </button>
        {message && <span className="vide">{message}</span>}
      </div>
    </div>
  )
}

// ─── Motif d'annulation ou de clôture ─────────────────────────────────────────

function FenetreMotif(props: {
  titre: string
  libelleValider: string
  explication: string
  onFermer: () => void
  onValider: (motif: string) => Promise<void>
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  return (
    <FenetreFormulaire
      titre={props.titre}
      libelleValider={props.libelleValider}
      attention
      valide={motif.trim() !== ''}
      onFermer={props.onFermer}
      onValider={() => props.onValider(motif)}
    >
      <p className="formulaire-bloc">{props.explication}</p>
      <label className="champ">
        Motif
        <input
          placeholder="Ex. : le grossiste n’a plus ce produit"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}

// ─── Détail d'une commande ────────────────────────────────────────────────────

function FenetreDetailCommande(props: {
  commande: Commande
  boutique: string | null
  onFermer: () => void
}): React.JSX.Element {
  const c = props.commande
  const { onFermer } = props
  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])
  const suivi = c.statut !== 'brouillon' && c.statut !== 'annulee'

  return (
    <div className="voile">
      <section className="fenetre fenetre-formulaire fenetre-large" role="dialog" aria-modal="true">
        <div className="fenetre-entete">
          <h2>Commande {c.numero}</h2>
          <span className={PASTILLE_STATUT[c.statut]}>{LIBELLES_STATUT[c.statut]}</span>
        </div>
        <p className="vide">
          {c.fournisseur} · le {formaterDate(c.dateCommande)} par {c.utilisateur}
          {c.totalPrevu > 0 && ` · total prévu ${formaterFCFA(c.totalPrevu)}`}
          {c.commentaire && ` · ${c.commentaire}`}
        </p>
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Article</th>
                <th className="nombre">Commandé</th>
                <th className="nombre">Prix prévu</th>
                {suivi && <th className="nombre">Reçu</th>}
                {suivi && <th className="nombre">Reste à recevoir</th>}
              </tr>
            </thead>
            <tbody>
              {c.lignes.map((l) => (
                <tr key={l.produitId}>
                  <td>
                    {l.produit} — {l.conditionnement}
                    {l.quantiteCond !== 1 && (
                      <span className="detail">= {texteUnitesBase(l.unite, l.commandeBase)}</span>
                    )}
                  </td>
                  <td className="nombre">{formaterQuantite(l.quantite)}</td>
                  <td className="nombre montant">{l.prix !== null ? formaterFCFA(l.prix) : ''}</td>
                  {suivi && <td className="nombre">{texteUnitesBase(l.unite, l.recuBase)}</td>}
                  {suivi && <td className="nombre">{texteReste(l)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.receptions.length > 0 && (
          <p className="vide">
            Livrée par :{' '}
            {c.receptions
              .map((r) => `${r.numero} du ${formaterDate(r.dateReception)} (${formaterFCFA(r.total)})`)
              .join(' · ')}
          </p>
        )}
        <Apercu texte={texteApercu(c, props.boutique)} />
        <div className="formulaire-actions">
          <button className="btn btn-secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── Saisie d'une commande (création ou brouillon) ────────────────────────────

function FenetreSaisieCommande(props: {
  initial: BrouillonCommande
  retires: string[]
  onFermer: () => void
  onEnregistree: (message: string) => void
}): React.JSX.Element {
  const [b, setB] = useState<BrouillonCommande>(props.initial)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [options, setOptions] = useState<Record<number, ArticleCatalogue[]>>({})
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<ArticleCatalogue[]>([])
  const [alertes, setAlertes] = useState<ProduitEnAlerte[] | null>(null)
  const [coches, setCoches] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<string | null>(
    props.retires.length > 0
      ? `Retiré${props.retires.length > 1 ? 's' : ''} de la commande car désactivé${props.retires.length > 1 ? 's' : ''} : ${props.retires.join(', ')}.`
      : null
  )

  useEffect(() => {
    appel('fournisseurs:liste')
      .then((liste) => setFournisseurs(liste.filter((f) => f.actif)))
      .catch((e: Error) => setMessage(e.message))
  }, [])

  // Conditionnements proposés pour chaque produit de la commande (carton, lot, unité).
  const aCharger = [...new Set(b.lignes.map((l) => l.article.produitId))].filter((id) => !(id in options))
  const cleACharger = aCharger.join(',')
  useEffect(() => {
    if (!cleACharger) return
    for (const produitId of cleACharger.split(',').map(Number)) {
      appel('catalogue:conditionnementsProduit', { produitId })
        .then((liste) => setOptions((o) => ({ ...o, [produitId]: liste })))
        .catch(() => undefined)
    }
  }, [cleACharger])

  // Lu au retour des appels : l'état peut avoir changé entre-temps (deux scans rapprochés).
  const refB = useRef(b)
  refB.current = b
  const ajouterArticles = (articles: (ArticleReception | null)[]): void => {
    let y = refB.current
    const deja: string[] = []
    for (const a of articles) {
      if (!a) continue
      const r = ajouterArticleCommande(y, a)
      y = r.brouillon
      if (r.dejaPresent) deja.push(r.dejaPresent)
    }
    refB.current = y
    setB(y)
    setMessage(deja.length > 0 ? `Déjà dans la commande : ${deja.join(', ')}. Modifiez sa ligne.` : null)
  }
  const ajouter = (conditionnementId: number): void => {
    appel('achats:articleReception', { conditionnementId })
      .then((a) =>
        a ? ajouterArticles([a]) : setMessage('Cet article n’est plus en vente : choisissez-en un autre.')
      )
      .catch((e: Error) => setMessage(e.message))
  }

  // La douchette passe par le lecteur ET par la touche Entrée du champ : on ignore le second passage.
  const dernierCode = useRef({ code: '', instant: 0 })
  const traiterCode = (code: string): void => {
    const maintenant = Date.now()
    if (dernierCode.current.code === code && maintenant - dernierCode.current.instant < 500) return
    dernierCode.current = { code, instant: maintenant }
    setRecherche('')
    setResultats([])
    appel('catalogue:rechercherCode', { code })
      .then((a) =>
        a
          ? ajouter(a.conditionnementId)
          : setMessage(`Code ${code} inconnu : créez d’abord le produit sur l’écran Produits.`)
      )
      .catch((e: Error) => setMessage(e.message))
  }
  useScanner(traiterCode)

  useEffect(() => {
    const t = recherche.trim()
    if (t.length < 2 || /^\d+$/.test(t)) {
      setResultats([])
      return
    }
    let annule = false
    appel('catalogue:rechercher', { texte: t })
      .then((r) => !annule && setResultats(r))
      .catch(() => undefined)
    return () => {
      annule = true
    }
  }, [recherche])

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault() // Entrée ne doit pas enregistrer la commande.
    const t = recherche.trim()
    if (/^\d+$/.test(t)) traiterCode(t)
    else if (resultats.length > 0) choisir(resultats[0])
  }
  const choisir = (a: ArticleCatalogue): void => {
    setRecherche('')
    setResultats([])
    ajouter(a.conditionnementId)
  }

  const ouvrirAlertes = (): void => {
    appel('achats:produitsEnAlerte')
      .then((liste) => {
        setAlertes(liste)
        setCoches(new Set())
      })
      .catch((e: Error) => setMessage(e.message))
  }
  const ajouterCoches = (): void => {
    const choisis = (alertes ?? []).filter((a) => coches.has(a.produitId))
    Promise.all(
      choisis.map((a) => appel('achats:articleReception', { conditionnementId: a.conditionnementId }))
    )
      .then((articles) => {
        ajouterArticles(articles)
        setAlertes(null)
      })
      .catch((e: Error) => setMessage(e.message))
  }

  const changerConditionnement = (l: LigneCommandeSaisie, conditionnementId: number): void => {
    appel('achats:articleReception', { conditionnementId })
      .then((a) => a && setB((x) => changerConditionnementCommande(x, l.cle, a)))
      .catch((e: Error) => setMessage(e.message))
  }

  const aCorriger = manqueCommande(b)
  const total = totalPrevuCommande(b)
  const presents = new Set(b.lignes.map((l) => l.article.produitId))
  const bloquerEntree = (ev: React.KeyboardEvent): void => {
    if (ev.key === 'Enter') ev.preventDefault()
  }

  return (
    <FenetreFormulaire
      titre={b.numero ? `Commande ${b.numero}` : 'Nouvelle commande'}
      pastille={<span className="pastille pastille-alerte">Brouillon</span>}
      libelleValider={b.id ? 'Enregistrer les modifications' : 'Enregistrer la commande'}
      valide={aCorriger === null}
      large
      onFermer={props.onFermer}
      onValider={async () => {
        const saisie = versSaisieCommande(b)
        if (b.id) {
          await appel('achats:modifierCommande', { id: b.id, ...saisie })
          props.onEnregistree(`Commande ${b.numero} enregistrée.`)
        } else {
          const r = await appel('achats:creerCommande', saisie)
          props.onEnregistree(
            `Commande ${r.numero} enregistrée en brouillon. Touchez « Marquer comme envoyée » pour copier le texte à envoyer au fournisseur.`
          )
        }
      }}
    >
      <div className="filtres">
        <label className="champ">
          Fournisseur
          <select
            value={b.fournisseurId ?? ''}
            onChange={(e) => setB({ ...b, fournisseurId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Choisissez le fournisseur</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="champ champ-large">
          Ajouter un article
          <input
            data-scan
            placeholder="Scannez ou tapez un nom"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={surToucheRecherche}
          />
        </label>
        <button type="button" className="btn btn-secondaire" onClick={ouvrirAlertes}>
          Proposer depuis les alertes
        </button>
      </div>

      {resultats.length > 0 && (
        <div className="tableau-cadre">
          <ul className="recherche-resultats">
            {resultats.map((a) => (
              <li key={a.conditionnementId}>
                <button type="button" className="recherche-resultat" onClick={() => choisir(a)}>
                  <span>{a.designation}</span>
                  <span className="vide">{a.codeBarres ?? a.codePlu ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <p className="alerte" role="alert">
          {message}
        </p>
      )}

      {alertes !== null && (
        <div className="formulaire-bloc">
          {alertes.length === 0 ? (
            <p className="vide">Aucun produit en rupture ni en stock bas.</p>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Produit en alerte</th>
                    <th className="nombre">Stock</th>
                    <th className="nombre">Seuil</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {alertes.map((a) => (
                    <tr key={a.produitId}>
                      <td>
                        {a.produit}{' '}
                        <span
                          className={
                            a.niveau === 'rupture' ? 'pastille pastille-erreur' : 'pastille pastille-alerte'
                          }
                        >
                          {a.niveau === 'rupture' ? 'Rupture' : 'Stock bas'}
                        </span>
                      </td>
                      <td className="nombre">{texteUnitesBase(a.unite, a.stock)}</td>
                      <td className="nombre">{formaterQuantite(a.seuil)}</td>
                      <td>
                        {presents.has(a.produitId) ? (
                          <span className="vide">Déjà commandé</span>
                        ) : (
                          <label className="case case-cellule">
                            <input
                              type="checkbox"
                              checked={coches.has(a.produitId)}
                              onChange={(e) => {
                                const s = new Set(coches)
                                if (e.target.checked) s.add(a.produitId)
                                else s.delete(a.produitId)
                                setCoches(s)
                              }}
                            />
                            À commander
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="tableau-actions">
            <button type="button" className="btn" disabled={coches.size === 0} onClick={ajouterCoches}>
              Ajouter les produits cochés
            </button>
            <button type="button" className="btn btn-secondaire" onClick={() => setAlertes(null)}>
              Masquer les alertes
            </button>
          </div>
        </div>
      )}

      {b.lignes.length === 0 ? (
        <p className="vide">
          Scannez ou cherchez les articles à commander, ou partez des produits en alerte. La quantité se
          saisit dans le conditionnement commandé (3 cartons).
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau tableau-saisie">
            <thead>
              <tr>
                <th>Article</th>
                <th className="nombre">Qté commandée</th>
                <th className="nombre">Prix prévu</th>
                <th className="nombre">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {b.lignes.map((l) => {
                const e = etatLigneCommande(l)
                const conversion = texteConversionCommande(l)
                const opts = options[l.article.produitId] ?? []
                const entame = l.quantite !== ''
                return (
                  <tr key={l.cle}>
                    <td>
                      <strong>{l.article.produit}</strong>
                      <div className="champ-avec-action">
                        <select
                          aria-label="Conditionnement commandé"
                          value={l.article.conditionnementId}
                          onChange={(ev) => changerConditionnement(l, Number(ev.target.value))}
                        >
                          {opts.length === 0 && (
                            <option value={l.article.conditionnementId}>{l.article.conditionnement}</option>
                          )}
                          {opts.map((o) => (
                            <option key={o.conditionnementId} value={o.conditionnementId}>
                              {o.conditionnement}
                              {o.quantiteBase !== 1 ? ` (×${formaterQuantite(o.quantiteBase)})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      {conversion && <span className="detail">⇄ {conversion}</span>}
                      {e.erreur && entame && <span className="detail">À compléter : {e.erreur}</span>}
                    </td>
                    <td className="nombre">
                      <input
                        className="nombre champ-quantite"
                        inputMode="decimal"
                        aria-label="Quantité commandée"
                        value={l.quantite}
                        onKeyDown={bloquerEntree}
                        onChange={(ev) =>
                          setB((x) => modifierLigneCommande(x, l.cle, { quantite: ev.target.value }))
                        }
                      />
                    </td>
                    <td className="nombre">
                      <input
                        className="nombre"
                        inputMode="numeric"
                        aria-label="Prix prévu"
                        placeholder="facultatif"
                        value={l.prix}
                        onKeyDown={bloquerEntree}
                        onChange={(ev) =>
                          setB((x) => modifierLigneCommande(x, l.cle, { prix: ev.target.value }))
                        }
                      />
                    </td>
                    <td className="nombre montant">{e.total !== null ? formaterFCFA(e.total) : ''}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondaire"
                        onClick={() => setB((x) => retirerLigneCommande(x, l.cle))}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <label className="champ champ-large">
        Commentaire (facultatif)
        <input
          placeholder="Ex. : livrer avant samedi"
          value={b.commentaire}
          onKeyDown={bloquerEntree}
          onChange={(e) => setB({ ...b, commentaire: e.target.value })}
        />
      </label>
      <p className="vide">
        {b.lignes.length} ligne{b.lignes.length > 1 ? 's' : ''}
        {total > 0 && (
          <>
            {' '}
            · total prévu <strong className="montant">{formaterFCFA(total)}</strong>
          </>
        )}
        {aCorriger && ` · ${aCorriger}`}
      </p>
    </FenetreFormulaire>
  )
}
