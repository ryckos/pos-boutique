/** Détail d'une réception validée, en lecture seule (B8). Propriétaire : Dev B. */
import { useEffect } from 'react'
import type { Reception } from '@shared/ipc/achats'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'

export function FenetreDetailReception(props: {
  reception: Reception
  onFermer: () => void
}): React.JSX.Element {
  const r = props.reception
  const { onFermer } = props
  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div className="voile">
      <section className="fenetre fenetre-formulaire fenetre-large" role="dialog" aria-modal="true">
        <div className="fenetre-entete">
          <h2>Réception {r.numero}</h2>
          <span className="pastille pastille-ok">{formaterFCFA(r.total)}</span>
        </div>
        <p className="vide">
          {r.fournisseur} · reçue le {formaterDate(r.dateReception)} par {r.utilisateur}
          {r.dateEcheance && ` · à payer avant le ${formaterDate(r.dateEcheance)}`}
          {r.commande && ` · livre la commande ${r.commande}`}
          {r.commentaire && ` · ${r.commentaire}`}
        </p>
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Article</th>
                <th className="nombre">Qté reçue</th>
                <th className="nombre">Prix d’achat</th>
                <th className="nombre">Total</th>
              </tr>
            </thead>
            <tbody>
              {r.lignes.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.produit} — {l.conditionnement}
                    {l.quantiteBase !== l.quantite && (
                      <span className="detail">
                        = {formaterQuantite(l.quantiteBase)} à {formaterFCFA(l.coutBase)} l’unité
                      </span>
                    )}
                    {l.numeroLot && (
                      <span className="detail">
                        Lot {l.numeroLot}
                        {l.datePeremption && ` · périme le ${formaterDate(l.datePeremption)}`}
                      </span>
                    )}
                  </td>
                  <td className="nombre">{formaterQuantite(l.quantite)}</td>
                  <td className="nombre montant">{formaterFCFA(l.prix)}</td>
                  <td className="nombre montant">{formaterFCFA(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="formulaire-actions">
          <button className="btn btn-secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>
    </div>
  )
}
