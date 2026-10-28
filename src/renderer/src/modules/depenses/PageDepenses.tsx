/**
 * Dépenses : liste d'une période, total par catégorie, nouvelle dépense, annulation, catégories.
 * Propriétaire : Dev B.
 * Gérant. Jamais de suppression : une dépense s'annule avec un motif et reste visible
 * (REGLES_METIER § 10). Les règles sont revérifiées par le processus principal.
 * Caissière : vue restreinte (choix de Dev A) — les dépenses payées au tiroir de sa caisse ouverte,
 * sans catégories, sans période ni annulation.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CategorieDepense, Depense, ListeDepenses, SourceDepense } from '@shared/ipc/depenses'
import type { SessionOuverteResume } from '@shared/ipc/caisse'
import { useUtilisateur } from '@renderer/app/contexte'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonExporter } from '@renderer/ui/BoutonExporter'
import { suffixePeriode } from '@renderer/lib/exportExcel'
import type { DemandeExport } from '@shared/ipc/exports'
import {
  LIBELLES_SOURCE,
  aujourdhuiLocal,
  depenseAnnulable,
  etatDepense,
  libellePayeePar,
  lireMontant,
  manqueDepense
} from './saisieDepense'
import { BoutonIcone } from '@renderer/ui/BoutonIcone'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import { usePagination } from '@renderer/lib/pagination'
import { AideIcones } from '@renderer/ui/AideIcones'

type Action =
  | { type: 'nouvelle' | 'categories' }
  | { type: 'annuler'; depense: Depense }
  | { type: 'desactiverCategorie'; categorie: CategorieDepense }
  | null

export function PageDepenses(): React.JSX.Element {
  const caissiere = useUtilisateur().role === 'caissier'
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [liste, setListe] = useState<ListeDepenses | null>(null)
  const [categories, setCategories] = useState<CategorieDepense[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('depenses:liste', {
      du: du || null,
      au: au || null,
      categorieId: categorieId ? Number(categorieId) : null
    })
      .then((l) => {
        setListe(l)
        setErreur(null)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [du, au, categorieId])

  const chargerCategories = useCallback(() => {
    appel('depenses:categories', { inclureInactives: !caissiere })
      .then(setCategories)
      .catch((e: Error) => setErreur(e.message))
  }, [caissiere])

  useEffect(charger, [charger])
  useEffect(chargerCategories, [chargerCategories])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setSucces(null)
  }

  const actives = categories.filter((c) => c.actif)

  // L'export reprend la liste affichée, annulées comprises (REGLES_METIER § 11.2).
  const demandeExport = (): DemandeExport => {
    const l = liste!
    const categorie = categories.find((c) => String(c.id) === categorieId)
    return {
      nomFichier: `Depenses_${suffixePeriode(l.du, l.au)}`,
      titre: `Dépenses du ${formaterDate(l.du)} au ${formaterDate(l.au)}${categorie ? ` (${categorie.nom})` : ''}`,
      feuilles: [
        {
          nom: 'Dépenses',
          colonnes: [
            { titre: 'Numéro', type: 'texte' },
            { titre: 'Date', type: 'date' },
            { titre: 'Catégorie', type: 'texte' },
            { titre: 'Libellé', type: 'texte' },
            { titre: 'Justificatif', type: 'texte' },
            { titre: 'Payée par', type: 'texte' },
            { titre: 'Montant', type: 'montant' },
            { titre: 'État', type: 'texte' },
            { titre: 'Saisie par', type: 'texte' },
            { titre: 'Annulée le', type: 'date' },
            { titre: 'Annulée par', type: 'texte' },
            { titre: 'Motif d’annulation', type: 'texte' }
          ],
          lignes: l.depenses.map((d) => [
            d.numero,
            d.date,
            d.categorie,
            d.libelle,
            d.reference,
            libellePayeePar(d),
            d.montant,
            d.annuleLe ? 'Annulée' : 'Enregistrée',
            d.utilisateur,
            d.annuleLe,
            d.annulePar,
            d.motifAnnulation
          ])
        },
        {
          nom: 'Par catégorie',
          colonnes: [
            { titre: 'Catégorie', type: 'texte' },
            { titre: 'Total (hors annulées)', type: 'montant' }
          ],
          lignes: [...l.parCategorie.map((c) => [c.categorie, c.total]), ['Total', l.total]]
        }
      ]
    }
  }

  const pages = usePagination(liste?.depenses ?? [])

  return (
    <div className="page">
      <header className="page-entete">
        <h1>{caissiere ? 'Dépenses de ma caisse' : 'Dépenses'}</h1>
        <AideIcones
          entrees={
            caissiere
              ? [['ajouter', 'Nouvelle dépense payée au tiroir']]
              : [
                  ['ajouter', 'Nouvelle dépense'],
                  'categories',
                  'exporter',
                  ['annuler', 'Annuler la dépense, avec un motif']
                ]
          }
          pagination
        />
        <div className="page-entete-actions">
          {liste && (
            <span className="chiffre-cle">
              {caissiere ? 'Total payé au tiroir' : 'Total de la période'} :{' '}
              <span className="montant">{formaterFCFA(liste.total)}</span>
            </span>
          )}
          {!caissiere && (
            <>
              <BoutonExporter demande={demandeExport} desactive={!liste || liste.depenses.length === 0} />
              <button className="btn btn-secondaire" onClick={() => ouvrir({ type: 'categories' })}>
                <Icone nom="categories" />
                Catégories
              </button>
            </>
          )}
          <button className="btn" onClick={() => ouvrir({ type: 'nouvelle' })}>
            <Icone nom="ajouter" />
            Nouvelle dépense
          </button>
        </div>
      </header>

      {succes && (
        <p className="succes page-message" role="status">
          {succes}
        </p>
      )}

      {action?.type === 'nouvelle' && (
        <FormulaireDepense
          caissiere={caissiere}
          categories={actives}
          onFermer={() => ouvrir(null)}
          onValider={async (s) => {
            const d = await appel('depenses:enregistrer', s)
            setAction(null)
            setSucces(`Dépense ${d.numero} enregistrée : ${d.libelle}, ${formaterFCFA(d.montant)}.`)
            charger()
          }}
        />
      )}
      {action?.type === 'annuler' && (
        <FormulaireAnnulation
          depense={action.depense}
          onFermer={() => ouvrir(null)}
          onValider={async (motif) => {
            await appel('depenses:annuler', { id: action.depense.id, motif })
            setAction(null)
            setSucces(
              `Dépense ${action.depense.numero} annulée : elle ne compte plus dans les totaux${
                action.depense.source === 'caisse'
                  ? ', et l’argent est revenu dans les espèces du tiroir'
                  : ''
              }.`
            )
            charger()
          }}
        />
      )}
      {action?.type === 'categories' && (
        <FenetreCategories
          categories={categories}
          onCreer={async (nom) => {
            const c = await appel('depenses:creerCategorie', { nom })
            setSucces(`Catégorie « ${c.nom} » créée.`)
            chargerCategories()
          }}
          onDesactiver={(categorie) => ouvrir({ type: 'desactiverCategorie', categorie })}
          onFermer={() => ouvrir(null)}
        />
      )}
      {action?.type === 'desactiverCategorie' && (
        <FenetreFormulaire
          titre={`Désactiver « ${action.categorie.nom} »`}
          libelleValider="Désactiver la catégorie"
          attention
          valide
          onValider={async () => {
            await appel('depenses:desactiverCategorie', { id: action.categorie.id })
            setAction({ type: 'categories' })
            setSucces(`Catégorie « ${action.categorie.nom} » désactivée.`)
            chargerCategories()
          }}
          onFermer={() => setAction({ type: 'categories' })}
        >
          <p className="vide formulaire-bloc">
            Elle ne sera plus proposée pour une nouvelle dépense. Les dépenses déjà saisies la gardent. Son
            nom ne pourra pas être repris pour une autre catégorie.
          </p>
        </FenetreFormulaire>
      )}

      {!caissiere && (
        <div className="filtres">
          <label className="champ">
            Du
            <input
              type="date"
              value={du || liste?.du || ''}
              max={au || liste?.au}
              onChange={(e) => setDu(e.target.value)}
            />
          </label>
          <label className="champ">
            Au
            <input
              type="date"
              value={au || liste?.au || ''}
              min={du || liste?.du}
              onChange={(e) => setAu(e.target.value)}
            />
          </label>
          <label className="champ">
            Catégorie
            <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                  {c.actif ? '' : ' (désactivée)'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {liste && liste.parCategorie.length > 1 && (
        <p className="tableau-actions page-message">
          {liste.parCategorie.map((c) => (
            <span key={c.categorieId} className="pastille">
              {c.categorie} : {formaterFCFA(c.total)}
            </span>
          ))}
        </p>
      )}

      {liste && liste.depenses.length === 0 ? (
        <p className="vide">
          {caissiere
            ? 'Aucune dépense payée au tiroir de votre caisse.'
            : `Aucune dépense du ${formaterDate(liste.du)} au ${formaterDate(liste.au)}.`}{' '}
          Enregistrez la première avec « Nouvelle dépense ».
        </p>
      ) : (
        liste && (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th>Payée par</th>
                  <th className="nombre">Montant</th>
                  <th>État</th>
                  <th className="colonne-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.elements.map((d) => {
                  const etat = etatDepense(d)
                  return (
                    <tr key={d.id} className={d.annuleLe ? 'inactif' : undefined}>
                      <td className="cellule-titre">
                        {d.numero}
                        <div className="detail">par {d.utilisateur}</div>
                      </td>
                      <td>{formaterDate(d.date)}</td>
                      <td>{d.categorie}</td>
                      <td>
                        {d.libelle}
                        {d.reference && <div className="detail">Justificatif : {d.reference}</div>}
                      </td>
                      <td>{libellePayeePar(d)}</td>
                      <td className="nombre montant">{formaterFCFA(d.montant)}</td>
                      <td>
                        <span className={`pastille ${etat.classe}`}>{etat.texte}</span>
                        {d.annuleLe && (
                          <div className="detail">
                            le {formaterDate(d.annuleLe)} par {d.annulePar} : {d.motifAnnulation}
                          </div>
                        )}
                      </td>
                      <td className="colonne-actions">
                        {!caissiere && depenseAnnulable(d) && (
                          <BoutonIcone
                            icone="annuler"
                            variante="attention"
                            libelle={`Annuler la dépense ${d.numero}`}
                            onClick={() => ouvrir({ type: 'annuler', depense: d })}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      <Pagination pages={pages} />
      <p className="vide note-bas">
        {caissiere
          ? 'Une dépense payée au tiroir sort des espèces de votre caisse. En cas d’erreur, demandez au gérant de l’annuler avant la clôture.'
          : 'Une dépense saisie par erreur s’annule avec un motif, puis se ressaisit. Payée au tiroir, elle ne s’annule plus une fois la caisse clôturée.'}
      </p>
    </div>
  )
}

function FormulaireDepense(props: {
  caissiere: boolean
  categories: CategorieDepense[]
  onValider: (s: {
    categorieId: number
    libelle: string
    montant: number
    source: SourceDepense
    date: string
    reference: string
    sessionId: number | null
  }) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const aujourdhui = aujourdhuiLocal()
  const [categorieId, setCategorieId] = useState('')
  const [libelle, setLibelle] = useState('')
  const [montantTexte, setMontantTexte] = useState('')
  const [source, setSource] = useState<SourceDepense>(props.caissiere ? 'caisse' : 'fonds_propres')
  const [date, setDate] = useState(aujourdhui)
  const [reference, setReference] = useState('')
  // Gérant : caisses ouvertes, pour savoir de quel tiroir sort l'argent.
  const [caisses, setCaisses] = useState<SessionOuverteResume[] | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [erreurCaisses, setErreurCaisses] = useState<string | null>(null)
  useEffect(() => {
    if (props.caissiere || source !== 'caisse' || caisses) return
    appel('caisse:sessionsOuvertes')
      .then(setCaisses)
      .catch((e: Error) => setErreurCaisses(e.message))
  }, [props.caissiere, source, caisses])

  const montant = lireMontant(montantTexte)
  const manque =
    erreurCaisses ??
    manqueDepense(
      {
        categorieId: categorieId ? Number(categorieId) : null,
        libelle,
        montant,
        source,
        date,
        caissesOuvertes: props.caissiere ? undefined : (caisses?.length ?? 0),
        sessionId: sessionId ? Number(sessionId) : null
      },
      aujourdhui
    ) ??
    (!props.caissiere && source === 'caisse' && !caisses ? 'Recherche des caisses ouvertes…' : null)
  const caisseUnique = caisses?.length === 1 ? caisses[0] : null

  return (
    <FenetreFormulaire
      titre="Nouvelle dépense"
      libelleValider="Enregistrer la dépense"
      valide={manque === null}
      onValider={() =>
        props.onValider({
          categorieId: Number(categorieId),
          libelle,
          montant: montant!,
          source,
          date,
          reference,
          sessionId: source === 'caisse' && sessionId ? Number(sessionId) : null
        })
      }
      onFermer={props.onFermer}
    >
      <label className="champ">
        Catégorie
        <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Choisir…</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="champ champ-large">
        Libellé
        <input
          placeholder="Ex. : taxi-moto pour la livraison"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
        />
      </label>
      <label className="champ">
        Montant (F)
        <input inputMode="numeric" value={montantTexte} onChange={(e) => setMontantTexte(e.target.value)} />
        <span className="champ-aide">{manque ?? formaterFCFA(montant ?? 0)}</span>
      </label>
      {props.caissiere ? (
        <p className="champ-aide formulaire-bloc">
          Payée par le tiroir de votre caisse, datée d’aujourd’hui : le montant sort de vos espèces.
        </p>
      ) : (
        <label className="champ">
          Payée par
          <select value={source} onChange={(e) => setSource(e.target.value as SourceDepense)}>
            {(Object.keys(LIBELLES_SOURCE) as SourceDepense[]).map((s) => (
              <option key={s} value={s}>
                {LIBELLES_SOURCE[s]}
              </option>
            ))}
          </select>
          <span className="champ-aide">
            {source === 'caisse'
              ? caisseUnique
                ? `Sort des espèces de la caisse de ${caisseUnique.caissier}, datée d’aujourd’hui.`
                : 'Sort des espèces du tiroir, datée d’aujourd’hui.'
              : 'Fonds propres : l’argent ne sort pas du tiroir.'}
          </span>
        </label>
      )}
      {!props.caissiere && source === 'caisse' && caisses && caisses.length > 1 && (
        <label className="champ">
          Caisse
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">Choisir…</option>
            {caisses.map((c) => (
              <option key={c.id} value={c.id}>
                Caisse de {c.caissier}
              </option>
            ))}
          </select>
        </label>
      )}
      {source === 'fonds_propres' && (
        <label className="champ">
          Date
          <input type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
      <label className="champ">
        Justificatif (facultatif)
        <input
          placeholder="N° du reçu ou de la facture"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}

function FormulaireAnnulation(props: {
  depense: Depense
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const d = props.depense
  return (
    <FenetreFormulaire
      titre={`Annuler la dépense ${d.numero}`}
      libelleValider="Annuler la dépense"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        {d.libelle} ({d.categorie}), {formaterFCFA(d.montant)} du {formaterDate(d.date)}. Elle restera
        visible, marquée annulée, et ne comptera plus dans les totaux.
        {d.source === 'caisse' &&
          ` Les ${formaterFCFA(d.montant)} reviennent dans les espèces de la caisse de ${d.caissier}.`}{' '}
        L’annulation est définitive.
      </p>
      <label className="champ champ-large">
        Motif
        <input
          placeholder="Ex. : saisie en double"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}

function FenetreCategories(props: {
  categories: CategorieDepense[]
  onCreer: (nom: string) => Promise<void>
  onDesactiver: (c: CategorieDepense) => void
  onFermer: () => void
}): React.JSX.Element {
  const [nom, setNom] = useState('')
  const actives = props.categories.filter((c) => c.actif)
  return (
    <FenetreFormulaire
      titre="Catégories de dépenses"
      aide={[['desactiver', 'Désactiver la catégorie (une au moins reste active)']]}
      libelleValider="Créer la catégorie"
      valide={nom.trim() !== ''}
      onValider={async () => {
        await props.onCreer(nom)
        setNom('')
      }}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nouvelle catégorie
        <input placeholder="Ex. : Gardiennage" value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <div className="formulaire-bloc tableau-cadre">
        <table className="tableau">
          <tbody>
            {props.categories.map((c) => (
              <tr key={c.id} className={c.actif ? undefined : 'inactif'}>
                <td>{c.nom}</td>
                <td>
                  <span className={`pastille ${c.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                    {c.actif ? 'Active' : 'Désactivée'}
                  </span>
                </td>
                <td className="colonne-actions">
                  {c.actif && actives.length > 1 && (
                    <BoutonIcone
                      icone="desactiver"
                      variante="attention"
                      libelle={`Désactiver « ${c.nom} »`}
                      onClick={() => props.onDesactiver(c)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FenetreFormulaire>
  )
}
