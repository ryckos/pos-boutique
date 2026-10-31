/**
 * Écran client (11,6″). Propriétaire : Dev A (tâche A13, UI_UX § 5.5).
 * Affiche en direct le panier envoyé par la caisse via window.pos.envoyerPanierClient() : accueil au
 * repos, lignes et total pendant la vente, puis « Merci » et la monnaie quelques secondes.
 */
import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { PanierClient } from '@shared/types'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { DUREE_FIN_VENTE_MS, nombreArticles, vueEcranClient } from './modules/caisse/ecran-client'
import './ui/styles.css'

function EcranClient(): React.JSX.Element {
  const [panier, setPanier] = useState<PanierClient>({ lignes: [], total: 0 })
  const [finExpiree, setFinExpiree] = useState(false)
  const liste = useRef<HTMLUListElement>(null)

  useEffect(() => window.pos.surPanierClient((d) => setPanier(d as PanierClient)), [])

  // Chaque nouvelle fin de vente repart pour toute la durée ; l'accueil revient ensuite.
  // La clé évite de relancer le délai quand la caisse renvoie le même état.
  const fin = panier.fin
  const cleFin = fin ? JSON.stringify(fin) : null
  useEffect(() => {
    setFinExpiree(false)
    if (!cleFin) return
    const minuteur = setTimeout(() => setFinExpiree(true), DUREE_FIN_VENTE_MS)
    return () => clearTimeout(minuteur)
  }, [cleFin])

  // Ticket long : le client voit toujours les dernières lignes ajoutées.
  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight })
  }, [panier.lignes.length])

  const vue = vueEcranClient(panier, finExpiree)
  const boutique = panier.boutique ?? 'Ma Boutique'

  return (
    <div className="ecran-client">
      <h1>{boutique}</h1>
      {vue === 'accueil' && <p className="ecran-client-accueil">{panier.message ?? 'Bienvenue'}</p>}
      {vue === 'fin' && fin && (
        <div className="ecran-client-fin">
          <p className="ecran-client-merci">Merci et à bientôt !</p>
          <dl>
            <dt>Total</dt>
            <dd className="montant">{formaterFCFA(fin.total)}</dd>
            {fin.recu !== undefined && (
              <>
                <dt>Reçu</dt>
                <dd className="montant">{formaterFCFA(fin.recu)}</dd>
              </>
            )}
          </dl>
          {fin.monnaieRendue > 0 && (
            <div className="ecran-client-monnaie">
              <span>Monnaie à vous rendre</span>
              <span className="montant">{formaterFCFA(fin.monnaieRendue)}</span>
            </div>
          )}
          {fin.credit && (
            <p className="ecran-client-credit">
              {formaterFCFA(fin.credit.montant)} à régler avant le {formaterDate(fin.credit.echeance)}
            </p>
          )}
        </div>
      )}
      {vue === 'panier' && (
        <>
          <ul className="ecran-client-lignes" ref={liste}>
            {panier.lignes.map((l, i) => (
              <li key={i}>
                <span>{formaterQuantite(l.quantite)} ×</span>
                <span>{l.designation}</span>
                <span className="montant">{formaterFCFA(l.total)}</span>
                {!!l.remise && (
                  <span className="ecran-client-remise">Remise : −{formaterFCFA(l.remise)}</span>
                )}
              </li>
            ))}
            {!!panier.remiseTicket && (
              <li className="ecran-client-remise-ticket">
                <span />
                <span>Remise sur le ticket</span>
                <span className="montant">−{formaterFCFA(panier.remiseTicket)}</span>
              </li>
            )}
          </ul>
          <div className="ecran-client-total">
            <span>
              Total{' '}
              <small>
                {nombreArticles(panier)} article{nombreArticles(panier) > 1 ? 's' : ''}
              </small>
            </span>
            <span className="montant">{formaterFCFA(panier.total)}</span>
          </div>
        </>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <EcranClient />
  </React.StrictMode>
)
