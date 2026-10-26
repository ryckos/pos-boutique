/**
 * Rapports de gestion : pertes par cause, valeur du stock, achats par fournisseur, résultat.
 * Propriétaire : Dev B.
 * Gérant (matrice : « Consulter les rapports financiers »). Lecture seule ; tous les chiffres sont
 * calculés par le processus principal (REGLES_METIER § 11.1).
 */
import { useEffect, useState } from 'react'
import type {
  PeriodeRapport,
  RapportAchats,
  RapportPertes,
  RapportResultat,
  RapportValeurStock
} from '@shared/ipc/rapports-gestion'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { jourLocal } from '@renderer/lib/exportExcel'
import { BoutonExporter } from '@renderer/ui/BoutonExporter'
import type { DemandeExport } from '@shared/ipc/exports'
import {
  EN_ATTENTE_VENTES,
  exportAchats,
  exportPertes,
  exportResultat,
  exportValeurStock
} from './exportRapports'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import { usePagination } from '@renderer/lib/pagination'
import { AideIcones } from '@renderer/ui/AideIcones'

type Onglet = 'pertes' | 'valeur' | 'achats' | 'resultat'

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'pertes', libelle: 'Pertes' },
  { cle: 'valeur', libelle: 'Valeur du stock' },
  { cle: 'achats', libelle: 'Achats' },
  { cle: 'resultat', libelle: 'Résultat' }
]

/** Charge un rapport à chaque changement de période ; l'erreur est un message pour l'utilisateur. */
function useRapport<T>(charger: () => Promise<T>, cle: string): { donnees: T | null; erreur: string | null } {
  const [donnees, setDonnees] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => {
    let actif = true
    charger()
      .then((d) => {
        if (!actif) return
        setDonnees(d)
        setErreur(null)
      })
      .catch((e: Error) => actif && setErreur(e.message))
    return () => {
      actif = false
    }
    // `cle` résume la période : `charger` change à chaque rendu, la recharger en boucle serait une erreur.
  }, [cle])
  return { donnees, erreur }
}

function Erreur({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null
  return (
    <p className="alerte page-message" role="alert">
      {message}
    </p>
  )
}

/** Phrase de synthèse d'un onglet, avec le bouton d'export de ce rapport à droite. */
function EnteteOnglet({
  demande,
  children
}: {
  demande: () => DemandeExport
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="entete-onglet">
      <p>{children}</p>
      <div className="tableau-actions">
        <BoutonExporter demande={demande} />
      </div>
    </div>
  )
}

function textePeriode(r: { du: string; au: string }): string {
  return r.du === r.au ? `le ${formaterDate(r.du)}` : `du ${formaterDate(r.du)} au ${formaterDate(r.au)}`
}

export function PageRapports(): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('pertes')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const periode: PeriodeRapport = { du: du || null, au: au || null }
  const cle = `${du}|${au}`

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Rapports</h1>
        <AideIcones
          entrees={[
            'exporter',
            ['restaurer', 'Revenir au mois en cours']
          ]}
          pagination
        />
        <div className="onglets" role="tablist">
          {ONGLETS.map((o) => (
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

      {onglet !== 'valeur' && (
        <div className="filtres">
          <label className="champ">
            Du
            <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)} />
          </label>
          <label className="champ">
            Au
            <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} />
          </label>
          {(du || au) && (
            <button
              type="button"
              className="btn btn-secondaire"
              onClick={() => {
                setDu('')
                setAu('')
              }}
            >
              <Icone nom="restaurer" />
              Revenir au mois en cours
            </button>
          )}
        </div>
      )}

      {onglet === 'pertes' && <OngletPertes periode={periode} cle={cle} />}
      {onglet === 'valeur' && <OngletValeur />}
      {onglet === 'achats' && <OngletAchats periode={periode} cle={cle} />}
      {onglet === 'resultat' && <OngletResultat periode={periode} cle={cle} />}
    </div>
  )
}

interface ProprietesPeriode {
  periode: PeriodeRapport
  cle: string
}

function OngletPertes({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportPertes>(() => appel('rapports:pertes', periode), cle)
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  const libelles = Object.fromEntries(r.causes.map((c) => [c.cause, c.libelle]))
  return (
    <>
      <EnteteOnglet demande={() => exportPertes(r)}>
        Pertes {textePeriode(r)} : <span className="montant">{formaterFCFA(r.total)}</span>
        {r.surplusInventaire > 0 && (
          <span className="detail">
            Surplus trouvés aux inventaires (non déduits) : {formaterFCFA(r.surplusInventaire)}
          </span>
        )}
      </EnteteOnglet>
      <div className="tableau-cadre bloc-espace">
        <table className="tableau">
          <thead>
            <tr>
              <th>Cause</th>
              <th className="nombre">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {r.causes.map((c) => (
              <tr key={c.cause}>
                <td>{c.libelle}</td>
                <td className="nombre montant">{formaterFCFA(c.valeur)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="nombre montant">
                <strong>{formaterFCFA(r.total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {r.produits.length === 0 ? (
        <p className="vide">Aucune perte {textePeriode(r)}.</p>
      ) : (
        <PertesParProduit produits={r.produits} libelles={libelles} />
      )}
    </>
  )
}

/** Détail des pertes produit par produit : la liste la plus longue des rapports, donc paginée. */
function PertesParProduit(props: {
  produits: RapportPertes['produits']
  libelles: Record<string, string>
}): React.JSX.Element {
  const pages = usePagination(props.produits)
  return (
    <>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Cause</th>
              <th>Produit</th>
              <th className="nombre">Quantité</th>
              <th className="nombre">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {pages.elements.map((p) => (
              <tr key={`${p.cause}-${p.produitId}`}>
                <td>{props.libelles[p.cause]}</td>
                <td className="cellule-titre">{p.produit}</td>
                <td className="nombre">
                  {p.quantite === null ? '—' : `${formaterQuantite(p.quantite)} ${p.unite}`}
                </td>
                <td className="nombre montant">{formaterFCFA(p.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pages={pages} />
    </>
  )
}

function OngletValeur(): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportValeurStock>(() => appel('rapports:valeurStock'), '')
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  return (
    <>
      <EnteteOnglet demande={() => exportValeurStock(r, jourLocal())}>
        Valeur du stock aujourd’hui, au coût moyen : <span className="montant">{formaterFCFA(r.total)}</span>
      </EnteteOnglet>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Rayon</th>
              <th className="nombre">Produits</th>
              <th className="nombre">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {r.rayons.map((x) => (
              <tr key={x.rayon}>
                <td>{x.rayon}</td>
                <td className="nombre">{x.nbProduits}</td>
                <td className="nombre montant">{formaterFCFA(x.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Un solde négatif est un avoir à valoir, pas une dette. */
function texteResteDu(montant: number): string {
  return montant < 0 ? `Avoir à valoir ${formaterFCFA(-montant)}` : formaterFCFA(montant)
}

function OngletAchats({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportAchats>(() => appel('rapports:achats', periode), cle)
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  if (r.fournisseurs.length === 0) return <p className="vide">Aucun achat {textePeriode(r)}.</p>
  return (
    <>
      <EnteteOnglet demande={() => exportAchats(r)}>
        Livré {textePeriode(r)} : <span className="montant">{formaterFCFA(r.totalLivre)}</span>
        <span className="detail">Le reste dû est celui d’aujourd’hui, toutes livraisons confondues.</span>
      </EnteteOnglet>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Fournisseur</th>
              <th className="nombre">Réceptions</th>
              <th className="nombre">Livré</th>
              <th className="nombre">Avoirs reçus</th>
              <th className="nombre">Réglé</th>
              <th className="nombre">Reste dû</th>
            </tr>
          </thead>
          <tbody>
            {r.fournisseurs.map((f) => (
              <tr key={f.fournisseurId}>
                <td>
                  {f.fournisseur}
                  {!f.actif && <span className="pastille pastille-inactif">Désactivé</span>}
                </td>
                <td className="nombre">{f.nbReceptions}</td>
                <td className="nombre montant">{formaterFCFA(f.livre)}</td>
                <td className="nombre montant">{formaterFCFA(f.avoirsRecus)}</td>
                <td className="nombre montant">{formaterFCFA(f.regle)}</td>
                <td className="nombre montant">{texteResteDu(f.resteDu)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td />
              <td className="nombre montant">
                <strong>{formaterFCFA(r.totalLivre)}</strong>
              </td>
              <td className="nombre montant">
                <strong>{formaterFCFA(r.totalAvoirsRecus)}</strong>
              </td>
              <td className="nombre montant">
                <strong>{formaterFCFA(r.totalRegle)}</strong>
              </td>
              <td className="nombre montant">
                <strong>{texteResteDu(r.totalResteDu)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function OngletResultat({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportResultat>(() => appel('rapports:resultat', periode), cle)
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  return (
    <>
      <EnteteOnglet demande={() => exportResultat(r)}>
        Résultat {textePeriode(r)} = marge brute des ventes − dépenses.
      </EnteteOnglet>
      <div className="tableau-cadre">
        <table className="tableau">
          <tbody>
            <tr>
              <td>Marge brute des ventes</td>
              <td className="nombre montant">
                {r.marge === null ? (
                  <span className="detail">{EN_ATTENTE_VENTES}</span>
                ) : (
                  formaterFCFA(r.marge)
                )}
              </td>
            </tr>
            <tr>
              <td>Dépenses</td>
              <td className="nombre montant">− {formaterFCFA(r.depenses)}</td>
            </tr>
            <tr>
              <td>
                <strong>Résultat</strong>
              </td>
              <td className="nombre montant">
                {r.resultat === null ? (
                  <span className="detail">{EN_ATTENTE_VENTES}</span>
                ) : (
                  <strong>{formaterFCFA(r.resultat)}</strong>
                )}
              </td>
            </tr>
            <tr>
              <td>
                Pertes de la période
                <span className="detail">Pour information : voir l’onglet « Pertes »</span>
              </td>
              <td className="nombre montant">{formaterFCFA(r.pertes)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
