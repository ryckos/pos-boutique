/**
 * Fournisseurs : liste, création, modification, désactivation. Propriétaire : Dev B.
 * Gérant. Jamais de suppression : un fournisseur se désactive, avec un motif, une fois sa dette
 * réglée (REGLES_METIER § 4.6). Les règles sont revérifiées par le processus principal.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Fournisseur, SaisieFournisseur } from '@shared/ipc/fournisseurs'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

type Action = { type: 'creer' } | { type: 'modifier' | 'desactiver'; fournisseur: Fournisseur } | null

const libelleDelai = (jours: number): string => (jours === 0 ? 'Comptant' : `${jours} jours`)

export function PageFournisseurs(): React.JSX.Element {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('fournisseurs:liste')
      .then(setFournisseurs)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setErreur(null)
    setSucces(null)
  }

  /** Exécute l'action, puis ferme la fenêtre et recharge. Un refus reste affiché dans la fenêtre. */
  const executer = async (travail: () => Promise<unknown>, message: string): Promise<void> => {
    await travail()
    setAction(null)
    setSucces(message)
    charger()
  }

  const totalDu = fournisseurs.reduce((s, f) => s + (f.actif ? f.soldeDu : 0), 0)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Fournisseurs</h1>
        <div className="tableau-actions">
          <span>
            Total dû : <span className="montant">{formaterFCFA(totalDu)}</span>
          </span>
          <button className="btn" onClick={() => ouvrir({ type: 'creer' })}>
            Créer un fournisseur
          </button>
        </div>
      </header>

      {succes && (
        <p className="succes" role="status" style={{ marginBottom: 16 }}>
          {succes}
        </p>
      )}

      {action?.type === 'creer' && (
        <FormulaireFournisseur
          onFermer={() => ouvrir(null)}
          onValider={(s) =>
            executer(() => appel('fournisseurs:creer', s), `Fournisseur « ${s.nom.trim()} » créé.`)
          }
        />
      )}
      {action?.type === 'modifier' && (
        <FormulaireFournisseur
          key={action.fournisseur.id}
          fournisseur={action.fournisseur}
          onFermer={() => ouvrir(null)}
          onValider={(s) =>
            executer(
              () => appel('fournisseurs:modifier', { id: action.fournisseur.id, ...s }),
              `Fiche de « ${s.nom.trim()} » enregistrée.`
            )
          }
        />
      )}
      {action?.type === 'desactiver' && (
        <FormulaireDesactivation
          key={action.fournisseur.id}
          fournisseur={action.fournisseur}
          onFermer={() => ouvrir(null)}
          onValider={(motif) =>
            executer(
              () => appel('fournisseurs:desactiver', { id: action.fournisseur.id, motif }),
              `« ${action.fournisseur.nom} » est désactivé : il ne sera plus proposé aux réceptions.`
            )
          }
        />
      )}

      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      {fournisseurs.length === 0 ? (
        <p className="vide">Aucun fournisseur. Créez le premier, par exemple votre grossiste habituel.</p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Délai de paiement</th>
                <th>Dernière livraison</th>
                <th className="nombre">Solde dû</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fournisseurs.map((f) => (
                <tr key={f.id} className={f.actif ? undefined : 'inactif'}>
                  <td>
                    {f.nom}
                    {(f.contact || f.adresse) && (
                      <div className="detail">{[f.contact, f.adresse].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td>{f.telephone ?? '—'}</td>
                  <td>{libelleDelai(f.delaiPaiementJours)}</td>
                  <td>{f.derniereReception ? formaterDate(f.derniereReception) : 'Aucune'}</td>
                  <td className="nombre montant">{formaterFCFA(f.soldeDu)}</td>
                  <td>
                    <span className={`pastille ${f.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                      {f.actif ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td>
                    {f.actif && (
                      <div className="tableau-actions">
                        <button
                          className="btn btn-secondaire"
                          onClick={() => ouvrir({ type: 'modifier', fournisseur: f })}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn btn-attention"
                          onClick={() => ouvrir({ type: 'desactiver', fournisseur: f })}
                        >
                          Désactiver
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="vide" style={{ marginTop: 12 }}>
        Le délai de paiement fixe l’échéance de la dette créée par chaque réception.
      </p>
    </div>
  )
}

function FormulaireFournisseur(props: {
  fournisseur?: Fournisseur
  onValider: (s: SaisieFournisseur) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const f = props.fournisseur
  const [nom, setNom] = useState(f?.nom ?? '')
  const [contact, setContact] = useState(f?.contact ?? '')
  const [telephone, setTelephone] = useState(f?.telephone ?? '')
  const [adresse, setAdresse] = useState(f?.adresse ?? '')
  const [delai, setDelai] = useState(String(f?.delaiPaiementJours ?? 0))
  const delaiValide = /^\d{1,3}$/.test(delai.trim()) && Number(delai) <= 365
  return (
    <FenetreFormulaire
      titre={f ? `Modifier « ${f.nom} »` : 'Nouveau fournisseur'}
      libelleValider={f ? 'Enregistrer la fiche' : 'Créer le fournisseur'}
      valide={nom.trim() !== '' && delaiValide}
      onValider={() =>
        props.onValider({ nom, contact, telephone, adresse, delaiPaiementJours: Number(delai.trim()) })
      }
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nom
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Grossiste Hédzranawoé" />
      </label>
      <label className="champ">
        Personne à contacter
        <input value={contact} onChange={(e) => setContact(e.target.value)} />
      </label>
      <label className="champ">
        Téléphone
        <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </label>
      <label className="champ champ-large">
        Adresse
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
      </label>
      <label className="champ">
        Délai de paiement (jours)
        <input inputMode="numeric" value={delai} onChange={(e) => setDelai(e.target.value)} />
        <span className="champ-aide">
          {delaiValide ? `${libelleDelai(Number(delai))}.` : 'Un nombre de jours entre 0 (comptant) et 365.'}
        </span>
      </label>
    </FenetreFormulaire>
  )
}

function FormulaireDesactivation(props: {
  fournisseur: Fournisseur
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const { fournisseur } = props
  return (
    <FenetreFormulaire
      titre={`Désactiver « ${fournisseur.nom} »`}
      libelleValider="Désactiver le fournisseur"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Il ne sera plus proposé aux réceptions. Ses livraisons passées restent dans l’historique.
      </p>
      {fournisseur.soldeDu > 0 && (
        <p className="alerte formulaire-bloc">
          Vous lui devez encore {formaterFCFA(fournisseur.soldeDu)} : réglez la dette avant de le désactiver.
        </p>
      )}
      <label className="champ champ-large">
        Motif
        <input placeholder="Ex. : ne livre plus" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </label>
    </FenetreFormulaire>
  )
}
