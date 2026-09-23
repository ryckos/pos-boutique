/**
 * Assistant de premier démarrage (application installée, aucun compte). Propriétaire : Dev B.
 * Crée le compte administrateur, qui créera ensuite les autres comptes.
 * Le processus principal refuse cette création dès qu'un compte existe.
 */
import { useState } from 'react'
import type { UtilisateurConnecte } from '@shared/types'
import { appel } from '@renderer/lib/api'

const seulementChiffres = (v: string): string => v.replace(/\D/g, '').slice(0, 4)

export function PagePremierDemarrage(props: { onCree: (u: UtilisateurConnecte) => void }): React.JSX.Element {
  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const valide = nom.trim() !== '' && pin.length === 4 && confirmation.length === 4

  const soumettre = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!valide || envoi) return
    if (pin !== confirmation) {
      setErreur('Les deux codes ne correspondent pas. Saisissez-les à nouveau.')
      setPin('')
      setConfirmation('')
      return
    }
    setEnvoi(true)
    setErreur(null)
    appel('auth:creerPremierAdmin', { nom, pin })
      .then(props.onCree)
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setEnvoi(false))
  }

  return (
    <div className="assistant">
      <div className="assistant-boite">
        <h1>Bienvenue dans Ma Boutique</h1>
        <p>
          Créez le compte administrateur. Il servira ensuite à créer les comptes du gérant et des caissiers.
          Retenez bien votre code : il est personnel.
        </p>
        <form className="formulaire formulaire-colonne" onSubmit={soumettre}>
          <label className="champ">
            Votre nom
            <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <label className="champ champ-code">
            Votre code (4 chiffres)
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(seulementChiffres(e.target.value))}
            />
          </label>
          <label className="champ champ-code">
            Confirmez le code
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(seulementChiffres(e.target.value))}
            />
          </label>
          {erreur && (
            <p className="alerte" role="alert">
              {erreur}
            </p>
          )}
          <button type="submit" className="btn" disabled={!valide || envoi}>
            Créer le compte administrateur
          </button>
        </form>
      </div>
    </div>
  )
}
