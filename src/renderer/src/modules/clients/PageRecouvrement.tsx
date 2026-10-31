/**
 * Recouvrement : ce que les clients doivent, depuis combien de temps, et qui relancer (A12,
 * REGLES_METIER § 7.3). Propriétaire : Dev A. Gérant seulement ; la caissière encaisse depuis la page
 * Clients. Le paiement lui-même se fait dans la fiche du client.
 */
import { useCallback, useEffect, useState } from 'react'
import type { BalanceAgee, LigneRelance } from '@shared/ipc/clients'
import { formaterDate, formaterFCFA } from '@shared/format'
import { LIBELLES_TRANCHE } from '@shared/recouvrement'
import { appel } from '@renderer/lib/api'
import { Icone } from '@renderer/ui/Icone'

type Onglet = 'balance' | 'relance'

export function PageRecouvrement(): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('relance')
  const [balance, setBalance] = useState<BalanceAgee | null>(null)
  const [relance, setRelance] = useState<LigneRelance[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [impression, setImpression] = useState(false)

  const charger = useCallback(() => {
    Promise.all([appel('clients:balanceAgee'), appel('clients:listeRelance')])
      .then(([b, r]) => {
        setBalance(b)
        setRelance(r)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const imprimer = async (): Promise<void> => {
    setImpression(true)
    setErreur(null)
    setSucces(null)
    try {
      await appel('clients:imprimerRelance')
      setSucces('Liste de relance envoyée à l’imprimante.')
    } catch (e) {
      setErreur(`${(e as Error).message} La liste reste affichée ici.`)
    } finally {
      setImpression(false)
    }
  }

  const totaux = balance?.totaux
  const montantEchu = relance.reduce((s, c) => s + c.montantEchu, 0)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Recouvrement</h1>
        <div className="page-entete-actions">
          <span className="chiffre-cle">
            Reste à encaisser : <span className="montant">{formaterFCFA(totaux?.total ?? 0)}</span>
          </span>
          {montantEchu > 0 && (
            <span className="pastille pastille-erreur">En retard : {formaterFCFA(montantEchu)}</span>
          )}
          <button
            className="btn"
            onClick={() => void imprimer()}
            disabled={impression || relance.length === 0}
          >
            <Icone nom="imprimer" />
            Imprimer la liste de relance
          </button>
        </div>
      </header>

      <div className="onglets" role="tablist">
        <button
          role="tab"
          aria-selected={onglet === 'relance'}
          className={onglet === 'relance' ? 'onglet actif' : 'onglet'}
          onClick={() => setOnglet('relance')}
        >
          À relancer ({relance.length})
        </button>
        <button
          role="tab"
          aria-selected={onglet === 'balance'}
          className={onglet === 'balance' ? 'onglet actif' : 'onglet'}
          onClick={() => setOnglet('balance')}
        >
          Balance âgée
        </button>
      </div>

      {succes && (
        <p className="succes page-message" role="status">
          {succes}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {onglet === 'relance' &&
        (relance.length === 0 ? (
          <p className="vide">Aucun client en retard. Rien à relancer aujourd’hui.</p>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Tickets en retard</th>
                  <th className="nombre">En retard</th>
                  <th className="nombre">Retard</th>
                  <th>Ancienneté</th>
                </tr>
              </thead>
              <tbody>
                {relance.map((c) => (
                  <tr key={c.clientId}>
                    <td className="cellule-titre">
                      {c.client}
                      {c.total > c.montantEchu && (
                        <div className="detail">Doit {formaterFCFA(c.total)} en tout</div>
                      )}
                    </td>
                    <td>{c.telephone ?? '—'}</td>
                    <td>
                      {c.creances.map((x) => (
                        <div key={x.numeroTicket} className="detail">
                          {x.numeroTicket} — {formaterFCFA(x.restantDu)}, échu le{' '}
                          {formaterDate(x.dateEcheance)}
                        </div>
                      ))}
                    </td>
                    <td className="nombre montant">{formaterFCFA(c.montantEchu)}</td>
                    <td className="nombre">{c.joursRetard} j</td>
                    <td>
                      <span className="pastille pastille-erreur">{LIBELLES_TRANCHE[c.tranche]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {onglet === 'balance' &&
        (!balance || balance.lignes.length === 0 ? (
          <p className="vide">Aucun client ne doit d’argent.</p>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="nombre">{LIBELLES_TRANCHE.jusqu30}</th>
                  <th className="nombre">{LIBELLES_TRANCHE.de31a60}</th>
                  <th className="nombre">{LIBELLES_TRANCHE.plus60}</th>
                  <th className="nombre">Total dû</th>
                </tr>
              </thead>
              <tbody>
                {balance.lignes.map((l) => (
                  <tr key={l.clientId}>
                    <td className="cellule-titre">
                      {l.client}
                      {l.enRetard > 0 && (
                        <div className="detail">
                          <span className="pastille pastille-erreur">
                            En retard : {formaterFCFA(l.enRetard)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="nombre montant">{formaterFCFA(l.jusqu30)}</td>
                    <td className="nombre montant">{formaterFCFA(l.de31a60)}</td>
                    <td className="nombre montant">{formaterFCFA(l.plus60)}</td>
                    <td className="nombre montant">{formaterFCFA(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="nombre montant">{formaterFCFA(balance.totaux.jusqu30)}</th>
                  <th className="nombre montant">{formaterFCFA(balance.totaux.de31a60)}</th>
                  <th className="nombre montant">{formaterFCFA(balance.totaux.plus60)}</th>
                  <th className="nombre montant">{formaterFCFA(balance.totaux.total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      <p className="vide note-bas">
        L’ancienneté se compte depuis la date de la vente à crédit. Pour encaisser un paiement, ouvrez la page
        Clients.
      </p>
    </div>
  )
}
