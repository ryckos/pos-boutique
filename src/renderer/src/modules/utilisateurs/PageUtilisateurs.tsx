/**
 * Gestion des comptes (admin). Propriétaire : Dev B.
 * On ne supprime jamais un compte : il est désactivé, avec un motif. Toutes les règles
 * (dernier admin, motif…) sont revérifiées par le processus principal.
 * Les codes donnés ici sont provisoires (D-17) : la personne choisit le sien à sa connexion.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Role } from '@shared/types'
import type { CompteUtilisateur } from '@shared/ipc/utilisateurs'
import { formaterDate } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useUtilisateur } from '@renderer/app/contexte'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

const LIBELLES_ROLE: Record<Role, string> = { caissier: 'Caissier', gerant: 'Gérant', admin: 'Administrateur' }
const ROLES: Role[] = ['caissier', 'gerant', 'admin']

type Action =
  | { type: 'creer' }
  | { type: 'code' | 'role' | 'desactiver'; compte: CompteUtilisateur }
  | null

export function PageUtilisateurs(): React.JSX.Element {
  const moi = useUtilisateur()
  const [comptes, setComptes] = useState<CompteUtilisateur[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('utilisateurs:lister')
      .then(setComptes)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setErreur(null)
    setSucces(null)
  }

  /** Exécute l'action, puis ferme la fenêtre et recharge la liste. Un refus remonte à la fenêtre, qui l'affiche et garde la saisie. */
  const executer = async (travail: () => Promise<unknown>, message: string): Promise<void> => {
    setErreur(null)
    await travail()
    setAction(null)
    setSucces(message)
    charger()
  }

  const actifs = comptes.filter((c) => c.actif).length

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Comptes utilisateurs</h1>
        <button className="btn" onClick={() => ouvrir({ type: 'creer' })}>
          Créer un compte
        </button>
      </header>

      {succes && (
        <p className="succes" role="status" style={{ marginBottom: 16 }}>
          {succes}
        </p>
      )}

      {action?.type === 'creer' && (
        <FormulaireCreation
          onFermer={() => ouvrir(null)}
          onValider={(nom, pin, role) =>
            executer(
              () => appel('utilisateurs:creer', { nom, pin, role }),
              `Compte de ${nom.trim()} créé. Donnez-lui son code provisoire, à remplacer à sa première connexion.`
            )
          }
        />
      )}
      {action?.type === 'code' && (
        <FormulaireCode
          key={action.compte.id}
          compte={action.compte}
          onFermer={() => ouvrir(null)}
          onValider={(pin) =>
            executer(
              () => appel('utilisateurs:reinitialiserCode', { id: action.compte.id, pin }),
              `Code provisoire donné à ${action.compte.nom}, à remplacer à sa prochaine connexion.`
            )
          }
        />
      )}
      {action?.type === 'role' && (
        <FormulaireRole
          key={action.compte.id}
          compte={action.compte}
          onFermer={() => ouvrir(null)}
          onValider={(role) =>
            executer(async () => {
              await appel('utilisateurs:changerRole', { id: action.compte.id, role })
              // Son propre rôle : le menu doit suivre tout de suite, on recharge l'application.
              if (action.compte.id === moi.id) window.location.reload()
            }, `${action.compte.nom} est maintenant ${LIBELLES_ROLE[role].toLowerCase()}.`)
          }
        />
      )}
      {action?.type === 'desactiver' && (
        <FormulaireDesactivation
          key={action.compte.id}
          compte={action.compte}
          onFermer={() => ouvrir(null)}
          onValider={(motif) =>
            executer(
              () => appel('utilisateurs:desactiver', { id: action.compte.id, motif }),
              `Compte de ${action.compte.nom} désactivé.`
            )
          }
        />
      )}

      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      <div className="tableau-cadre">
        <table className="tableau">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle</th>
              <th>État</th>
              <th>Créé le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className={c.actif ? undefined : 'inactif'}>
                <td>
                  {c.nom}
                  {c.id === moi.id && ' (vous)'}
                </td>
                <td>{LIBELLES_ROLE[c.role]}</td>
                <td>
                  <span className={`pastille ${c.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                    {c.actif ? 'Actif' : 'Désactivé'}
                  </span>{' '}
                  {c.actif && c.codeProvisoire && <span className="pastille pastille-alerte">Code provisoire</span>}
                </td>
                <td>{formaterDate(c.creeLe)}</td>
                <td>
                  {c.actif && (
                    <div className="tableau-actions">
                      {c.id !== moi.id && (
                        <button className="btn btn-secondaire" onClick={() => ouvrir({ type: 'code', compte: c })}>
                          Réinitialiser le code
                        </button>
                      )}
                      <button className="btn btn-secondaire" onClick={() => ouvrir({ type: 'role', compte: c })}>
                        Changer le rôle
                      </button>
                      {c.id !== moi.id && (
                        <button
                          className="btn btn-attention"
                          onClick={() => ouvrir({ type: 'desactiver', compte: c })}
                        >
                          Désactiver
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="vide" style={{ marginTop: 12 }}>
        {actifs} compte{actifs > 1 ? 's' : ''} actif{actifs > 1 ? 's' : ''}. Le code que vous donnez est
        provisoire : chacun choisit le sien à sa connexion. Votre propre code se change dans « Mon code ».
      </p>
    </div>
  )
}

/** Champ de code à 4 chiffres, masqué : les autres saisies sont filtrées. */
function ChampCode(props: { libelle: string; valeur: string; onChange: (v: string) => void; autoFocus?: boolean }): React.JSX.Element {
  return (
    <label className="champ champ-code">
      {props.libelle}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        autoFocus={props.autoFocus}
        value={props.valeur}
        onChange={(e) => props.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
    </label>
  )
}

function ChampRole(props: { valeur: Role; onChange: (r: Role) => void }): React.JSX.Element {
  return (
    <label className="champ">
      Rôle
      <select value={props.valeur} onChange={(e) => props.onChange(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {LIBELLES_ROLE[r]}
          </option>
        ))}
      </select>
    </label>
  )
}

function FormulaireCreation(props: {
  onValider: (nom: string, pin: string, role: Role) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<Role>('caissier')
  return (
    <FenetreFormulaire
      titre="Nouveau compte"
      libelleValider="Créer le compte"
      valide={nom.trim() !== '' && pin.length === 4}
      onValider={() => props.onValider(nom, pin, role)}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nom
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <ChampCode libelle="Code provisoire (4 chiffres)" valeur={pin} onChange={setPin} />
      <ChampRole valeur={role} onChange={setRole} />
    </FenetreFormulaire>
  )
}

function FormulaireCode(props: {
  compte: CompteUtilisateur
  onValider: (pin: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [pin, setPin] = useState('')
  return (
    <FenetreFormulaire
      titre={`Code provisoire pour ${props.compte.nom}`}
      libelleValider="Réinitialiser le code"
      valide={pin.length === 4}
      onValider={() => props.onValider(pin)}
      onFermer={props.onFermer}
    >
      <ChampCode libelle="Code provisoire (4 chiffres)" valeur={pin} onChange={setPin} autoFocus />
    </FenetreFormulaire>
  )
}

function FormulaireRole(props: {
  compte: CompteUtilisateur
  onValider: (role: Role) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [role, setRole] = useState<Role>(props.compte.role)
  return (
    <FenetreFormulaire
      titre={`Rôle de ${props.compte.nom}`}
      libelleValider="Changer le rôle"
      valide={role !== props.compte.role}
      onValider={() => props.onValider(role)}
      onFermer={props.onFermer}
    >
      <ChampRole valeur={role} onChange={setRole} />
    </FenetreFormulaire>
  )
}

function FormulaireDesactivation(props: {
  compte: CompteUtilisateur
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  return (
    <FenetreFormulaire
      titre={`Désactiver le compte de ${props.compte.nom}`}
      libelleValider="Désactiver le compte"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Motif (obligatoire)
        <input autoFocus placeholder="Ex. : fin de contrat" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </label>
    </FenetreFormulaire>
  )
}
