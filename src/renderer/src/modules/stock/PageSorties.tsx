/**
 * Sorties de stock et retours fournisseur (B11, REGLES_METIER § 8, UI_UX § 5.9). Propriétaire : Dev B.
 * Gérant. On scanne ou cherche l'article, on dit combien sort et pourquoi ; « Créer un retour
 * fournisseur » attend un avoir, suivi dans la fenêtre « Dettes » du fournisseur. Les sorties des
 * 30 derniers jours s'affichent dessous, annulables par contre-passation.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FicheSortie, SortieStock } from '@shared/ipc/stock'
import type { Fournisseur } from '@shared/ipc/fournisseurs'
import type { ArticleCatalogue } from '@shared/types'
import { LIBELLES_MOUVEMENT, MOTIFS_SORTIE, type MotifSortie } from '@shared/stock'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { lireNombre } from '../achats/saisieReception'
import {
  SANS_LOT,
  STATUTS_AVOIR,
  avoirCalcule,
  champsInitiaux,
  changerLot,
  disponible,
  manqueSortie,
  versSaisieSortie,
  type ChampsSortie
} from './saisieSortie'

type Action = { type: 'sortir'; fiche: FicheSortie } | { type: 'annuler'; sortie: SortieStock } | null

export function PageSorties(): React.JSX.Element {
  const [sorties, setSorties] = useState<SortieStock[] | null>(null)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<ArticleCatalogue[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('stock:sorties', {})
      .then(setSorties)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])
  useEffect(() => {
    appel('fournisseurs:liste')
      .then((l) => setFournisseurs(l.filter((f) => f.actif)))
      .catch(() => undefined)
  }, [])

  const ouvrir = (produitId: number): void => {
    setErreur(null)
    setSucces(null)
    setRecherche('')
    setResultats([])
    appel('stock:ficheSortie', { produitId })
      .then((fiche) => setAction({ type: 'sortir', fiche }))
      .catch((e: Error) => setErreur(e.message))
  }

  const traiterCode = (code: string): void => {
    appel('catalogue:rechercherCode', { code })
      .then((article) => {
        if (article) ouvrir(article.produitId)
        else {
          setRecherche('')
          setErreur(`Code ${code} inconnu : vérifiez l’article ou cherchez-le par son nom.`)
        }
      })
      .catch((e: Error) => setErreur(e.message))
  }
  useScanner(traiterCode, { actif: action === null })

  // Recherche par nom : un produit par ligne, même s'il a plusieurs conditionnements.
  useEffect(() => {
    const t = recherche.trim()
    if (t.length < 2 || /^\d+$/.test(t)) {
      setResultats([])
      return
    }
    let annule = false
    appel('catalogue:rechercher', { texte: t })
      .then((r) => {
        if (annule) return
        setResultats(r.filter((a, i) => r.findIndex((b) => b.produitId === a.produitId) === i))
      })
      .catch(() => undefined)
    return () => {
      annule = true
    }
  }, [recherche])

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = recherche.trim()
    if (/^\d+$/.test(t)) traiterCode(t)
    else if (resultats.length > 0) ouvrir(resultats[0].produitId)
  }

  const apres = (message: string): void => {
    setAction(null)
    setSucces(message)
    setErreur(null)
    charger()
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Sorties de stock</h1>
      </header>

      <div className="filtres">
        <label className="champ champ-large">
          Article qui sort du stock
          <input
            data-scan
            placeholder="Scannez ou tapez un nom"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={surToucheRecherche}
          />
        </label>
      </div>

      {resultats.length > 0 && (
        <div className="tableau-cadre page-message">
          <ul className="recherche-resultats">
            {resultats.map((a) => (
              <li key={a.produitId}>
                <button className="recherche-resultat" onClick={() => ouvrir(a.produitId)}>
                  <span>{a.designation}</span>
                  <span className="vide">{a.codeBarres ?? a.codePlu ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {action?.type === 'sortir' && (
        <FenetreSortie
          key={action.fiche.produitId}
          fiche={action.fiche}
          fournisseurs={fournisseurs}
          onFermer={() => setAction(null)}
          onEnregistre={apres}
        />
      )}
      {action?.type === 'annuler' && (
        <FenetreAnnulation sortie={action.sortie} onFermer={() => setAction(null)} onAnnule={apres} />
      )}

      <h2 className="page-message">Sorties des 30 derniers jours</h2>
      {sorties === null ? null : sorties.length === 0 ? (
        <p className="vide">
          Aucune sortie de stock ces 30 derniers jours. Scannez un article pour en enregistrer une.
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit · lot</th>
                <th>Motif</th>
                <th className="nombre">Quantité</th>
                <th className="nombre">Valeur</th>
                <th>Retour</th>
                <th>Par</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorties.map((s) => (
                <tr key={s.mouvementId} className={s.motifAnnulation !== null ? 'inactif' : undefined}>
                  <td>
                    {formaterDate(s.horodatage)}
                    <span className="detail">{s.horodatage.slice(11, 16)}</span>
                  </td>
                  <td>
                    {s.produit}
                    {s.lot && <span className="detail">Lot {s.lot}</span>}
                  </td>
                  <td>
                    {s.motif ?? LIBELLES_MOUVEMENT[s.type]}
                    {s.type === 'retour_fournisseur' && <span className="detail">Retour fournisseur</span>}
                  </td>
                  <td className="nombre">{formaterQuantite(s.quantite)}</td>
                  <td className="nombre montant">{formaterFCFA(s.valeur)}</td>
                  <td>
                    {s.retour && (
                      <>
                        <span className={`pastille ${STATUTS_AVOIR[s.retour.statut].classe}`}>
                          {STATUTS_AVOIR[s.retour.statut].texte}
                        </span>
                        <span className="detail">
                          {s.retour.fournisseur} · {formaterFCFA(s.retour.montantAttendu)}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{s.utilisateur}</td>
                  <td>
                    {s.motifAnnulation !== null ? (
                      <>
                        <span className="pastille pastille-inactif">Annulée</span>
                        <span className="detail">{s.motifAnnulation}</span>
                      </>
                    ) : (
                      (!s.retour || s.retour.statut === 'attendu') && (
                        <button
                          type="button"
                          className="btn btn-attention"
                          onClick={() => {
                            setSucces(null)
                            setAction({ type: 'annuler', sortie: s })
                          }}
                        >
                          Annuler
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FenetreSortie(props: {
  fiche: FicheSortie
  fournisseurs: Fournisseur[]
  onEnregistre: (message: string) => void
  onFermer: () => void
}): React.JSX.Element {
  const { fiche } = props
  const [c, setC] = useState<ChampsSortie>(() => champsInitiaux(fiche))
  const modifier = (m: Partial<ChampsSortie>): void => setC((x) => ({ ...x, ...m }))

  const manque = manqueSortie(fiche, c)
  const q = lireNombre(c.quantite)
  const retourPossible = MOTIFS_SORTIE[c.motif].retourPossible
  const calcule = avoirCalcule(fiche, c)
  const fournisseur = props.fournisseurs.find((f) => String(f.id) === c.fournisseur)
  // Ceux qui ont livré ce produit d'abord (avec leur dernier coût), puis les autres actifs.
  const autres = props.fournisseurs.filter(
    (f) => !fiche.prixFournisseurs.some((p) => p.fournisseurId === f.id)
  )

  const valider = async (): Promise<void> => {
    const saisie = versSaisieSortie(fiche, c)
    const r = await appel('stock:enregistrerSortie', saisie)
    const quoi = `« ${fiche.nom} » : ${formaterQuantite(saisie.quantite)} sorti du stock (${MOTIFS_SORTIE[c.motif].libelle.toLowerCase()})`
    props.onEnregistre(
      r.retourId !== null
        ? `${quoi}. Avoir attendu de ${formaterFCFA(r.montantAttendu ?? 0)} auprès de « ${fournisseur?.nom ?? ''} » : notez-le reçu dans ses dettes.`
        : `${quoi}.`
    )
  }

  return (
    <FenetreFormulaire
      titre={`Sortie de stock — ${fiche.nom}`}
      pastille={<span className="pastille pastille-ok">Stock : {formaterQuantite(fiche.stock)}</span>}
      libelleValider="Valider la sortie"
      valide={manque === null}
      onValider={valider}
      onFermer={props.onFermer}
    >
      {fiche.lots.length > 0 && (
        <label className="champ champ-large">
          Lot
          <select value={c.lot} onChange={(e) => setC(changerLot(fiche, c, e.target.value))}>
            {fiche.lots.map((l) => (
              <option key={l.lotId} value={String(l.lotId)}>
                {l.numeroLot ? `Lot ${l.numeroLot}` : 'Lot sans numéro'}
                {l.datePeremption ? ` · périme le ${formaterDate(l.datePeremption)}` : ''} · reste{' '}
                {formaterQuantite(l.restant)}
              </option>
            ))}
            <option value={SANS_LOT}>Sans lot</option>
          </select>
        </label>
      )}
      <label className="champ">
        Quantité (en {fiche.unite === 'piece' ? 'unités' : fiche.unite})
        <input
          inputMode="decimal"
          className="nombre"
          value={c.quantite}
          onChange={(e) => modifier({ quantite: e.target.value, avoir: '' })}
        />
        <span className="champ-aide">Au plus {formaterQuantite(disponible(fiche, c))}.</span>
      </label>
      <label className="champ">
        Motif
        <select value={c.motif} onChange={(e) => modifier({ motif: e.target.value as MotifSortie })}>
          {(Object.keys(MOTIFS_SORTIE) as MotifSortie[]).map((m) => (
            <option key={m} value={m}>
              {MOTIFS_SORTIE[m].libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="champ champ-large">
        Commentaire (facultatif)
        <input
          placeholder="Ex. : boîtes bombées"
          value={c.commentaire}
          onChange={(e) => modifier({ commentaire: e.target.value })}
        />
      </label>

      {retourPossible && (
        <label className="case">
          <input
            type="checkbox"
            checked={c.retour}
            onChange={(e) => modifier({ retour: e.target.checked })}
          />
          Créer un retour fournisseur (un avoir est attendu)
        </label>
      )}
      {retourPossible && c.retour && (
        <>
          <label className="champ">
            Fournisseur
            <select
              value={c.fournisseur}
              onChange={(e) => modifier({ fournisseur: e.target.value, avoir: '' })}
            >
              <option value="">Choisissez le fournisseur</option>
              {fiche.prixFournisseurs.map((p) => (
                <option key={p.fournisseurId} value={String(p.fournisseurId)}>
                  {p.fournisseur} · dernier prix {formaterFCFA(p.coutUnitaire)} l’unité
                </option>
              ))}
              {autres.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            Avoir attendu (F)
            <input
              inputMode="numeric"
              placeholder={calcule !== null ? String(calcule) : ''}
              value={c.avoir === '' && calcule !== null ? String(calcule) : c.avoir}
              onChange={(e) => modifier({ avoir: e.target.value })}
            />
            <span className="champ-aide">Quantité × prix payé à ce fournisseur ; corrigez si besoin.</span>
          </label>
        </>
      )}

      <p className="vide formulaire-bloc">
        {manque ??
          `Mouvement −${formaterQuantite(q ?? 0)} tracé : qui, quand, pourquoi. Perte au coût moyen : ${formaterFCFA(
            Math.round((q ?? 0) * fiche.cump)
          )}.`}
      </p>
    </FenetreFormulaire>
  )
}

function FenetreAnnulation(props: {
  sortie: SortieStock
  onAnnule: (message: string) => void
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const s = props.sortie
  return (
    <FenetreFormulaire
      titre="Annuler une sortie de stock"
      libelleValider="Annuler la sortie"
      attention
      valide={motif.trim() !== ''}
      onValider={async () => {
        await appel('stock:annulerSortie', { mouvementId: s.mouvementId, motif })
        props.onAnnule(`Sortie de « ${s.produit} » annulée : ${formaterQuantite(s.quantite)} remis en stock.`)
      }}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        {formaterQuantite(s.quantite)} × « {s.produit} » du {formaterDate(s.horodatage)} ({s.motif}). La
        quantité revient en stock par un mouvement d’annulation ; la sortie reste visible.
        {s.retour && ` L’avoir attendu de « ${s.retour.fournisseur} » sera annulé.`}
      </p>
      <label className="champ champ-large">
        Motif
        <input
          placeholder="Ex. : erreur d’article"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}
