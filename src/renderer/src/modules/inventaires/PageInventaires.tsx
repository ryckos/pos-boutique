/**
 * Inventaires (B12, REGLES_METIER § 9, UI_UX § 5.11). Propriétaire : Dev B.
 * Gérant. Un seul inventaire en cours : on compte produit par produit (chaque comptage s'enregistre
 * aussitôt), puis on valide, ce qui ajuste le stock et chiffre la démarque.
 */
import { useCallback, useEffect, useState } from 'react'
import type {
  InventaireDetail,
  ProduitInventaire,
  RapportDemarque,
  ResumeInventaire
} from '@shared/ipc/inventaires'
import type { Categorie } from '@shared/ipc/catalogue'
import { LIBELLES_MOTIF_ECART, LIBELLES_STATUT_INVENTAIRE, type MotifEcart } from '@shared/inventaires'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { totalComptage } from '../stock/saisieStockInitial'
import {
  champsDepuisProduit,
  ecartNul,
  ecartPrevu,
  estimation,
  filtrer,
  manque,
  versSaisie,
  type FiltreInventaire
} from './saisieInventaire'

type Action =
  | { type: 'ouvrir' }
  | { type: 'compter'; produit: ProduitInventaire }
  | { type: 'valider' }
  | { type: 'annuler' }
  | { type: 'rapport'; numero: string; rapport: RapportDemarque }
  | { type: 'detail'; inventaire: InventaireDetail }
  | null

const CLASSES_STATUT: Record<ResumeInventaire['statut'], string> = {
  en_cours: 'pastille-alerte',
  valide: 'pastille-ok',
  annule: 'pastille-inactif'
}

const uniteDe = (unite: string, q: number): string =>
  unite === 'piece' ? `unité${Math.abs(q) > 1 ? 's' : ''}` : unite

/** « −2 unités », « +1,5 kg », « 0 ». */
function texteEcart(ecart: number, unite: string): string {
  if (ecartNul(ecart)) return '0'
  return `${ecart > 0 ? '+' : '−'}${formaterQuantite(Math.abs(ecart))} ${uniteDe(unite, ecart)}`
}

function PastilleEcart(props: { ecart: number; unite: string }): React.JSX.Element {
  const nul = ecartNul(props.ecart)
  return (
    <span className={`pastille ${nul ? 'pastille-ok' : 'pastille-erreur'}`}>
      {nul ? 'Juste' : `Écart ${texteEcart(props.ecart, props.unite)}`}
    </span>
  )
}

export function PageInventaires(): React.JSX.Element {
  const [enCours, setEnCours] = useState<InventaireDetail | null | undefined>(undefined)
  const [liste, setListe] = useState<ResumeInventaire[]>([])
  const [filtre, setFiltre] = useState<FiltreInventaire>('a_compter')
  const [recherche, setRecherche] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    Promise.all([appel('inventaires:enCours'), appel('inventaires:liste')])
      .then(([e, l]) => {
        setEnCours(e)
        setListe(l)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  const fermer = (): void => setAction(null)
  const apres = (message: string | null, suite: Action = null): void => {
    setAction(suite)
    setSucces(message)
    setErreur(null)
    charger()
  }

  const ouvrirComptage = (produitId: number, code?: string): void => {
    setErreur(null)
    setSucces(null)
    const p = enCours?.produits.find((x) => x.produitId === produitId)
    if (p) setAction({ type: 'compter', produit: p })
    else {
      setErreur(
        `${code ? `Le code ${code}` : 'Ce produit'} n’est pas dans cet inventaire${
          enCours?.rayon ? ` (rayon ${enCours.rayon})` : ''
        }, ou il est désactivé.`
      )
    }
  }

  // Un scan (ou un code tapé puis Entrée) ouvre directement le comptage du produit.
  const traiterCode = (code: string): void => {
    setRecherche('')
    appel('catalogue:rechercherCode', { code })
      .then((article) => {
        if (article) ouvrirComptage(article.produitId, code)
        else setErreur(`Code ${code} inconnu : ce produit n’est pas au catalogue.`)
      })
      .catch((e: Error) => setErreur(e.message))
  }
  useScanner(traiterCode, { actif: action === null && !!enCours })

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const code = recherche.trim()
    if (e.key === 'Enter' && /^\d+$/.test(code)) {
      e.preventDefault()
      traiterCode(code)
    }
  }

  const voirDetail = (id: number): void => {
    setErreur(null)
    appel('inventaires:detail', { id })
      .then((inventaire) => setAction({ type: 'detail', inventaire }))
      .catch((e: Error) => setErreur(e.message))
  }

  const precedents = liste.filter((i) => i.statut !== 'en_cours')
  const est = enCours ? estimation(enCours.produits) : null
  const visibles = enCours ? filtrer(enCours.produits, filtre, recherche) : []

  return (
    <div className="page">
      <header className="page-entete">
        <h1>
          Inventaires
          {enCours && ` — ${enCours.numero}`}
        </h1>
        {enCours ? (
          <div className="tableau-actions">
            <span className="pastille pastille-alerte">En cours</span>
            <span className="pastille">{enCours.rayon ?? 'Tout le magasin'}</span>
            <button className="btn btn-attention" onClick={() => setAction({ type: 'annuler' })}>
              Annuler l’inventaire
            </button>
            <button
              className="btn"
              disabled={enCours.nbComptes === 0}
              onClick={() => {
                setSucces(null)
                setAction({ type: 'valider' })
              }}
            >
              Valider l’inventaire
            </button>
          </div>
        ) : (
          enCours === null && (
            <button
              className="btn"
              onClick={() => {
                setSucces(null)
                setAction({ type: 'ouvrir' })
              }}
            >
              Ouvrir un inventaire
            </button>
          )
        )}
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

      {action?.type === 'ouvrir' && (
        <FenetreOuverture
          onFermer={fermer}
          onOuvert={(inv) =>
            apres(
              `Inventaire ${inv.numero} ouvert : comptez les produits un par un, chacun est enregistré aussitôt.`
            )
          }
        />
      )}
      {action?.type === 'compter' && enCours && (
        <FenetreComptage
          key={action.produit.produitId}
          inventaireId={enCours.id}
          produit={action.produit}
          onFermer={fermer}
          onEnregistre={(message) => apres(message)}
        />
      )}
      {action?.type === 'valider' && enCours && est && (
        <FenetreValidation
          inventaire={enCours}
          estimation={est}
          onFermer={fermer}
          onValide={(rapport) =>
            apres(`Inventaire ${enCours.numero} validé : le stock est ajusté.`, {
              type: 'rapport',
              numero: enCours.numero,
              rapport
            })
          }
        />
      )}
      {action?.type === 'annuler' && enCours && (
        <FenetreAnnulation
          inventaire={enCours}
          onFermer={fermer}
          onValider={async (motif) => {
            await appel('inventaires:annuler', { id: enCours.id, motif })
            apres(`Inventaire ${enCours.numero} annulé : le stock n’a pas bougé.`)
          }}
        />
      )}
      {action?.type === 'rapport' && (
        <FenetreRapport
          titre={`Démarque — inventaire ${action.numero}`}
          rapport={action.rapport}
          onFermer={fermer}
        />
      )}
      {action?.type === 'detail' && <FenetreDetail inventaire={action.inventaire} onFermer={fermer} />}

      {enCours && est && (
        <>
          <p className="vide page-message">
            {est.nbComptes} produit{est.nbComptes > 1 ? 's' : ''} compté{est.nbComptes > 1 ? 's' : ''} sur{' '}
            {enCours.produits.length}, {est.nbEcarts} écart{est.nbEcarts > 1 ? 's' : ''}
            {est.manquants > 0 && (
              <>
                {' '}
                · manquants estimés <span className="montant">{formaterFCFA(est.manquants)}</span>
              </>
            )}
            {est.surplus > 0 && (
              <>
                {' '}
                · surplus <span className="montant">{formaterFCFA(est.surplus)}</span>
              </>
            )}
            . Scannez un article ou touchez « Compter ».
          </p>
          <div className="filtres">
            <label className="champ champ-large">
              Rechercher
              <input
                placeholder="Nom du produit, ou code puis Entrée"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={surToucheRecherche}
              />
            </label>
            <label className="champ">
              Afficher
              <select value={filtre} onChange={(e) => setFiltre(e.target.value as FiltreInventaire)}>
                <option value="a_compter">À compter</option>
                <option value="comptes">Déjà comptés</option>
                <option value="ecarts">Avec un écart</option>
                <option value="tous">Tous les produits</option>
              </select>
            </label>
          </div>
          {visibles.length === 0 ? (
            <p className="vide">
              {filtre === 'a_compter' && est.nbComptes === enCours.produits.length
                ? 'Tout est compté : vous pouvez valider l’inventaire.'
                : 'Aucun produit ne correspond à ces filtres.'}
            </p>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Rayon</th>
                    <th className="nombre">Théorique</th>
                    <th className="nombre">Compté</th>
                    <th>Écart</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr key={p.produitId}>
                      <td>
                        {p.nom}
                        {p.ligne && p.ligne.detail.length > 0 && (
                          <span className="detail">
                            {p.ligne.detail
                              .map((d) => `${formaterQuantite(d.nombre)} ${d.conditionnement}`)
                              .join(' + ')}
                          </span>
                        )}
                      </td>
                      <td>{p.rayon ?? 'Non classé'}</td>
                      <td className="nombre">
                        {formaterQuantite(p.ligne ? p.ligne.quantiteTheorique : p.stock)}
                      </td>
                      <td className="nombre">{p.ligne ? formaterQuantite(p.ligne.quantiteComptee) : ''}</td>
                      <td>
                        {p.ligne && <PastilleEcart ecart={p.ligne.ecart} unite={p.unite} />}
                        {p.ligne?.motif && (
                          <span className="detail">{LIBELLES_MOTIF_ECART[p.ligne.motif]}</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={p.ligne ? 'btn btn-secondaire' : 'btn'}
                          onClick={() => ouvrirComptage(p.produitId)}
                        >
                          {p.ligne ? 'Recompter' : 'Compter'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {enCours === null && precedents.length === 0 && (
        <p className="vide">
          Aucun inventaire pour l’instant. Ouvrez-en un pour compter tout le magasin ou un seul rayon.
        </p>
      )}

      {precedents.length > 0 && (
        <>
          <h2>Inventaires précédents</h2>
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Périmètre</th>
                  <th>État</th>
                  <th>Ouvert le</th>
                  <th>Validé le</th>
                  <th className="nombre">Comptés</th>
                  <th className="nombre">Démarque</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {precedents.map((i) => (
                  <tr key={i.id} className={i.statut === 'annule' ? 'inactif' : undefined}>
                    <td>{i.numero}</td>
                    <td>{i.rayon ?? 'Tout le magasin'}</td>
                    <td>
                      <span className={`pastille ${CLASSES_STATUT[i.statut]}`}>
                        {LIBELLES_STATUT_INVENTAIRE[i.statut]}
                      </span>
                      {i.motifAnnulation && <span className="detail">{i.motifAnnulation}</span>}
                    </td>
                    <td>
                      {formaterDate(i.dateDebut)}
                      <span className="detail">{i.ouvertPar}</span>
                    </td>
                    <td>
                      {i.dateValidation && formaterDate(i.dateValidation)}
                      {i.validePar && <span className="detail">{i.validePar}</span>}
                    </td>
                    <td className="nombre">{i.nbComptes}</td>
                    <td className="nombre montant">{i.demarque !== null ? formaterFCFA(i.demarque) : ''}</td>
                    <td>
                      <button className="btn btn-secondaire" onClick={() => voirDetail(i.id)}>
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Fenêtres ─────────────────────────────────────────────────────────────────

function FenetreOuverture(props: {
  onFermer: () => void
  onOuvert: (inv: InventaireDetail) => void
}): React.JSX.Element {
  const [categories, setCategories] = useState<Categorie[]>([])
  const [choix, setChoix] = useState('total')
  useEffect(() => {
    appel('catalogue:categories')
      .then((c) => setCategories(c.filter((x) => x.actif)))
      .catch(() => setCategories([]))
  }, [])
  const rayons = categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const sousRayons = (id: number): Categorie[] =>
    categories.filter((c) => c.parentId === id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  return (
    <FenetreFormulaire
      titre="Ouvrir un inventaire"
      libelleValider="Ouvrir l’inventaire"
      valide
      onValider={async () => {
        const inv = await appel(
          'inventaires:ouvrir',
          choix === 'total' ? { type: 'total' } : { type: 'partiel', categorieId: Number(choix) }
        )
        props.onOuvert(inv)
      }}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Que comptez-vous ?
        <select value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="total">Tout le magasin</option>
          {rayons.map((r) => [
            <option key={r.id} value={r.id}>
              Rayon {r.nom} (avec ses sous-rayons)
            </option>,
            ...sousRayons(r.id).map((s) => (
              <option key={s.id} value={s.id}>
                {r.nom} › {s.nom}
              </option>
            ))
          ])}
        </select>
      </label>
      <p className="vide formulaire-bloc">
        Chaque produit compté est enregistré aussitôt. Le stock ne change qu’à la validation de l’inventaire ;
        les produits que vous n’aurez pas comptés ne bougeront pas.
      </p>
    </FenetreFormulaire>
  )
}

function FenetreComptage(props: {
  inventaireId: number
  produit: ProduitInventaire
  onFermer: () => void
  onEnregistre: (message: string) => void
}): React.JSX.Element {
  const p = props.produit
  const [champs, setChamps] = useState(() => champsDepuisProduit(p))
  const total = totalComptage(p.conditionnements, champs.nombres)
  const ecart = ecartPrevu(p, champs)
  const aCorriger = manque(p, champs)
  const avecEcart = !Number.isNaN(ecart) && !ecartNul(ecart)

  const enregistrer = async (): Promise<void> => {
    const l = await appel('inventaires:compter', versSaisie(props.inventaireId, p, champs))
    props.onEnregistre(
      ecartNul(l.ecart)
        ? `« ${p.nom} » : ${formaterQuantite(l.quantiteComptee)} compté, aucun écart. Au suivant !`
        : `« ${p.nom} » : ${formaterQuantite(l.quantiteComptee)} compté, écart ${texteEcart(l.ecart, p.unite)} (${formaterFCFA(l.valeurEcart)}).`
    )
  }

  return (
    <FenetreFormulaire
      titre={`${p.ligne ? 'Recompter' : 'Compter'} — ${p.nom}`}
      pastille={!Number.isNaN(ecart) && <PastilleEcart ecart={ecart} unite={p.unite} />}
      libelleValider="Enregistrer le comptage"
      valide={aCorriger === null}
      onValider={enregistrer}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Stock théorique : {formaterQuantite(p.stock)} {uniteDe(p.unite, p.stock)}
        {p.ligne &&
          ` · déjà compté ${formaterQuantite(p.ligne.quantiteComptee)} : ce comptage remplacera le précédent`}
      </p>
      {p.conditionnements.map((c) => (
        <label key={c.id} className="champ champ-etroit">
          {c.quantiteBase === 1 ? c.nom : `${c.nom} (×${formaterQuantite(c.quantiteBase)})`}
          <input
            inputMode="decimal"
            className="nombre"
            value={champs.nombres[c.id] ?? ''}
            onChange={(e) => setChamps({ ...champs, nombres: { ...champs.nombres, [c.id]: e.target.value } })}
          />
        </label>
      ))}
      <p className="formulaire-bloc montant">
        {Number.isNaN(total)
          ? 'Quantité illisible'
          : `= ${formaterQuantite(total)} ${uniteDe(p.unite, total)}`}
        {avecEcart &&
          ` · écart ${texteEcart(ecart, p.unite)}, soit ${formaterFCFA(Math.abs(Math.round(ecart * p.cump)))}`}
      </p>
      {avecEcart && (
        <>
          <label className="champ">
            Motif de l’écart
            <select
              value={champs.motif}
              onChange={(e) => setChamps({ ...champs, motif: e.target.value as MotifEcart | '' })}
            >
              <option value="">Choisir…</option>
              {(Object.keys(LIBELLES_MOTIF_ECART) as MotifEcart[]).map((m) => (
                <option key={m} value={m}>
                  {LIBELLES_MOTIF_ECART[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="champ champ-large">
            Commentaire (facultatif)
            <input
              placeholder="Ex. : vol présumé"
              value={champs.commentaire}
              onChange={(e) => setChamps({ ...champs, commentaire: e.target.value })}
            />
          </label>
        </>
      )}
      {aCorriger && <p className="vide formulaire-bloc">{aCorriger}</p>}
    </FenetreFormulaire>
  )
}

function FenetreValidation(props: {
  inventaire: InventaireDetail
  estimation: ReturnType<typeof estimation>
  onFermer: () => void
  onValide: (rapport: RapportDemarque) => void
}): React.JSX.Element {
  const { inventaire: inv, estimation: est } = props
  return (
    <FenetreFormulaire
      titre={`Valider l’inventaire ${inv.numero}`}
      libelleValider="Valider l’inventaire"
      valide={est.nbComptes > 0}
      onValider={async () => props.onValide(await appel('inventaires:valider', { id: inv.id }))}
      onFermer={props.onFermer}
    >
      <div className="formulaire-bloc">
        <p>
          {est.nbComptes} produit{est.nbComptes > 1 ? 's' : ''} compté{est.nbComptes > 1 ? 's' : ''}, dont{' '}
          {est.nbEcarts} avec un écart.
        </p>
        <p className="montant">
          Manquants : {formaterFCFA(est.manquants)} · surplus : {formaterFCFA(est.surplus)} (au coût moyen
          actuel)
        </p>
        {inv.nbNonComptes > 0 && (
          <p className="bandeau" role="status">
            {inv.nbNonComptes} produit{inv.nbNonComptes > 1 ? 's ne sont' : ' n’est'} pas compté
            {inv.nbNonComptes > 1 ? 's' : ''} : {inv.nbNonComptes > 1 ? 'leur' : 'son'} stock ne sera pas
            modifié.
          </p>
        )}
        <p className="vide">
          Le stock de chaque produit avec un écart est ajusté. Une fois validé, l’inventaire ne se modifie
          plus.
        </p>
      </div>
    </FenetreFormulaire>
  )
}

function FenetreAnnulation(props: {
  inventaire: InventaireDetail
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  return (
    <FenetreFormulaire
      titre={`Annuler l’inventaire ${props.inventaire.numero}`}
      libelleValider="Annuler l’inventaire"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Les {props.inventaire.nbComptes} comptages restent visibles, mais le stock ne bouge pas. Vous pourrez
        ouvrir un autre inventaire.
      </p>
      <label className="champ champ-large">
        Motif
        <input
          placeholder="Ex. : mauvais rayon choisi"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}

/** Fenêtre en lecture seule (Échap ou « Fermer »). */
function FenetreLecture(props: {
  titre: string
  pastille?: React.ReactNode
  onFermer: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { onFermer } = props
  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])
  return (
    <div className="voile">
      <section className="fenetre fenetre-formulaire fenetre-large" role="dialog" aria-modal="true">
        <div className="fenetre-entete">
          <h2>{props.titre}</h2>
          {props.pastille}
        </div>
        {props.children}
        <div className="formulaire-actions">
          <button className="btn btn-secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>
    </div>
  )
}

function TableauDemarque(props: { rapport: RapportDemarque }): React.JSX.Element {
  const r = props.rapport
  return (
    <>
      <p className="montant">
        Manquants : {formaterFCFA(r.manquants)} · surplus : {formaterFCFA(r.surplus)} · net :{' '}
        {formaterFCFA(r.net)}
      </p>
      {r.lignes.length === 0 ? (
        <p className="vide">Aucun écart : le stock était juste.</p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="nombre">Écart</th>
                <th>Motif</th>
                <th className="nombre">Coût moyen</th>
                <th className="nombre">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {r.lignes.map((l) => (
                <tr key={l.produitId}>
                  <td>{l.produit}</td>
                  <td className="nombre">{texteEcart(l.ecart, l.unite)}</td>
                  <td>
                    {l.motif ? LIBELLES_MOTIF_ECART[l.motif] : ''}
                    {l.commentaire && <span className="detail">{l.commentaire}</span>}
                  </td>
                  <td className="nombre montant">{formaterFCFA(l.cump)}</td>
                  <td className="nombre montant">{formaterFCFA(l.valeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function FenetreRapport(props: {
  titre: string
  rapport: RapportDemarque
  onFermer: () => void
}): React.JSX.Element {
  return (
    <FenetreLecture titre={props.titre} onFermer={props.onFermer}>
      <TableauDemarque rapport={props.rapport} />
    </FenetreLecture>
  )
}

function FenetreDetail(props: { inventaire: InventaireDetail; onFermer: () => void }): React.JSX.Element {
  const inv = props.inventaire
  return (
    <FenetreLecture
      titre={`Inventaire ${inv.numero}`}
      pastille={
        <span className={`pastille ${CLASSES_STATUT[inv.statut]}`}>
          {LIBELLES_STATUT_INVENTAIRE[inv.statut]}
        </span>
      }
      onFermer={props.onFermer}
    >
      <p className="vide">
        {inv.rayon ?? 'Tout le magasin'} · ouvert le {formaterDate(inv.dateDebut)} par {inv.ouvertPar}
        {inv.dateValidation && ` · validé le ${formaterDate(inv.dateValidation)} par ${inv.validePar ?? ''}`}
        {inv.motifAnnulation && ` · annulé : ${inv.motifAnnulation}`}
      </p>
      {inv.rapport && <TableauDemarque rapport={inv.rapport} />}
      <h3>Comptages</h3>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Produit</th>
              <th className="nombre">Théorique</th>
              <th className="nombre">Compté</th>
              <th>Écart</th>
            </tr>
          </thead>
          <tbody>
            {inv.produits.map((p) =>
              p.ligne ? (
                <tr key={p.produitId}>
                  <td>
                    {p.nom}
                    <span className="detail">
                      {p.ligne.detail
                        .map((d) => `${formaterQuantite(d.nombre)} ${d.conditionnement}`)
                        .join(' + ') || 'Rien en rayon'}{' '}
                      · {formaterDate(p.ligne.compteLe)} {p.ligne.compteLe.slice(11, 16)}
                    </span>
                  </td>
                  <td className="nombre">{formaterQuantite(p.ligne.quantiteTheorique)}</td>
                  <td className="nombre">{formaterQuantite(p.ligne.quantiteComptee)}</td>
                  <td>
                    <PastilleEcart ecart={p.ligne.ecart} unite={p.unite} />
                    {p.ligne.motif && <span className="detail">{LIBELLES_MOTIF_ECART[p.ligne.motif]}</span>}
                  </td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </div>
    </FenetreLecture>
  )
}
