/**
 * Tableau de bord d'accueil du gérant : ventes du jour, caisses ouvertes, alertes de stock et de
 * péremption. Propriétaire : Dev A (A15, UI_UX § 5.27). Lecture seule, rafraîchi chaque minute.
 *
 * Chaque carte se charge seule : une carte en erreur n'empêche pas les autres de s'afficher.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SyntheseAccueil } from '@shared/ipc/rapports-ventes'
import type { AlertesAccueil } from '@shared/ipc/stock'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { delaiLot, depuisQuand, detailProduit, phrasePeremptions, phraseStock, pluriel } from './accueil'

const RAFRAICHISSEMENT_MS = 60_000

/** Charge une donnée maintenant, puis chaque minute ; l'erreur est un message pour l'utilisateur. */
function useDonnees<T>(charger: () => Promise<T>): { donnees: T | null; erreur: string | null } {
  const [donnees, setDonnees] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => {
    let actif = true
    const lire = (): void => {
      charger()
        .then((d) => {
          if (!actif) return
          setDonnees(d)
          setErreur(null)
        })
        .catch((e: Error) => actif && setErreur(e.message))
    }
    lire()
    const minuteur = setInterval(lire, RAFRAICHISSEMENT_MS)
    return () => {
      actif = false
      clearInterval(minuteur)
    }
    // `charger` change à chaque rendu : le relancer en boucle serait une erreur.
  }, [])
  return { donnees, erreur }
}

function Chargement({ erreur }: { erreur: string | null }): React.JSX.Element {
  return erreur ? (
    <p className="alerte" role="alert">
      {erreur}
    </p>
  ) : (
    <p className="vide">Chargement…</p>
  )
}

export function PageAccueil(): React.JSX.Element {
  const synthese = useDonnees<SyntheseAccueil>(() => appel('rapports-ventes:accueil'))
  const alertes = useDonnees<AlertesAccueil>(() => appel('stock:alertesAccueil'))

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Accueil</h1>
      </header>
      <div className="accueil-grille">
        <CarteVentes {...synthese} />
        <CarteCaisses {...synthese} />
        <CarteStock {...alertes} />
        <CartePeremptions {...alertes} />
      </div>
    </div>
  )
}

interface Etat<T> {
  donnees: T | null
  erreur: string | null
}

function CarteVentes({ donnees: s, erreur }: Etat<SyntheseAccueil>): React.JSX.Element {
  return (
    <section className="panneau accueil-carte">
      <h2>Ventes du jour</h2>
      {!s ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <p className="accueil-chiffre montant">{formaterFCFA(s.aujourdhui.chiffreAffaires)}</p>
          <p className="accueil-detail">
            {pluriel(s.aujourdhui.nbTickets, 'ticket')} · panier moyen{' '}
            <span className="montant">{formaterFCFA(s.aujourdhui.panierMoyen)}</span>
          </p>
          <p className="accueil-hier">
            Hier ({formaterDate(s.hier.jour)}) :{' '}
            <span className="montant">{formaterFCFA(s.hier.chiffreAffaires)}</span>,{' '}
            {pluriel(s.hier.nbTickets, 'ticket')}
          </p>
          <p className="accueil-note">Retours déduits du chiffre d’affaires.</p>
        </>
      )}
    </section>
  )
}

function CarteCaisses({ donnees: s, erreur }: Etat<SyntheseAccueil>): React.JSX.Element {
  return (
    <section className="panneau accueil-carte">
      <h2>Caisses ouvertes</h2>
      {!s ? (
        <Chargement erreur={erreur} />
      ) : s.caissesOuvertes.length === 0 ? (
        <p className="vide">Aucune caisse ouverte.</p>
      ) : (
        <ul className="accueil-liste">
          {s.caissesOuvertes.map((c) => {
            const depuis = depuisQuand(c.dateOuverture, s.aujourdhui.jour)
            return (
              <li key={c.id}>
                <span>{c.caissier}</span>
                <span className={depuis.ancienne ? 'accueil-ancienne' : undefined}>
                  {depuis.texte}
                  {depuis.ancienne && <span className="pastille pastille-alerte">À clôturer ?</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="accueil-lien">
        <Link to="/cloture">Clôture de caisse</Link>
      </p>
    </section>
  )
}

function CarteStock({ donnees: a, erreur }: Etat<AlertesAccueil>): React.JSX.Element {
  return (
    <section className="panneau accueil-carte">
      <h2>Stock</h2>
      {!a ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <p className="accueil-detail">{phraseStock(a.stock)}</p>
          {a.stock.produits.length > 0 && (
            <ul className="accueil-liste">
              {a.stock.produits.map((p) => (
                <li key={p.produitId}>
                  <span>{p.nom}</span>
                  <span className={p.niveau === 'rupture' ? 'accueil-rupture' : undefined}>
                    {detailProduit(p)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="accueil-lien">
        <Link to="/stock">Voir le stock</Link>
      </p>
    </section>
  )
}

function CartePeremptions({ donnees: a, erreur }: Etat<AlertesAccueil>): React.JSX.Element {
  return (
    <section className="panneau accueil-carte">
      <h2>Péremptions</h2>
      {!a ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <p className="accueil-detail">{phrasePeremptions(a.peremptions)}</p>
          {a.peremptions.lots.length > 0 && (
            <>
              <ul className="accueil-liste">
                {a.peremptions.lots.map((l) => (
                  <li key={l.lotId}>
                    <span>{l.produit}</span>
                    <span className={l.joursRestants < 0 ? 'accueil-rupture' : undefined}>{delaiLot(l)}</span>
                  </li>
                ))}
              </ul>
              <p className="accueil-note">
                Valeur en jeu sous {a.peremptions.horizonJours} jours :{' '}
                <span className="montant">{formaterFCFA(a.peremptions.valeurEnJeu)}</span>
              </p>
            </>
          )}
        </>
      )}
      <p className="accueil-lien">
        <Link to="/peremptions">Voir les péremptions</Link>
      </p>
    </section>
  )
}
