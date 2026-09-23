/**
 * Panneau de formulaire des pages de gestion : titre, champs, bouton d'action et « Fermer ».
 * ZONE PARTAGÉE. Le bouton d'action reste grisé tant que `valide` est faux ou qu'un envoi est
 * en cours (pas de double validation au doigt).
 */
import { useState } from 'react'

export interface PropsPanneau {
  titre: string
  /** Verbe qui dit l'action : « Créer la catégorie », « Désactiver le compte »… */
  libelleValider: string
  valide: boolean
  /** Action sensible (désactivation) : bouton rouge. */
  attention?: boolean
  onValider: () => Promise<void>
  onFermer: () => void
  children: React.ReactNode
}

export function Panneau(props: PropsPanneau): React.JSX.Element {
  const [envoi, setEnvoi] = useState(false)
  const soumettre = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!props.valide || envoi) return
    setEnvoi(true)
    props.onValider().finally(() => setEnvoi(false))
  }
  return (
    <section className="panneau">
      <h2>{props.titre}</h2>
      <form className="formulaire" onSubmit={soumettre}>
        {props.children}
        <div className="formulaire-actions">
          <button type="submit" className={props.attention ? 'btn btn-attention' : 'btn'} disabled={!props.valide || envoi}>
            {props.libelleValider}
          </button>
          <button type="button" className="btn btn-secondaire" onClick={props.onFermer}>
            Fermer
          </button>
        </div>
      </form>
    </section>
  )
}
