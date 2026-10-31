/**
 * Historique d'un client : ses crédits, ses paiements, les retours qui ont réduit sa dette, avec ce
 * qu'il devait après chaque ligne (A12, REGLES_METIER § 7.3). Propriétaire : Dev A.
 * Le gérant annule ici un paiement de la caisse encore ouverte.
 */
import { useCallback, useEffect, useState } from 'react'
import type { LigneHistoriqueClient } from '@shared/ipc/clients'
import { formaterDateHeure, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

export function FenetreHistorique(props: {
  clientId: number
  nom: string
  onFermer: () => void
  onMessage: (message: string) => void
}): React.JSX.Element {
  const [lignes, setLignes] = useState<LigneHistoriqueClient[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aAnnuler, setAAnnuler] = useState<string | null>(null)
  const [motif, setMotif] = useState('')

  const charger = useCallback(() => {
    appel('clients:historique', { clientId: props.clientId })
      .then(setLignes)
      .catch((e: Error) => setErreur(e.message))
  }, [props.clientId])

  useEffect(charger, [charger])

  if (aAnnuler) {
    return (
      <FenetreFormulaire
        titre={`Annuler le paiement ${aAnnuler}`}
        libelleValider="Annuler le paiement"
        attention
        valide={motif.trim() !== ''}
        onFermer={() => setAAnnuler(null)}
        onValider={async () => {
          await appel('clients:annulerEncaissement', { numeroRecu: aAnnuler, motif })
          props.onMessage(`Paiement ${aAnnuler} annulé : la dette de ${props.nom} est rétablie.`)
          setAAnnuler(null)
          setMotif('')
          charger()
        }}
      >
        <p className="vide formulaire-bloc">
          La dette du client revient et les espèces ressortent de votre tiroir. Le paiement reste dans
          l’historique.
        </p>
        <label className="champ champ-large">
          Motif
          <input
            placeholder="Ex. : montant saisi par erreur"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </label>
      </FenetreFormulaire>
    )
  }

  return (
    <div className="voile">
      <section
        className="fenetre fenetre-large"
        role="dialog"
        aria-modal="true"
        aria-label={`Historique de ${props.nom}`}
      >
        <div className="fenetre-entete">
          <h2>Historique de « {props.nom} »</h2>
        </div>
        {erreur && (
          <p className="alerte" role="alert">
            {erreur}
          </p>
        )}
        {lignes === null && !erreur && <p className="vide">Chargement…</p>}
        {lignes?.length === 0 && <p className="vide">Aucun crédit pour ce client.</p>}
        {lignes && lignes.length > 0 && (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opération</th>
                  <th className="nombre">Montant</th>
                  <th className="nombre">Il doit ensuite</th>
                  <th className="colonne-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{formaterDateHeure(l.date)}</td>
                    <td>{l.libelle}</td>
                    <td className="nombre montant">
                      {l.variation > 0 ? '+ ' : '− '}
                      {formaterFCFA(Math.abs(l.variation))}
                    </td>
                    <td className="nombre montant">{formaterFCFA(l.soldeApres)}</td>
                    <td className="colonne-actions">
                      {l.annulable && l.numeroRecu && (
                        <button
                          className="btn btn-secondaire"
                          onClick={() => setAAnnuler(l.numeroRecu)}
                          aria-label={`Annuler le paiement ${l.numeroRecu}`}
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn btn-secondaire" onClick={props.onFermer}>
          Fermer
        </button>
      </section>
    </div>
  )
}
