/**
 * Propriétaire : Dev A.
 *
 * Retour client (tâche A7, règle 6.8, maquette UI_UX § 5.10), depuis la caisse. On tape le numéro du
 * ticket d'origine (« 158 » suffit pour l'année en cours), on coche les articles rapportés (et leur
 * quantité), on choisit le motif, le sort du produit et le remboursement. Une caissière fait taper le
 * code du gérant dans cette même fenêtre. Le service revérifie tout et relit les montants en base.
 */
import { useEffect, useState } from 'react'
import type { RetourEnregistre, TicketRetour } from '@shared/ipc/caisse'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import {
  LIBELLES_MOTIF_RETOUR,
  LIBELLES_SORT_RETOUR,
  type ModeRemboursement,
  type MotifRetour,
  quantiteRetournable,
  type SortRetour
} from '@shared/retour'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { dateHeure } from './cloture'
import { libelleMode } from './annulation'
import { FenetreChoixClient } from './FenetreChoixClient'
import {
  basculerLigne,
  ceQuiManque,
  changerQuantiteRendue,
  modeParDefaut,
  montantARendre,
  montantLigne,
  type Selection,
  versRequete
} from './retour'
import { Icone } from '@renderer/ui/Icone'

interface Props {
  estCaissiere: boolean
  onRetour: (retour: RetourEnregistre) => void
  onFermer: () => void
}

const MOTIFS = Object.keys(LIBELLES_MOTIF_RETOUR) as MotifRetour[]
const SORTS = Object.keys(LIBELLES_SORT_RETOUR) as SortRetour[]
const MODES: ModeRemboursement[] = ['especes', 'tmoney', 'flooz', 'avoir']

/** Une rangée de boutons à choix unique (cibles tactiles de 48 px). */
function Choix<T extends string>(props: {
  libelle: string
  options: T[]
  libelles: (o: T) => string
  valeur: T | null
  onChoisir: (o: T) => void
  enPlus?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="formulaire-bloc">
      <h3>{props.libelle}</h3>
      <div className="remise-gerants" role="radiogroup" aria-label={props.libelle}>
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === props.valeur}
            className={o === props.valeur ? 'btn' : 'btn btn-discret'}
            onClick={() => props.onChoisir(o)}
          >
            {props.libelles(o)}
          </button>
        ))}
        {props.enPlus}
      </div>
    </div>
  )
}

export function FenetreRetour({ estCaissiere, onRetour, onFermer }: Props): React.JSX.Element {
  const [numero, setNumero] = useState('')
  const [ticket, setTicket] = useState<TicketRetour | null>(null)
  const [lecture, setLecture] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>({})
  const [motif, setMotif] = useState<MotifRetour | null>(null)
  const [precision, setPrecision] = useState('')
  const [sort, setSort] = useState<SortRetour | null>(null)
  const [mode, setMode] = useState<ModeRemboursement>('especes')
  const [reference, setReference] = useState('')
  /** Client de l'avoir ; imposé quand le ticket a été payé par avoir. */
  const [client, setClient] = useState<{ id: number; nom: string } | null>(null)
  const [choixClient, setChoixClient] = useState(false)
  const [gerants, setGerants] = useState<{ id: number; nom: string }[]>([])
  const [gerantId, setGerantId] = useState<number | null>(null)
  const [code, setCode] = useState('')

  const afficher = async (): Promise<void> => {
    setTicket(null)
    setLecture(null)
    setSelection({})
    if (!numero.trim()) return
    try {
      const t = await appel('caisse:consulterRetour', { numeroTicket: numero })
      setTicket(t)
      setNumero(t.numeroTicket)
      setMode(modeParDefaut(t))
      setClient(t.clientAvoir)
    } catch (e) {
      setLecture((e as Error).message)
    }
  }

  useEffect(() => {
    if (!estCaissiere) return
    appel('caisse:gerants')
      .then((g) => {
        setGerants(g)
        if (g.length === 1) setGerantId(g[0].id)
      })
      .catch(() => setGerants([]))
  }, [estCaissiere])

  const saisie = {
    ticket,
    selection,
    motif,
    precision,
    sort,
    mode,
    reference,
    client,
    estCaissiere,
    gerantId,
    code
  }
  const manque = ceQuiManque(saisie)
  const montant = ticket ? montantARendre(ticket, selection) : 0

  return (
    <FenetreFormulaire
      titre={ticket ? `Retour client — ticket ${ticket.numeroTicket}` : 'Retour client'}
      pastille={ticket && <span className="vide">{dateHeure(ticket.horodatage)}</span>}
      libelleValider="Valider le retour"
      large
      valide={manque === null}
      onValider={async () => onRetour(await appel('caisse:enregistrerRetour', versRequete(saisie)))}
      onFermer={onFermer}
    >
      <label className="champ">
        Numéro du ticket d’origine
        <input
          value={numero}
          placeholder="Ex : 158 ou T-2026-000158"
          onChange={(e) => {
            setNumero(e.target.value.toUpperCase())
            setTicket(null)
            setLecture(null)
          }}
          onKeyDown={(e) => {
            // Entrée affiche le ticket ; elle ne doit pas valider le retour.
            if (e.key === 'Enter') {
              e.preventDefault()
              void afficher()
            }
          }}
        />
      </label>
      <button type="button" className="btn btn-discret" onClick={() => void afficher()}>
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
            Ticket {ticket.numeroTicket} · caisse de {ticket.caissier} · {formaterFCFA(ticket.totalTtc)}
            {ticket.retoursPrecedents.length > 0 &&
              ` · déjà retourné : ${ticket.retoursPrecedents.join(', ')}`}
          </h3>
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Article rapporté</th>
                  <th className="nombre">Vendu</th>
                  <th className="nombre">Rendu</th>
                  <th className="nombre">Remboursé</th>
                </tr>
              </thead>
              <tbody>
                {ticket.lignes.map((l) => {
                  const retournable = quantiteRetournable(l)
                  const rendue = selection[l.ligneId]
                  return (
                    <tr key={l.ligneId} className={rendue === undefined ? 'inactif' : undefined}>
                      <td>
                        <label className="case">
                          <input
                            type="checkbox"
                            checked={rendue !== undefined}
                            disabled={retournable <= 0}
                            onChange={() => setSelection(basculerLigne(selection, ticket, l.ligneId))}
                          />
                          {l.designation}
                          {retournable <= 0 && ' (déjà retourné)'}
                        </label>
                      </td>
                      <td className="nombre">
                        {formaterQuantite(l.quantiteVendue)}
                        {l.quantiteDejaRetournee > 0 && (
                          <span className="vide"> (−{formaterQuantite(l.quantiteDejaRetournee)})</span>
                        )}
                      </td>
                      <td className="nombre">
                        {rendue !== undefined && retournable > 1 ? (
                          <span className="retour-quantite">
                            <button
                              type="button"
                              className="btn btn-discret"
                              aria-label="Une de moins"
                              disabled={rendue <= 1}
                              onClick={() =>
                                setSelection(changerQuantiteRendue(selection, ticket, l.ligneId, -1))
                              }
                            >
                              −
                            </button>
                            {formaterQuantite(rendue)}
                            <button
                              type="button"
                              className="btn btn-discret"
                              aria-label="Une de plus"
                              disabled={rendue >= retournable}
                              onClick={() =>
                                setSelection(changerQuantiteRendue(selection, ticket, l.ligneId, 1))
                              }
                            >
                              +
                            </button>
                          </span>
                        ) : (
                          formaterQuantite(rendue ?? 0)
                        )}
                      </td>
                      <td className="nombre montant">
                        {rendue === undefined ? '' : formaterFCFA(montantLigne(ticket, selection, l.ligneId))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {ticket.raisonRefus && <p className="bandeau">{ticket.raisonRefus}</p>}
        </div>
      )}

      {ticket && !ticket.raisonRefus && (
        <>
          <Choix
            libelle="Motif"
            options={MOTIFS}
            libelles={(m) => LIBELLES_MOTIF_RETOUR[m]}
            valeur={motif}
            onChoisir={setMotif}
          />
          <label className="champ champ-large">
            {motif === 'autre' ? 'Précision (obligatoire)' : 'Précision (facultatif)'}
            <input
              value={precision}
              maxLength={80}
              placeholder="Ex : boîte bombée, mauvais parfum"
              onChange={(e) => setPrecision(e.target.value)}
            />
          </label>
          <Choix
            libelle="Sort du produit"
            options={SORTS}
            libelles={(s) => LIBELLES_SORT_RETOUR[s]}
            valeur={sort}
            onChoisir={setSort}
          />
          <Choix
            libelle="Remboursement"
            // Ticket payé en partie par avoir : on ne peut rembourser qu'en avoir (REGLES_METIER § 7.2).
            options={ticket.clientAvoir ? (['avoir'] as ModeRemboursement[]) : MODES}
            libelles={(m) => (m === 'avoir' ? 'Avoir en boutique' : libelleMode(m))}
            valeur={mode}
            onChoisir={setMode}
          />
          {mode === 'avoir' && (
            <div className="champ champ-large">
              <span>
                Avoir au nom de : <strong>{client ? client.nom : 'aucun client choisi'}</strong>
              </span>
              {ticket.clientAvoir ? (
                <span className="champ-aide">
                  Ce ticket a été payé en partie par avoir : le remboursement retourne au même client.
                </span>
              ) : (
                <button type="button" className="btn btn-secondaire" onClick={() => setChoixClient(true)}>
                  {client ? 'Changer de client' : 'Choisir le client'}
                </button>
              )}
            </div>
          )}
          {choixClient && (
            <FenetreChoixClient
              usage="recopie"
              onChoisir={(c) => {
                setClient({ id: c.id, nom: c.nom })
                setChoixClient(false)
              }}
              onFermer={() => setChoixClient(false)}
            />
          )}
          {mode !== 'especes' && mode !== 'avoir' && (
            <label className="champ">
              Référence du transfert {libelleMode(mode)}
              <input
                value={reference}
                maxLength={40}
                placeholder="Ex : TM-123456"
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          )}

          <div className="formulaire-bloc retour-total">
            <span>À rembourser</span>
            <span className="montant">{formaterFCFA(montant)}</span>
          </div>
          <p className="vide formulaire-bloc">
            Crée un ticket de type retour lié au {ticket.numeroTicket} — rien n’est modifié ni effacé.
          </p>

          {estCaissiere && (
            <div className="formulaire-bloc remise-accord">
              <p className="bandeau">
                Un retour client demande l’accord du gérant : il choisit son nom et tape son code.
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
          {manque && <p className="vide formulaire-bloc">{manque}</p>}
        </>
      )}
    </FenetreFormulaire>
  )
}
