/**
 * Propriétaire : Dev A.
 *
 * Reprendre une proforma dans la caisse (tâche A10, règle 6.13) : on tape son numéro (complet ou
 * court), on voit ses lignes et ce qui a changé depuis, puis on la met au ticket. La vente se fera aux
 * prix du jour ; un article retiré de la vente ne revient pas. Le ticket en cours part en attente.
 */
import { useState } from 'react'
import type { ProformaReprise } from '@shared/ipc/caisse'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { panierDeProforma } from './documents'
import { Icone } from '@renderer/ui/Icone'

interface Props {
  /** Le ticket en cours a des lignes : il partira en attente. */
  ticketEnCours: boolean
  onReprise: (reprise: ProformaReprise) => void
  onFermer: () => void
}

export function FenetreRepriseProforma({ ticketEnCours, onReprise, onFermer }: Props): React.JSX.Element {
  const [numero, setNumero] = useState('')
  const [reprise, setReprise] = useState<ProformaReprise | null>(null)
  const [lecture, setLecture] = useState<string | null>(null)

  const afficher = async (n: string): Promise<void> => {
    setReprise(null)
    setLecture(null)
    if (!n.trim()) return
    try {
      setReprise(await appel('caisse:lireProforma', { numero: n }))
    } catch (e) {
      setLecture((e as Error).message)
    }
  }

  const apercu = reprise ? panierDeProforma(reprise) : null
  const rienAReprendre = apercu !== null && apercu.panier.lignes.length === 0

  return (
    <FenetreFormulaire
      titre="Reprendre une proforma"
      libelleValider="Mettre au ticket"
      large
      valide={apercu !== null && !rienAReprendre}
      onValider={async () => onReprise(reprise!)}
      onFermer={onFermer}
    >
      <label className="champ">
        Numéro de la proforma
        <input
          value={numero}
          placeholder="Ex : PF-2026-000012 ou 12"
          onChange={(e) => {
            setNumero(e.target.value.toUpperCase())
            setReprise(null)
            setLecture(null)
          }}
          onKeyDown={(e) => {
            // Entrée affiche la proforma ; une fois affichée, elle la met au ticket.
            if (e.key === 'Enter' && !reprise) {
              e.preventDefault()
              void afficher(numero)
            }
          }}
        />
      </label>
      {!reprise && (
        <button type="button" className="btn btn-discret" onClick={() => void afficher(numero)}>
          <Icone nom="afficher" />
          Afficher la proforma
        </button>
      )}

      {lecture && (
        <p className="alerte formulaire-bloc" role="alert">
          {lecture}
        </p>
      )}

      {reprise && apercu && (
        <div className="formulaire-bloc">
          <h3>
            Proforma {reprise.numero} du {formaterDate(reprise.horodatage)}
            {reprise.client && ` · ${reprise.client.nom}`} · valable jusqu’au{' '}
            {formaterDate(reprise.valideJusquAu)}
          </h3>
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Article</th>
                  <th className="nombre">Quantité</th>
                  <th className="nombre">Prix sur la proforma</th>
                  <th className="nombre">Prix du jour</th>
                </tr>
              </thead>
              <tbody>
                {reprise.lignes.map((l) => (
                  <tr key={l.conditionnementId}>
                    <td className={l.article ? undefined : 'vide'}>
                      {l.designation}
                      {l.remise > 0 && <span className="vide"> (remise {formaterFCFA(l.remise)})</span>}
                    </td>
                    <td className="nombre">{formaterQuantite(l.quantite)}</td>
                    <td className="nombre montant">{formaterFCFA(l.prixProforma)}</td>
                    <td className="nombre montant">
                      {!l.article ? (
                        <span className="vide">Plus en vente</span>
                      ) : l.prixChange ? (
                        <strong>{formaterFCFA(l.article.prixVente)}</strong>
                      ) : (
                        formaterFCFA(l.article.prixVente)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Total de la proforma : <span className="montant">{formaterFCFA(reprise.totalTtc)}</span>
            {reprise.remiseGlobale > 0 &&
              ` (dont remise sur le ticket ${formaterFCFA(reprise.remiseGlobale)})`}
          </p>
          {apercu.alertes.map((a) => (
            <p key={a} className="bandeau">
              {a}
            </p>
          ))}
          <p className="vide">
            {rienAReprendre
              ? 'Aucun article de cette proforma n’est encore en vente : rien à mettre au ticket.'
              : `La vente se fera aux prix du jour.${ticketEnCours ? ' Le ticket en cours sera mis en attente.' : ''}`}
          </p>
        </div>
      )}
    </FenetreFormulaire>
  )
}
