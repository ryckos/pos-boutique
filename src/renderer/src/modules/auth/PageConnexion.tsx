/**
 * Connexion par code PIN, pavé tactile. Propriétaire : Dev B.
 * Le clavier physique fonctionne aussi (chiffres, Retour arrière, Échap).
 */
import { useCallback, useEffect, useState } from 'react'
import type { UtilisateurConnecte } from '@shared/types'
import { appel } from '@renderer/lib/api'

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'effacer', '0', 'retour'] as const

export function PageConnexion(props: { onConnexion: (u: UtilisateurConnecte) => void }): React.JSX.Element {
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const { onConnexion } = props

  const saisir = useCallback(
    (touche: string) => {
      if (envoi) return
      setErreur(null)
      if (touche === 'effacer') return setPin('')
      if (touche === 'retour') return setPin((p) => p.slice(0, -1))
      setPin((p) => (p.length < 4 ? p + touche : p))
    },
    [envoi]
  )

  useEffect(() => {
    if (pin.length !== 4) return
    setEnvoi(true)
    appel('auth:connexion', { pin })
      .then(onConnexion)
      .catch((e: Error) => {
        setErreur(e.message)
        setPin('')
      })
      .finally(() => setEnvoi(false))
  }, [pin, onConnexion])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) saisir(e.key)
      else if (e.key === 'Backspace') saisir('retour')
      else if (e.key === 'Escape') saisir('effacer')
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [saisir])

  return (
    <div className="connexion">
      <div className="connexion-boite">
        <h1>Ma Boutique</h1>
        <p className="connexion-invite">Entrez votre code personnel</p>
        <div className="pin-points" aria-label={`${pin.length} chiffres saisis sur 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? 'plein' : undefined} />
          ))}
        </div>
        <p className="connexion-erreur" role="alert">
          {erreur ?? '\u00a0'}
        </p>
        <div className="pave">
          {TOUCHES.map((t) => (
            <button key={t} className={`pave-touche ${t.length > 1 ? 'pave-action' : ''}`} onClick={() => saisir(t)}>
              {t === 'effacer' ? 'Effacer' : t === 'retour' ? '←' : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
