/**
 * Clients : liste, fiche, création, plafond de crédit, désactivation (A11, REGLES_METIER § 7.1).
 * Propriétaire : Dev A.
 * Caissière : crée un client (plafond 0) et corrige ses coordonnées. Gérant : fixe le plafond et
 * désactive. Jamais de suppression. Le processus principal revérifie chaque règle.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Client, FicheClient } from '@shared/ipc/clients'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { usePagination } from '@renderer/lib/pagination'
import { useUtilisateur } from '@renderer/app/contexte'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonIcone } from '@renderer/ui/BoutonIcone'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import { etatCreance, lireMontant, manqueClient, resteDisponible, texteCredit } from './clients'

type Action = { type: 'creer' } | { type: 'fiche' | 'desactiver'; client: Client } | null

export function PageClients(): React.JSX.Element {
  const { role } = useUtilisateur()
  const estGerant = role === 'gerant' || role === 'admin'
  const [texte, setTexte] = useState('')
  const [inclureInactifs, setInclureInactifs] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('clients:rechercher', { texte, inclureInactifs: estGerant && inclureInactifs })
      .then(setClients)
      .catch((e: Error) => setErreur(e.message))
  }, [texte, inclureInactifs, estGerant])

  // 200 ms après la dernière frappe, pour ne pas interroger la base à chaque lettre.
  useEffect(() => {
    const minuteur = setTimeout(charger, 200)
    return () => clearTimeout(minuteur)
  }, [charger])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setErreur(null)
    setSucces(null)
  }

  /** Exécute l'action, ferme la fenêtre et recharge. Un refus reste affiché dans la fenêtre. */
  const executer = async (travail: () => Promise<unknown>, message: string): Promise<void> => {
    await travail()
    setAction(null)
    setSucces(message)
    charger()
  }

  const totalEncours = clients.reduce((s, c) => s + (c.actif ? c.encours : 0), 0)
  const totalRetard = clients.reduce((s, c) => s + (c.actif ? c.enRetard : 0), 0)
  const pages = usePagination(clients)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Clients</h1>
        <div className="page-entete-actions">
          <span className="chiffre-cle">
            Crédits en cours : <span className="montant">{formaterFCFA(totalEncours)}</span>
          </span>
          {totalRetard > 0 && (
            <span className="pastille pastille-erreur">En retard : {formaterFCFA(totalRetard)}</span>
          )}
          <button className="btn" onClick={() => ouvrir({ type: 'creer' })}>
            <Icone nom="ajouter" />
            Nouveau client
          </button>
        </div>
      </header>

      <div className="filtres">
        <label className="champ">
          Rechercher
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Nom ou téléphone"
            autoComplete="off"
          />
        </label>
        {estGerant && (
          <label className="champ champ-case">
            <input
              type="checkbox"
              checked={inclureInactifs}
              onChange={(e) => setInclureInactifs(e.target.checked)}
            />
            Afficher les clients désactivés
          </label>
        )}
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

      {action?.type === 'creer' && (
        <ChampsClient
          estGerant={estGerant}
          titre="Nouveau client"
          libelleValider="Créer le client"
          onFermer={() => ouvrir(null)}
          onValider={(saisie) =>
            executer(() => appel('clients:creer', saisie), `Client « ${saisie.nom.trim()} » créé.`)
          }
        />
      )}
      {action?.type === 'fiche' && (
        <FenetreFiche
          key={action.client.id}
          clientId={action.client.id}
          estGerant={estGerant}
          onFermer={() => ouvrir(null)}
          onEnregistre={(message) => executer(async () => undefined, message)}
        />
      )}
      {action?.type === 'desactiver' && (
        <FormulaireDesactivation
          key={action.client.id}
          client={action.client}
          onFermer={() => ouvrir(null)}
          onValider={(motif) =>
            executer(
              () => appel('clients:desactiver', { clientId: action.client.id, motif }),
              `« ${action.client.nom} » est désactivé : il ne sera plus proposé à la caisse.`
            )
          }
        />
      )}

      {clients.length === 0 ? (
        <p className="vide">
          {texte.trim() === ''
            ? 'Aucun client. Créez le premier avec « Nouveau client ».'
            : 'Aucun client ne correspond. Vérifiez l’orthographe ou créez-le.'}
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th className="nombre">Plafond</th>
                <th className="nombre">Encours</th>
                <th>État</th>
                <th className="colonne-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.elements.map((c) => (
                <tr key={c.id} className={c.actif ? undefined : 'inactif'}>
                  <td className="cellule-titre">
                    {c.nom}
                    <div className="detail">{texteCredit(c)}</div>
                  </td>
                  <td>{c.telephone ?? '—'}</td>
                  <td className="nombre montant">{formaterFCFA(c.plafondCredit)}</td>
                  <td className="nombre montant">
                    {formaterFCFA(c.encours)}
                    {c.enRetard > 0 && (
                      <span className="detail">
                        <span className="pastille pastille-erreur">En retard : {formaterFCFA(c.enRetard)}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`pastille ${c.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                      {c.actif ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="colonne-actions">
                    <div className="tableau-actions">
                      <BoutonIcone
                        icone="afficher"
                        libelle={`Voir la fiche de « ${c.nom} »`}
                        onClick={() => ouvrir({ type: 'fiche', client: c })}
                      />
                      {estGerant && c.actif && (
                        <BoutonIcone
                          icone="desactiver"
                          variante="attention"
                          libelle={`Désactiver « ${c.nom} »`}
                          onClick={() => ouvrir({ type: 'desactiver', client: c })}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pages={pages} />
      <p className="vide note-bas">
        Un client ne peut prendre à crédit que dans la limite de son plafond. Seul le gérant le fixe.
      </p>
    </div>
  )
}

interface SaisieEnvoyee {
  nom: string
  telephone: string
  adresse: string
  nif: string
  plafondCredit?: number
}

/** Création (sans `client`) ou fiche à corriger : mêmes champs, le plafond est réservé au gérant. */
function ChampsClient(props: {
  client?: Client
  estGerant: boolean
  titre: string
  libelleValider: string
  onValider: (s: SaisieEnvoyee) => Promise<void>
  onFermer: () => void
  enfants?: React.ReactNode
}): React.JSX.Element {
  const c = props.client
  const [nom, setNom] = useState(c?.nom ?? '')
  const [telephone, setTelephone] = useState(c?.telephone ?? '')
  const [adresse, setAdresse] = useState(c?.adresse ?? '')
  const [nif, setNif] = useState(c?.nif ?? '')
  const [plafond, setPlafond] = useState(String(c?.plafondCredit ?? 0))
  const probleme = manqueClient({ nom, telephone, plafond }, props.estGerant)
  return (
    <FenetreFormulaire
      titre={props.titre}
      libelleValider={props.libelleValider}
      valide={probleme === null}
      large={props.enfants !== undefined}
      onValider={() =>
        props.onValider({
          nom,
          telephone,
          adresse,
          nif,
          ...(props.estGerant ? { plafondCredit: lireMontant(plafond) ?? 0 } : {})
        })
      }
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nom
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Mme Akouvi" />
      </label>
      <label className="champ">
        Téléphone
        <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </label>
      <label className="champ">
        NIF (facultatif)
        <input value={nif} onChange={(e) => setNif(e.target.value)} />
      </label>
      <label className="champ champ-large">
        Adresse
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
      </label>
      <label className="champ">
        Plafond de crédit (FCFA)
        <input
          inputMode="numeric"
          value={plafond}
          disabled={!props.estGerant}
          onChange={(e) => setPlafond(e.target.value)}
        />
        <span className="champ-aide">
          {props.estGerant
            ? '0 = aucun crédit. Un téléphone est obligatoire dès que le plafond dépasse 0.'
            : 'Seul le gérant fixe le plafond de crédit.'}
        </span>
      </label>
      {probleme && nom.trim() !== '' && <p className="alerte formulaire-bloc">{probleme}</p>}
      {props.enfants}
    </FenetreFormulaire>
  )
}

function FenetreFiche(props: {
  clientId: number
  estGerant: boolean
  onFermer: () => void
  onEnregistre: (message: string) => Promise<void>
}): React.JSX.Element {
  const [fiche, setFiche] = useState<FicheClient | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    appel('clients:lire', { clientId: props.clientId })
      .then(setFiche)
      .catch((e: Error) => setErreur(e.message))
  }, [props.clientId])

  if (!fiche) {
    return (
      <div className="voile">
        <section className="fenetre" role="dialog" aria-modal="true" aria-label="Fiche client">
          {erreur ? (
            <p className="alerte" role="alert">
              {erreur}
            </p>
          ) : (
            <p className="vide">Chargement…</p>
          )}
          <button className="btn btn-secondaire" onClick={props.onFermer}>
            Fermer
          </button>
        </section>
      </div>
    )
  }

  return (
    <ChampsClient
      client={fiche}
      estGerant={props.estGerant}
      titre={`Fiche de « ${fiche.nom} »`}
      libelleValider="Enregistrer la fiche"
      onFermer={props.onFermer}
      onValider={async (saisie) => {
        await appel('clients:modifier', { clientId: fiche.id, saisie })
        await props.onEnregistre(`Fiche de « ${saisie.nom.trim()} » enregistrée.`)
      }}
      enfants={
        <div className="formulaire-bloc">
          <p>
            Encours : <span className="montant">{formaterFCFA(fiche.encours)}</span> · Reste disponible :{' '}
            <span className="montant">{formaterFCFA(resteDisponible(fiche))}</span>
          </p>
          {fiche.creances.length === 0 ? (
            <p className="vide">Aucun crédit pour ce client.</p>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Date</th>
                    <th className="nombre">Montant</th>
                    <th className="nombre">Encaissé</th>
                    <th className="nombre">Restant dû</th>
                    <th>Échéance</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.creances.map((cr) => {
                    const etat = etatCreance(cr)
                    return (
                      <tr key={cr.id}>
                        <td>{cr.numeroTicket}</td>
                        <td>{formaterDate(cr.creeLe)}</td>
                        <td className="nombre montant">{formaterFCFA(cr.montantInitial)}</td>
                        <td className="nombre montant">{formaterFCFA(cr.encaisse)}</td>
                        <td className="nombre montant">{formaterFCFA(cr.restantDu)}</td>
                        <td>{cr.dateEcheance ? formaterDate(cr.dateEcheance) : '—'}</td>
                        <td>
                          <span className={`pastille ${etat.classe}`}>{etat.libelle}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      }
    />
  )
}

function FormulaireDesactivation(props: {
  client: Client
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const { client } = props
  return (
    <FenetreFormulaire
      titre={`Désactiver « ${client.nom} »`}
      libelleValider="Désactiver le client"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Il ne sera plus proposé à la caisse. Ses tickets passés restent dans l’historique.
      </p>
      {client.encours > 0 && (
        <p className="alerte formulaire-bloc">
          Il doit encore {formaterFCFA(client.encours)} : le crédit doit être soldé avant de le désactiver.
        </p>
      )}
      <label className="champ champ-large">
        Motif
        <input placeholder="Ex. : a déménagé" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </label>
    </FenetreFormulaire>
  )
}
