/**
 * « Mon code » : chaque personne connectée change son propre code. Propriétaire : Dev B.
 * Le code actuel est exigé (et compté pour le verrouillage) : une session laissée ouverte
 * ne suffit pas à changer le code de quelqu'un.
 */
import { useState } from 'react'
import { appel } from '@renderer/lib/api'

const seulementChiffres = (v: string): string => v.replace(/\D/g, '').slice(0, 4)

export function PageMonCode(): React.JSX.Element {
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const valide = actuel.length === 4 && nouveau.length === 4 && confirmation.length === 4

  const soumettre = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!valide || envoi) return
    setSucces(null)
    if (nouveau !== confirmation) {
      setErreur('Les deux nouveaux codes ne correspondent pas. Saisissez-les à nouveau.')
      setNouveau('')
      setConfirmation('')
      return
    }
    setEnvoi(true)
    setErreur(null)
    appel('auth:changerMonCode', { codeActuel: actuel, nouveauCode: nouveau })
      .then(() => {
        setSucces('Code changé. Utilisez-le dès votre prochaine connexion.')
        setActuel('')
        setNouveau('')
        setConfirmation('')
      })
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setEnvoi(false))
  }

  const champ = (libelle: string, valeur: string, changer: (v: string) => void, autoFocus = false): React.JSX.Element => (
    <label className="champ champ-code">
      {libelle}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={valeur}
        onChange={(e) => changer(seulementChiffres(e.target.value))}
      />
    </label>
  )

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Mon code</h1>
      </header>
      <section className="panneau">
        <h2>Changer mon code personnel</h2>
        <form className="formulaire" onSubmit={soumettre}>
          {champ('Code actuel', actuel, setActuel, true)}
          {champ('Nouveau code', nouveau, setNouveau)}
          {champ('Confirmez le nouveau code', confirmation, setConfirmation)}
          <div className="formulaire-actions">
            <button type="submit" className="btn" disabled={!valide || envoi}>
              Changer mon code
            </button>
          </div>
        </form>
      </section>
      {erreur && (
        <p className="alerte" role="alert">
          {erreur}
        </p>
      )}
      {succes && (
        <p className="succes" role="status">
          {succes}
        </p>
      )}
    </div>
  )
}
