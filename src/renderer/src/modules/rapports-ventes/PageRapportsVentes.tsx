/**
 * Rapports de ventes et de caisse : par heure, par caissier, top et flop des produits, historique
 * des sessions. Propriétaire : Dev A (A14, UI_UX § 5.26). Gérant, lecture seule.
 */
import { useEffect, useState } from 'react'
import type { PeriodeRapport } from '@shared/ipc/rapports-gestion'
import type {
  CritereClassement,
  ProduitClasse,
  RapportClassementProduits,
  RapportSessions,
  RapportVentesParCaissier,
  RapportVentesParHeure
} from '@shared/ipc/rapports-ventes'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { Icone } from '@renderer/ui/Icone'
import { dateHeure } from '../caisse/cloture'
import {
  CRITERES,
  largeurBarre,
  libelleHeure,
  meilleureHeure,
  texteEcart,
  tonDeEcart
} from './rapports-ventes'

type Onglet = 'heures' | 'caissiers' | 'produits' | 'sessions'

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'heures', libelle: 'Par heure' },
  { cle: 'caissiers', libelle: 'Par caissier' },
  { cle: 'produits', libelle: 'Produits' },
  { cle: 'sessions', libelle: 'Sessions de caisse' }
]

/** Recharge le rapport à chaque changement de période ou de critère ; l'erreur est un message clair. */
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
    // `cle` résume la demande : `charger` change à chaque rendu, la recharger en boucle serait une erreur.
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

function textePeriode(r: { du: string; au: string }): string {
  const jour = (d: string): string => d.split('-').reverse().join('/')
  return r.du === r.au ? `le ${jour(r.du)}` : `du ${jour(r.du)} au ${jour(r.au)}`
}

interface ProprietesPeriode {
  periode: PeriodeRapport
  cle: string
}

export function PageRapportsVentes(): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('heures')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const periode: PeriodeRapport = { du: du || null, au: au || null }
  const cle = `${du}|${au}`

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Rapports de ventes</h1>
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

      {onglet === 'heures' && <OngletHeures periode={periode} cle={cle} />}
      {onglet === 'caissiers' && <OngletCaissiers periode={periode} cle={cle} />}
      {onglet === 'produits' && <OngletProduits periode={periode} cle={cle} />}
      {onglet === 'sessions' && <OngletSessions periode={periode} cle={cle} />}
    </div>
  )
}

function OngletHeures({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportVentesParHeure>(
    () => appel('rapports-ventes:parHeure', periode),
    cle
  )
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  if (r.lignes.length === 0) return <p className="vide">Aucune vente {textePeriode(r)}.</p>
  const meilleure = meilleureHeure(r.lignes)!
  return (
    <>
      <div className="entete-onglet">
        <p>
          {r.nbTickets} ticket{r.nbTickets > 1 ? 's' : ''} {textePeriode(r)} :{' '}
          <span className="montant">{formaterFCFA(r.chiffreAffaires)}</span>
          <span className="detail">
            Heure la plus forte : {libelleHeure(meilleure.heure)} ({formaterFCFA(meilleure.chiffreAffaires)}).
            Les retours ne sont pas comptés ici.
          </span>
        </p>
      </div>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Heure</th>
              <th className="nombre">Tickets</th>
              <th className="nombre">Chiffre d’affaires</th>
              <th className="nombre">Panier moyen</th>
              <th aria-label="Part de la meilleure heure" />
            </tr>
          </thead>
          <tbody>
            {r.lignes.map((l) => (
              <tr key={l.heure}>
                <td>{libelleHeure(l.heure)}</td>
                <td className="nombre">{l.nbTickets}</td>
                <td className="nombre montant">{formaterFCFA(l.chiffreAffaires)}</td>
                <td className="nombre montant">{formaterFCFA(l.panierMoyen)}</td>
                <td className="barre-cellule">
                  <span
                    className="barre-heure"
                    style={{ width: `${largeurBarre(l.chiffreAffaires, meilleure.chiffreAffaires)}%` }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function OngletCaissiers({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportVentesParCaissier>(
    () => appel('rapports-ventes:parCaissier', periode),
    cle
  )
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  if (r.lignes.length === 0) return <p className="vide">Aucune vente {textePeriode(r)}.</p>
  return (
    <>
      <div className="entete-onglet">
        <p>
          Ventes {textePeriode(r)}, par personne.
          <span className="detail">
            Un retour est compté au nom de la personne qui l’a saisi. Le chiffre d’affaires est net des
            retours.
          </span>
        </p>
      </div>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Caissier</th>
              <th className="nombre">Tickets</th>
              <th className="nombre">Ventes</th>
              <th className="nombre">Retours</th>
              <th className="nombre">Chiffre d’affaires</th>
              <th className="nombre">Panier moyen</th>
              <th className="nombre">Remises</th>
              <th className="nombre">Tickets annulés</th>
            </tr>
          </thead>
          <tbody>
            {r.lignes.map((l) => (
              <tr key={l.utilisateurId}>
                <td>{l.caissier}</td>
                <td className="nombre">{l.nbTickets}</td>
                <td className="nombre montant">{formaterFCFA(l.ventesTtc)}</td>
                <td className="nombre montant">{formaterFCFA(l.retoursTtc)}</td>
                <td className="nombre montant">
                  <strong>{formaterFCFA(l.chiffreAffaires)}</strong>
                </td>
                <td className="nombre montant">{formaterFCFA(l.panierMoyen)}</td>
                <td className="nombre montant">{formaterFCFA(l.remises)}</td>
                <td className="nombre">
                  {l.nbAnnules === 0 ? '0' : `${l.nbAnnules} (${formaterFCFA(l.montantAnnules)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function OngletProduits({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const [critere, setCritere] = useState<CritereClassement>('chiffreAffaires')
  const { donnees: r, erreur } = useRapport<RapportClassementProduits>(
    () => appel('rapports-ventes:produits', { ...periode, critere }),
    `${cle}|${critere}`
  )
  return (
    <>
      <div className="filtres">
        <label className="champ">
          Classer par
          <select value={critere} onChange={(e) => setCritere(e.target.value as CritereClassement)}>
            {CRITERES.map((c) => (
              <option key={c.cle} value={c.cle}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Erreur message={erreur} />
      {!erreur && !r && <p className="vide">Chargement…</p>}
      {r && r.nbProduits === 0 && <p className="vide">Aucune vente {textePeriode(r)}.</p>}
      {r && r.nbProduits > 0 && (
        <>
          <div className="entete-onglet">
            <p>
              {r.nbProduits} produit{r.nbProduits > 1 ? 's' : ''} vendu{r.nbProduits > 1 ? 's' : ''}{' '}
              {textePeriode(r)}.
              <span className="detail">
                Tous les conditionnements d’un produit sont additionnés (un carton de 24 compte pour 24), les
                retours sont déduits. La remise faite sur un ticket entier n’est pas répartie entre les
                produits.
              </span>
            </p>
          </div>
          <h2 className="titre-section">Les plus vendus</h2>
          <TableauProduits produits={r.top} />
          <h2 className="titre-section">Les moins vendus</h2>
          <TableauProduits produits={r.flop} />
        </>
      )}
    </>
  )
}

function TableauProduits({ produits }: { produits: ProduitClasse[] }): React.JSX.Element {
  return (
    <div className="tableau-cadre bloc-espace">
      <table className="tableau">
        <thead>
          <tr>
            <th>Produit</th>
            <th className="nombre">Quantité</th>
            <th className="nombre">Chiffre d’affaires</th>
            <th className="nombre">Marge</th>
          </tr>
        </thead>
        <tbody>
          {produits.map((p) => (
            <tr key={p.produitId}>
              <td>{p.produit}</td>
              <td className="nombre">{formaterQuantite(p.quantiteBase)}</td>
              <td className="nombre montant">{formaterFCFA(p.chiffreAffaires)}</td>
              <td className="nombre montant">{formaterFCFA(p.marge)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OngletSessions({ periode, cle }: ProprietesPeriode): React.JSX.Element {
  const { donnees: r, erreur } = useRapport<RapportSessions>(
    () => appel('rapports-ventes:sessions', periode),
    cle
  )
  if (erreur) return <Erreur message={erreur} />
  if (!r) return <p className="vide">Chargement…</p>
  if (r.lignes.length === 0) return <p className="vide">Aucune session de caisse {textePeriode(r)}.</p>
  const ton = tonDeEcart(r.nbCloturees > 0 ? r.totalEcarts : null)
  return (
    <>
      <div className="entete-onglet">
        <p>
          {r.lignes.length} session{r.lignes.length > 1 ? 's' : ''} {textePeriode(r)}. Écart total des
          sessions clôturées :{' '}
          <span className={ton ? `montant cloture-ecart-${ton} pastille-ecart` : 'montant'}>
            {texteEcart(r.nbCloturees > 0 ? r.totalEcarts : null, formaterFCFA)}
          </span>
        </p>
      </div>
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Caissier</th>
              <th>Ouverte le</th>
              <th>Clôturée le</th>
              <th className="nombre">Fond</th>
              <th className="nombre">Espèces attendues</th>
              <th className="nombre">Espèces comptées</th>
              <th className="nombre">Écart</th>
              <th>Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {r.lignes.map((s) => {
              const tonSession = tonDeEcart(s.ecart)
              return (
                <tr key={s.id}>
                  <td>{s.caissier}</td>
                  <td>{dateHeure(s.dateOuverture)}</td>
                  <td>
                    {s.dateFermeture ? (
                      dateHeure(s.dateFermeture)
                    ) : (
                      <span className="pastille pastille-info">En cours</span>
                    )}
                  </td>
                  <td className="nombre montant">{formaterFCFA(s.fondOuverture)}</td>
                  <td className="nombre montant">
                    {s.montantTheorique === null ? '—' : formaterFCFA(s.montantTheorique)}
                  </td>
                  <td className="nombre montant">
                    {s.montantCompte === null ? '—' : formaterFCFA(s.montantCompte)}
                  </td>
                  <td className="nombre montant">
                    {tonSession ? (
                      <span className={`cloture-ecart-${tonSession} pastille-ecart`}>
                        {texteEcart(s.ecart, formaterFCFA)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{s.commentaire ?? ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
