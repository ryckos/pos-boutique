/**
 * Promotions programmées : liste, création, modification, arrêt (A16, REGLES_METIER § 5.2).
 * Propriétaire : Dev A. Gérant. Une promotion ne se supprime jamais : on l'arrête. Le processus
 * principal revérifie chaque règle ; à la caisse, les prix s'appliquent d'eux-mêmes.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Categorie } from '@shared/ipc/catalogue'
import type { Promotion } from '@shared/ipc/promotions'
import { formaterDate, formaterFCFA } from '@shared/format'
import { LIBELLES_TYPE_PROMOTION, libelleRegle, type TypePromotion } from '@shared/promotions'
import type { ArticleCatalogue } from '@shared/types'
import { ajouterJours } from '@shared/clients'
import { appel } from '@renderer/lib/api'
import { jourLocal } from '@renderer/lib/exportExcel'
import { usePagination } from '@renderer/lib/pagination'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonIcone } from '@renderer/ui/BoutonIcone'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import {
  CLASSE_ETAT,
  LIBELLES_ETAT,
  ONGLETS_PROMOTIONS,
  apercuPrix,
  blocage,
  estModifiable,
  filtrerPromotions,
  formulaireDepuis,
  formulaireVide,
  lirePreRemplissage,
  nomDuProduit,
  nomSuggere,
  optionsRayons,
  versSaisie,
  type FormulairePromotion,
  type OngletPromotions
} from './promotions'

type Action =
  | { type: 'creer'; depart?: FormulairePromotion }
  | { type: 'modifier' | 'arreter'; promotion: Promotion }
  | null

const DUREE_PAR_DEFAUT_JOURS = 7

export function PagePromotions(): React.JSX.Element {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null)
  const [onglet, setOnglet] = useState<OngletPromotions>('actives')
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [recherche, setRecherche] = useSearchParams()

  const charger = useCallback(() => {
    appel('promotions:lister')
      .then((p) => {
        setPromotions(p)
        setErreur(null)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  // Lien d'un autre écran (bouton « Promo » des péremptions) : le formulaire s'ouvre pré-rempli.
  useEffect(() => {
    const depart = lirePreRemplissage(recherche)
    if (!depart) return
    setRecherche({}, { replace: true })
    appel('catalogue:conditionnementsProduit', { produitId: depart.produitId })
      .then((articles) => {
        if (articles.length === 0) return
        const aujourdhui = jourLocal()
        const f = formulaireVide(
          aujourdhui,
          depart.fin && depart.fin >= aujourdhui
            ? depart.fin
            : ajouterJours(aujourdhui, DUREE_PAR_DEFAUT_JOURS)
        )
        setAction({
          type: 'creer',
          depart: {
            ...f,
            valeur: depart.pourcent !== null ? String(depart.pourcent) : '',
            produit: { id: depart.produitId, nom: nomDuProduit(articles[0].designation) }
          }
        })
      })
      .catch((e: Error) => setErreur(e.message))
  }, [recherche, setRecherche])

  const affichees = filtrerPromotions(promotions ?? [], onglet)
  const pages = usePagination(affichees)

  const apres = (message: string): void => {
    setAction(null)
    setSucces(message)
    charger()
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Promotions</h1>
        <div className="page-entete-actions">
          <button className="btn" onClick={() => setAction({ type: 'creer' })}>
            <Icone nom="ajouter" />
            Nouvelle promotion
          </button>
        </div>
        <div className="onglets" role="tablist">
          {ONGLETS_PROMOTIONS.map((o) => (
            <button
              key={o.cle}
              type="button"
              role="tab"
              aria-selected={onglet === o.cle}
              className={onglet === o.cle ? 'onglet actif' : 'onglet'}
              onClick={() => setOnglet(o.cle)}
            >
              {o.libelle}
            </button>
          ))}
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

      {action?.type === 'creer' && (
        <FenetrePromotion
          depart={action.depart}
          onFermer={() => setAction(null)}
          onValider={async (saisie) => {
            await appel('promotions:creer', saisie)
            apres(`Promotion « ${saisie.nom} » créée : elle s’applique à la caisse dès son premier jour.`)
          }}
        />
      )}
      {action?.type === 'modifier' && (
        <FenetrePromotion
          key={action.promotion.id}
          promotion={action.promotion}
          onFermer={() => setAction(null)}
          onValider={async (saisie) => {
            await appel('promotions:modifier', { id: action.promotion.id, ...saisie })
            apres(`Promotion « ${saisie.nom} » modifiée.`)
          }}
        />
      )}
      {action?.type === 'arreter' && (
        <FenetreFormulaire
          titre="Arrêter la promotion"
          libelleValider="Arrêter la promotion"
          attention
          valide
          onValider={async () => {
            await appel('promotions:arreter', { id: action.promotion.id })
            apres(`Promotion « ${action.promotion.nom} » arrêtée : les prix reviennent à la normale.`)
          }}
          onFermer={() => setAction(null)}
        >
          <p>
            Les prix de « {action.promotion.nom} » reviennent à la normale <strong>tout de suite</strong>. Les
            tickets déjà faits gardent leur prix et la mention de la promotion.
          </p>
        </FenetreFormulaire>
      )}

      {promotions === null ? (
        <p className="vide">Chargement…</p>
      ) : affichees.length === 0 ? (
        <p className="vide">
          {onglet === 'actives'
            ? 'Aucune promotion en cours ni à venir. Créez-en une avec « Nouvelle promotion ».'
            : 'Aucune promotion terminée ou arrêtée.'}
        </p>
      ) : (
        <>
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Promotion</th>
                  <th>Pour</th>
                  <th>Règle</th>
                  <th>Période</th>
                  <th>État</th>
                  <th className="colonne-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.elements.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td>{p.produit ?? `Rayon ${p.categorie}`}</td>
                    <td>{libelleRegle(p, formaterFCFA)}</td>
                    <td>
                      du {formaterDate(p.dateDebut)} au {formaterDate(p.dateFin)}
                    </td>
                    <td>
                      <span className={`pastille ${CLASSE_ETAT[p.etat]}`}>{LIBELLES_ETAT[p.etat]}</span>
                    </td>
                    <td className="colonne-actions">
                      {estModifiable(p) && (
                        <>
                          <BoutonIcone
                            icone="modifier"
                            libelle={`Modifier ${p.nom}`}
                            onClick={() => setAction({ type: 'modifier', promotion: p })}
                          />
                          <BoutonIcone
                            icone="annuler"
                            libelle={`Arrêter ${p.nom}`}
                            onClick={() => setAction({ type: 'arreter', promotion: p })}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pages={pages} />
        </>
      )}
    </div>
  )
}

function FenetrePromotion(props: {
  promotion?: Promotion
  depart?: FormulairePromotion
  onValider: (saisie: NonNullable<ReturnType<typeof versSaisie>>) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const aujourdhui = jourLocal()
  const [f, setF] = useState<FormulairePromotion>(
    () =>
      props.depart ??
      (props.promotion
        ? formulaireDepuis(props.promotion)
        : formulaireVide(aujourdhui, ajouterJours(aujourdhui, DUREE_PAR_DEFAUT_JOURS)))
  )
  const [rayons, setRayons] = useState<{ id: number; libelle: string }[]>([])
  const [recherche, setRecherche] = useState('')
  const [propositions, setPropositions] = useState<{ id: number; nom: string }[]>([])
  const [conditionnements, setConditionnements] = useState<ArticleCatalogue[]>([])
  const modif = (changement: Partial<FormulairePromotion>): void => setF((x) => ({ ...x, ...changement }))

  useEffect(() => {
    appel('catalogue:categories')
      .then((c: Categorie[]) => setRayons(optionsRayons(c)))
      .catch(() => undefined)
  }, [])

  // Recherche d'un produit par son nom, 2 lettres au moins.
  useEffect(() => {
    const t = recherche.trim()
    if (t.length < 2 || /^\d+$/.test(t)) {
      setPropositions([])
      return
    }
    let annule = false
    appel('catalogue:rechercher', { texte: t })
      .then((r) => {
        if (annule) return
        const vus = new Map<number, string>()
        for (const a of r) if (!vus.has(a.produitId)) vus.set(a.produitId, nomDuProduit(a.designation))
        setPropositions([...vus].slice(0, 8).map(([id, nom]) => ({ id, nom })))
      })
      .catch(() => undefined)
    return () => {
      annule = true
    }
  }, [recherche])

  // Les prix du produit choisi, pour l'aperçu avant/après.
  const produitId = f.cible === 'produit' ? (f.produit?.id ?? null) : null
  useEffect(() => {
    if (produitId === null) {
      setConditionnements([])
      return
    }
    appel('catalogue:conditionnementsProduit', { produitId })
      .then(setConditionnements)
      .catch(() => setConditionnements([]))
  }, [produitId])

  const nomRayon = rayons.find((r) => r.id === f.categorieId)?.libelle ?? null
  const probleme = blocage(f, nomRayon)
  const saisie = versSaisie(f, nomRayon)
  const suggestion = nomSuggere(f, nomRayon)
  const apercu = apercuPrix(f, conditionnements)
  const sansEffet = apercu.length > 0 && apercu.every((l) => l.prixPromo === null) && probleme === null

  return (
    <FenetreFormulaire
      titre={props.promotion ? 'Modifier la promotion' : 'Nouvelle promotion'}
      libelleValider={props.promotion ? 'Enregistrer' : 'Créer la promotion'}
      valide={saisie !== null}
      large
      onValider={() => props.onValider(saisie!)}
      onFermer={props.onFermer}
    >
      <fieldset className="champ champ-large">
        <legend>La promotion vaut pour</legend>
        <label className="champ-case">
          <input type="radio" checked={f.cible === 'produit'} onChange={() => modif({ cible: 'produit' })} />{' '}
          Un produit (tous ses conditionnements)
        </label>
        <label className="champ-case">
          <input type="radio" checked={f.cible === 'rayon'} onChange={() => modif({ cible: 'rayon' })} /> Un
          rayon (avec ses sous-rayons)
        </label>
      </fieldset>

      {f.cible === 'produit' ? (
        <div className="champ champ-large">
          <label>
            Produit
            <input
              value={f.produit ? f.produit.nom : recherche}
              readOnly={f.produit !== null}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Tapez le nom du produit"
              autoComplete="off"
            />
          </label>
          {f.produit ? (
            <button
              type="button"
              className="btn btn-discret"
              onClick={() => {
                modif({ produit: null })
                setRecherche('')
              }}
            >
              Changer de produit
            </button>
          ) : (
            propositions.length > 0 && (
              <ul className="accueil-liste">
                {propositions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="btn btn-discret"
                      onClick={() => modif({ produit: { id: p.id, nom: p.nom } })}
                    >
                      {p.nom}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      ) : (
        <label className="champ champ-large">
          Rayon
          <select
            value={f.categorieId ?? ''}
            onChange={(e) => modif({ categorieId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Choisissez un rayon</option>
            {rayons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.libelle}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="champ">
        Type de promotion
        <select value={f.type} onChange={(e) => modif({ type: e.target.value as TypePromotion })}>
          {(Object.keys(LIBELLES_TYPE_PROMOTION) as TypePromotion[]).map((t) => (
            <option key={t} value={t}>
              {LIBELLES_TYPE_PROMOTION[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        {f.type === 'remise_pourcent' ? 'Remise (%)' : 'Montant (FCFA par unité)'}
        <input inputMode="numeric" value={f.valeur} onChange={(e) => modif({ valeur: e.target.value })} />
        <span className="champ-aide">
          {f.type === 'remise_pourcent' && 'De 1 à 99. Le prix est arrondi au franc le plus proche.'}
          {f.type === 'remise_montant' && 'Retiré à chaque unité : un carton de 24 perd 24 fois ce montant.'}
          {f.type === 'prix_fixe' && 'Prix d’une unité : un lot de 3 coûte 3 fois ce prix.'}
        </span>
      </label>

      <label className="champ">
        Du
        <input type="date" value={f.dateDebut} onChange={(e) => modif({ dateDebut: e.target.value })} />
      </label>
      <label className="champ">
        Au (inclus)
        <input
          type="date"
          value={f.dateFin}
          min={f.dateDebut || undefined}
          onChange={(e) => modif({ dateFin: e.target.value })}
        />
      </label>

      <label className="champ champ-large">
        Nom de la promotion
        <input
          value={f.nom}
          onChange={(e) => modif({ nom: e.target.value })}
          placeholder={suggestion || 'Ex. : Yaourt −20 %'}
        />
        <span className="champ-aide">Imprimé sur le ticket. Laissé vide, le nom proposé est utilisé.</span>
      </label>

      {apercu.length > 0 && (
        <div className="tableau-cadre champ-large">
          <table className="tableau">
            <thead>
              <tr>
                <th>Conditionnement</th>
                <th className="nombre">Prix normal</th>
                <th className="nombre">Prix en promotion</th>
              </tr>
            </thead>
            <tbody>
              {apercu.map((l) => (
                <tr key={l.designation}>
                  <td>{l.designation}</td>
                  <td className="nombre montant">{formaterFCFA(l.prixNormal)}</td>
                  <td className="nombre montant">
                    {l.prixPromo === null ? (
                      <span className="detail">Sans effet</span>
                    ) : (
                      formaterFCFA(l.prixPromo)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sansEffet && (
        <p className="alerte champ-large" role="alert">
          Avec cette valeur, aucun prix ne baisse : la promotion n’aurait aucun effet.
        </p>
      )}
      {probleme && f.valeur !== '' && <p className="champ-aide champ-large">{probleme}</p>}
    </FenetreFormulaire>
  )
}
