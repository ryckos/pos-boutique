/**
 * Propriétaire : Dev B.
 * Aperçu du socle : produits et stock calculé. Écrans complets : tâches B2 et B4.
 */
import { useEffect, useState } from 'react'
import type { ProduitStock } from '@shared/types'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'

export function PageCatalogue(): React.JSX.Element {
  const [produits, setProduits] = useState<ProduitStock[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    appel('catalogue:produitsStock').then(setProduits).catch((e: Error) => setErreur(e.message))
  }, [])

  const valeurTotale = produits.reduce((s, p) => s + p.valeurStock, 0)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Produits et stock</h1>
        <p>
          Valeur du stock : <strong className="montant">{formaterFCFA(valeurTotale)}</strong>
        </p>
      </header>
      {erreur && <p className="alerte">{erreur}</p>}
      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Produit</th>
              <th className="nombre">Stock</th>
              <th className="nombre">Seuil</th>
              <th className="nombre">Valeur</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td className="nombre">{formaterQuantite(p.stockActuel)}</td>
                <td className="nombre">{formaterQuantite(p.seuilAlerte)}</td>
                <td className="nombre montant">{formaterFCFA(p.valeurStock)}</td>
                <td>{p.enAlerte && <span className="pastille pastille-alerte">À réapprovisionner</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
