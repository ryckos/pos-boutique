/**
 * Fenêtre modale de formulaire : toute création, modification ou désactivation de l'application
 * s'ouvre dans cette fenêtre, par-dessus la page (UI_UX § 3). ZONE PARTAGÉE.
 *
 * - Le bouton d'action reste grisé tant que `valide` est faux ou qu'un envoi est en cours (pas de
 *   double validation au doigt).
 * - Si `onValider` échoue, le message s'affiche DANS la fenêtre et la saisie est gardée : un refus
 *   affiché derrière le voile passerait inaperçu.
 * - Échap ou « Fermer » ferment la fenêtre ; un toucher à côté ne la ferme pas, pour ne jamais
 *   perdre une saisie sur l'écran tactile.
 */
import { useEffect, useId, useRef, useState } from 'react'

export interface PropsFenetreFormulaire {
  titre: string
  /** Pastille à droite du titre (« Code scanné : … »). */
  pastille?: React.ReactNode
  /** Verbe qui dit l'action : « Créer la catégorie », « Désactiver le compte »… */
  libelleValider: string
  valide: boolean
  /** Action sensible (désactivation) : bouton rouge. */
  attention?: boolean
  /** Formulaire à plusieurs colonnes ou avec un tableau (fiche produit). */
  large?: boolean
  onValider: () => Promise<void>
  onFermer: () => void
  children: React.ReactNode
}

export function FenetreFormulaire(props: PropsFenetreFormulaire): React.JSX.Element {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const idTitre = useId()
  const refFormulaire = useRef<HTMLFormElement>(null)
  const { onFermer } = props

  // Le curseur va dans le premier champ : on peut taper tout de suite.
  useEffect(() => {
    refFormulaire.current
      ?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])')
      ?.focus()
  }, [])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !envoi) onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [envoi, onFermer])

  const soumettre = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!props.valide || envoi) return
    setEnvoi(true)
    setErreur(null)
    props
      .onValider()
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setEnvoi(false))
  }

  return (
    <div className="voile">
      <section
        className={props.large ? 'fenetre fenetre-formulaire fenetre-large' : 'fenetre fenetre-formulaire'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
      >
        <div className="fenetre-entete">
          <h2 id={idTitre}>{props.titre}</h2>
          {props.pastille}
        </div>
        <form ref={refFormulaire} className="formulaire" onSubmit={soumettre}>
          {props.children}
          {erreur && (
            <p className="alerte formulaire-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="formulaire-actions">
            <button
              type="submit"
              className={props.attention ? 'btn btn-attention' : 'btn'}
              disabled={!props.valide || envoi}
            >
              {props.libelleValider}
            </button>
            <button type="button" className="btn btn-secondaire" onClick={props.onFermer} disabled={envoi}>
              Fermer
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
