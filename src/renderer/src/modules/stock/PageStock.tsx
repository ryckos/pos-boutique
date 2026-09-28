/**
 * Écran stock (B4, REGLES_METIER § 3.3, UI_UX § 5.16). Propriétaire : Dev B.
 * Gérant. Le stock de chaque produit, sa valeur au coût moyen, les ruptures, les stocks bas et les
 * produits dormants. La répartition par conditionnement est indicative.
 */
import { useCallback, useEffect, useState } from 'react'
import type { EtatStock, LigneStock } from '@shared/ipc/stock'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { normaliserRecherche } from '@shared/texte'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreHistorique } from './FenetreHistorique'
import { texteRepartition } from './affichageStock'

type Filtre = 'tous' | 'alertes' | 'dormants'

const NIVEAUX: Record<LigneStock['niveau'], { texte: string; classe: string } | null> = {
  rupture: { texte: 'Rupture', classe: 'pastille-erreur' },
  stock_bas: { texte: 'Stock bas', classe: 'pastille-alerte' },
  normal: null
}

/** Coût moyen à 0,1 F près : le CUMP n'est pas un montant payé, il peut valoir 262,8. */
const texteCump = (cump: number): string => `${formaterQuantite(Math.round(cump * 10) / 10)} F`

export function PageStock(): React.JSX.Element {
  const [etat, setEtat] = useState<EtatStock | null>(null)
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [rayon, setRayon] = useState('')
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [historique, setHistorique] = useState<LigneStock | null>(null)

  const charger = useCallback(() => {
    appel('stock:etat')
      .then(setEtat)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  // Un scan affiche le produit scanné, quel que soit le filtre.
  const traiterCode = (code: string): void => {
    setErreur(null)
    appel('catalogue:rechercherCode', { code })
      .then((article) => {
        const ligne = article && etat?.lignes.find((l) => l.produitId === article.produitId)
        if (ligne) {
          setFiltre('tous')
          setRayon('')
          setRecherche(ligne.nom)
        } else {
          setRecherche('')
          setErreur(`Code ${code} inconnu : ce produit n’est pas au catalogue (page Produits).`)
        }
      })
      .catch((e: Error) => setErreur(e.message))
  }
  useScanner(traiterCode, { actif: historique === null })

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const code = recherche.trim()
    if (e.key === 'Enter' && /^\d+$/.test(code)) {
      e.preventDefault()
      traiterCode(code)
    }
  }

  const lignes = etat?.lignes ?? []
  const rayons = [...new Set(lignes.map((l) => l.rayon).filter((r): r is string => r !== null))].sort(
    (a, b) => a.localeCompare(b, 'fr')
  )
  const cle = normaliserRecherche(recherche.trim())
  const visibles = lignes.filter(
    (l) =>
      (filtre === 'tous' ||
        (filtre === 'alertes' && l.niveau !== 'normal') ||
        (filtre === 'dormants' && l.dormant)) &&
      (rayon === '' || l.rayon === rayon) &&
      (cle === '' || normaliserRecherche(l.nom).includes(cle))
  )

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Stock</h1>
        {etat && (
          <div className="tableau-actions">
            {etat.nbRuptures > 0 && (
              <span className="pastille pastille-erreur">{etat.nbRuptures} en rupture</span>
            )}
            {etat.nbStockBas > 0 && (
              <span className="pastille pastille-alerte">{etat.nbStockBas} en stock bas</span>
            )}
            {etat.nbDormants > 0 && (
              <span className="pastille pastille-inactif">
                {etat.nbDormants} {etat.nbDormants > 1 ? 'dormants' : 'dormant'}
              </span>
            )}
            <span className="montant">Valeur : {formaterFCFA(etat.valeurTotale)}</span>
          </div>
        )}
      </header>

      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {historique && (
        <FenetreHistorique
          produitId={historique.produitId}
          nom={historique.nom}
          onFermer={() => setHistorique(null)}
        />
      )}

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
          Rayon
          <select value={rayon} onChange={(e) => setRayon(e.target.value)}>
            <option value="">Tous les rayons</option>
            {rayons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          Afficher
          <select value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
            <option value="tous">Tous les produits</option>
            <option value="alertes">Ruptures et stocks bas</option>
            <option value="dormants">Dormants ({etat?.dormantJours ?? 60} jours sans vente)</option>
          </select>
        </label>
      </div>

      {etat === null ? null : visibles.length === 0 ? (
        <p className="vide">
          {filtre === 'alertes' && etat.nbRuptures + etat.nbStockBas === 0
            ? 'Aucun produit en rupture ni en stock bas.'
            : filtre === 'dormants' && etat.nbDormants === 0
              ? `Aucun produit dormant : tout ce qui est en stock s’est vendu depuis moins de ${etat.dormantJours} jours.`
              : 'Aucun produit ne correspond à ces filtres.'}
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Rayon</th>
                <th className="nombre">Stock</th>
                <th className="nombre">Seuil</th>
                <th className="nombre">Coût moyen</th>
                <th className="nombre">Valeur</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => {
                const niveau = NIVEAUX[l.niveau]
                return (
                  <tr key={l.produitId}>
                    <td>{l.nom}</td>
                    <td>{l.rayon ?? 'Non classé'}</td>
                    <td className="nombre">
                      <strong>{formaterQuantite(l.stock)}</strong>
                      {l.repartition && <span className="detail">{texteRepartition(l.repartition)}</span>}
                    </td>
                    <td className="nombre">{formaterQuantite(l.seuil)}</td>
                    <td className="nombre montant">{texteCump(l.cump)}</td>
                    <td className="nombre montant">{formaterFCFA(l.valeur)}</td>
                    <td>
                      {niveau && <span className={`pastille ${niveau.classe}`}>{niveau.texte}</span>}
                      {l.dormant && <span className="pastille pastille-inactif">Dormant</span>}
                      {l.dormant && (
                        <span className="detail">
                          {l.derniereVente
                            ? `Dernière vente le ${formaterDate(l.derniereVente)}`
                            : 'Jamais vendu'}
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-secondaire" onClick={() => setHistorique(l)}>
                        Historique
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
