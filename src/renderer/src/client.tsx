/**
 * Écran client (11,6″). Propriétaire : Dev A (tâche A13 — version finale en Phase 3).
 * Affiche en direct le panier envoyé par la caisse via window.pos.envoyerPanierClient().
 */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { PanierClient } from '@shared/types'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import './ui/styles.css'

function EcranClient(): React.JSX.Element {
  const [panier, setPanier] = useState<PanierClient>({ lignes: [], total: 0 })

  useEffect(() => window.pos.surPanierClient((d) => setPanier(d as PanierClient)), [])

  return (
    <div className="ecran-client">
      <h1>Ma Boutique</h1>
      {panier.lignes.length === 0 ? (
        <p className="ecran-client-accueil">{panier.message ?? 'Bienvenue'}</p>
      ) : (
        <ul className="ecran-client-lignes">
          {panier.lignes.map((l, i) => (
            <li key={i}>
              <span>{formaterQuantite(l.quantite)} ×</span>
              <span>{l.designation}</span>
              <span className="montant">{formaterFCFA(l.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ecran-client-total">
        <span>Total</span>
        <span className="montant">{formaterFCFA(panier.total)}</span>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <EcranClient />
  </React.StrictMode>
)
