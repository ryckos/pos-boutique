/**
 * Propriétaire : Dev A.
 *
 * Annuler un ticket (tâche A6, règle 6.7), depuis la caisse. On tape le numéro (le dernier ticket est
 * proposé), on vérifie le ticket affiché, on donne le motif ; une caissière fait taper le code du
 * gérant dans cette même fenêtre, sans se déconnecter. Seul un ticket d'une caisse encore ouverte
 * s'annule : le service le revérifie, et dit sinon de faire un retour client.
 */
import { useEffect, useState } from 'react'
import type { ResultatAnnulation, TicketConsulte } from '@shared/ipc/caisse'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { dateHeure } from './cloture'
import { aRendre, libelleMode, peutAnnuler } from './annulation'
import { Icone } from '@renderer/ui/Icone'

interface Props {
  numeroInitial: string
  estCaissiere: boolean
  onAnnule: (resultat: ResultatAnnulation) => void
  onFermer: () => void
}

export function FenetreAnnulation({
  numeroInitial,
  estCaissiere,
  onAnnule,
  onFermer
}: Props): React.JSX.Element {
  const [numero, setNumero] = useState(numeroInitial)
  const [ticket, setTicket] = useState<TicketConsulte | null>(null)
  const [lecture, setLecture] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [gerants, setGerants] = useState<{ id: number; nom: string }[]>([])
  const [gerantId, setGerantId] = useState<number | null>(null)
  const [code, setCode] = useState('')

  const afficher = async (n: string): Promise<void> => {
    setTicket(null)
    setLecture(null)
    if (!n.trim()) return
    try {
      setTicket(await appel('caisse:consulterTicket', { numeroTicket: n }))
    } catch (e) {
      setLecture((e as Error).message)
    }
  }

  // Le dernier ticket de la caisse est affiché tout de suite : c'est presque toujours lui.
  useEffect(() => {
    void afficher(numeroInitial)
  }, [numeroInitial])

  useEffect(() => {
    if (!estCaissiere) return
    appel('caisse:gerants')
      .then((g) => {
        setGerants(g)
        if (g.length === 1) setGerantId(g[0].id)
      })
      .catch(() => setGerants([]))
  }, [estCaissiere])

  return (
    <FenetreFormulaire
      titre="Annuler un ticket"
      libelleValider="Annuler le ticket"
      attention
      large
      valide={peutAnnuler({ ticket, motif, estCaissiere, gerantId, code })}
      onValider={async () => {
        const r = await appel('caisse:annulerTicket', {
          numeroTicket: ticket!.numeroTicket,
          motif,
          ...(estCaissiere && { autorisation: { utilisateurId: gerantId!, code } })
        })
        onAnnule(r)
      }}
      onFermer={onFermer}
    >
      <label className="champ">
        Numéro du ticket
        <input
          value={numero}
          placeholder="Ex : T-2026-000158"
          onChange={(e) => {
            setNumero(e.target.value.toUpperCase())
            setTicket(null)
            setLecture(null)
          }}
        />
      </label>
      <button type="button" className="btn btn-discret" onClick={() => void afficher(numero)}>
        <Icone nom="afficher" />
        Afficher le ticket
      </button>

      {lecture && (
        <p className="alerte formulaire-bloc" role="alert">
          {lecture}
        </p>
      )}

      {ticket && (
        <div className="formulaire-bloc">
          <h3>
            Ticket {ticket.numeroTicket} · {dateHeure(ticket.horodatage)} · caisse de {ticket.caissier}
          </h3>
          <div className="tableau-cadre">
            <table className="tableau">
              <tbody>
                {ticket.lignes.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.quantite > 1 && `${formaterQuantite(l.quantite)} × `}
                      {l.designation}
                    </td>
                    <td className="nombre montant">{formaterFCFA(l.totalLigne)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="nombre montant">
                    <strong>{formaterFCFA(ticket.totalTtc)}</strong>
                  </td>
                </tr>
                {ticket.paiements.map((p, i) => (
                  <tr key={`p-${i}`}>
                    <td className="vide">
                      Payé en {libelleMode(p.mode)}
                      {p.reference && ` (réf. ${p.reference})`}
                    </td>
                    <td className="nombre montant">{formaterFCFA(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ticket.raisonRefus ? (
            <p className="bandeau">{ticket.raisonRefus}</p>
          ) : (
            <p className="vide">
              Le ticket reste visible, marqué annulé ; les articles reviennent en stock.{' '}
              {aRendre({
                especesARendre: ticket.especesARendre,
                autresARendre: ticket.paiements.filter((p) => p.mode !== 'especes')
              }).join(' ')}
            </p>
          )}
        </div>
      )}

      {ticket && !ticket.raisonRefus && (
        <>
          <label className="champ champ-large">
            Motif de l’annulation
            <input
              value={motif}
              maxLength={80}
              placeholder="Ex : erreur de saisie, client a changé d’avis"
              onChange={(e) => setMotif(e.target.value)}
            />
          </label>
          {estCaissiere && (
            <div className="formulaire-bloc remise-accord">
              <p className="bandeau">
                L’annulation d’un ticket demande l’accord du gérant : il choisit son nom et tape son code.
              </p>
              {gerants.length === 0 ? (
                <p className="vide">Aucun compte de gérant actif.</p>
              ) : (
                <div className="remise-gerants" role="radiogroup" aria-label="Gérant qui autorise">
                  {gerants.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={g.id === gerantId}
                      className={g.id === gerantId ? 'btn' : 'btn btn-discret'}
                      onClick={() => setGerantId(g.id)}
                    >
                      {g.nom}
                    </button>
                  ))}
                </div>
              )}
              <label className="champ">
                Code du gérant
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>
            </div>
          )}
        </>
      )}
    </FenetreFormulaire>
  )
}
