/**
 * Achats d'un fournisseur (B7 partie 2, REGLES_METIER § 4.6, UI_UX § 5.17). Propriétaire : Dev B.
 * Les livraisons d'une période (90 derniers jours par défaut) et le dernier prix payé pour chaque
 * article, comparé à la livraison précédente de ce fournisseur.
 */
import { useCallback, useEffect, useState } from 'react'
import type { AchatsFournisseur } from '@shared/ipc/fournisseurs'
import type { Reception } from '@shared/ipc/achats'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { FenetreDetailReception } from '@renderer/modules/achats/FenetreDetailReception'

interface Props {
  fournisseurId: number
  nom: string
  onFermer: () => void
}

/** « +600 F (+10 %) », « −300 F (−5 %) », « = » ; vide s'il n'y a qu'un achat. */
function texteEcart(ecart: number | null, pourcent: number | null): string {
  if (ecart === null || pourcent === null) return ''
  if (ecart === 0) return 'inchangé'
  const signe = ecart > 0 ? '+' : '−'
  return `${signe}${formaterFCFA(Math.abs(ecart))} (${signe}${formaterQuantite(Math.abs(pourcent))} %)`
}

export function FenetreAchats({ fournisseurId, nom, onFermer }: Props): React.JSX.Element {
  const [achats, setAchats] = useState<AchatsFournisseur | null>(null)
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [detail, setDetail] = useState<Reception | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(
    async (periode: { du?: string; au?: string }) => {
      const a = await appel('fournisseurs:achats', { fournisseurId, ...periode })
      setAchats(a)
      setDu(a.du)
      setAu(a.au)
      setErreur(null)
    },
    [fournisseurId]
  )
  useEffect(() => {
    charger({}).catch((e: Error) => setErreur(e.message))
  }, [charger])

  const ouvrirDetail = (id: number): void => {
    appel('achats:reception', { id })
      .then(setDetail)
      .catch((e: Error) => setErreur(e.message))
  }

  if (detail) return <FenetreDetailReception reception={detail} onFermer={() => setDetail(null)} />

  return (
    <FenetreFormulaire
      titre={`Achats — ${nom}`}
      pastille={
        achats && (
          <span className="pastille pastille-ok">
            Livré sur la période : {formaterFCFA(achats.totalPeriode)}
          </span>
        )
      }
      libelleValider="Afficher la période"
      valide={du !== '' && au !== '' && du <= au}
      large
      onValider={() => charger({ du, au })}
      onFermer={onFermer}
    >
      <div className="filtres">
        <label className="champ">
          Du
          <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)} />
        </label>
        <label className="champ">
          Au
          <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} />
        </label>
      </div>
      {erreur && (
        <p className="alerte formulaire-bloc" role="alert">
          {erreur}
        </p>
      )}

      {achats && (
        <div className="formulaire-bloc">
          <h3>Livraisons</h3>
          {achats.receptions.length === 0 ? (
            <p className="vide">Aucune livraison sur cette période.</p>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th className="nombre">Articles</th>
                    <th className="nombre">Total</th>
                    <th>À payer avant le</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {achats.receptions.map((r) => (
                    <tr key={r.id}>
                      <td>{r.numero}</td>
                      <td>{formaterDate(r.dateReception)}</td>
                      <td className="nombre">{r.nbLignes}</td>
                      <td className="nombre montant">{formaterFCFA(r.total)}</td>
                      <td>{r.dateEcheance ? formaterDate(r.dateEcheance) : ''}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondaire"
                          onClick={() => ouvrirDetail(r.id)}
                        >
                          Voir le détail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3>Prix d’achat</h3>
          {achats.prix.length === 0 ? (
            <p className="vide">Aucun achat enregistré chez ce fournisseur.</p>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th className="nombre">Dernier prix</th>
                    <th className="nombre">Livraison précédente</th>
                    <th className="nombre">Écart</th>
                    <th className="nombre">Achats</th>
                  </tr>
                </thead>
                <tbody>
                  {achats.prix.map((p) => (
                    <tr key={`${p.produitId}-${p.conditionnement}`}>
                      <td>
                        {p.produit} — {p.conditionnement}
                        <span className="detail">
                          le {formaterDate(p.dateDernierPrix)}
                          {p.quantiteBase !== 1 && ` · ${formaterFCFA(p.coutBase)} l’unité`}
                        </span>
                      </td>
                      <td className="nombre montant">{formaterFCFA(p.dernierPrix)}</td>
                      <td className="nombre montant">
                        {p.prixPrecedent !== null ? formaterFCFA(p.prixPrecedent) : ''}
                      </td>
                      <td className="nombre">
                        {p.ecart !== null && p.ecart > 0 ? (
                          <span className="pastille pastille-alerte">
                            {texteEcart(p.ecart, p.ecartPourcent)}
                          </span>
                        ) : (
                          texteEcart(p.ecart, p.ecartPourcent)
                        )}
                      </td>
                      <td className="nombre">{p.nbReceptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </FenetreFormulaire>
  )
}
