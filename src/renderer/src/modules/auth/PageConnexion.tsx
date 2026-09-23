/**
 * Connexion en deux gestes (D-17) : toucher son nom, puis taper son code sur le pavé.
 * Propriétaire : Dev B. Le clavier physique fonctionne aussi (chiffres, Retour arrière, Échap).
 * - Après 5 codes faux, CE compte est verrouillé : pavé bloqué avec un compte à rebours.
 * - Code provisoire (donné par l'admin) : la personne choisit son code, deux fois, avant d'entrer.
 */
import { useCallback, useEffect, useState } from 'react'
import type { UtilisateurConnecte } from '@shared/types'
import type { CompteConnexion } from '@shared/ipc/auth'
import { formaterDelai } from '@shared/format'
import { appel } from '@renderer/lib/api'

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'effacer', '0', 'retour'] as const

/** code : le code habituel · nouveau, confirmation : remplacement d'un code provisoire. */
type Etape = 'code' | 'nouveau' | 'confirmation'

const INVITES: Record<Etape, string> = {
  code: 'Entrez votre code personnel',
  nouveau: 'Choisissez votre code personnel (4 chiffres)',
  confirmation: 'Tapez-le une seconde fois'
}

export function PageConnexion(props: { onConnexion: (u: UtilisateurConnecte) => void }): React.JSX.Element {
  const [comptes, setComptes] = useState<CompteConnexion[] | null>(null)
  const [compte, setCompte] = useState<CompteConnexion | null>(null)
  const [etape, setEtape] = useState<Etape>('code')
  const [pin, setPin] = useState('')
  /** Gardés en mémoire le temps de remplacer un code provisoire, jamais au-delà. */
  const [codeProvisoire, setCodeProvisoire] = useState('')
  const [nouveauCode, setNouveauCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  /** Fin du verrouillage du compte choisi (horloge locale, ms) ; null s'il n'est pas verrouillé. */
  const [finVerrou, setFinVerrou] = useState<number | null>(null)
  const [resteMs, setResteMs] = useState(0)
  const { onConnexion } = props
  const verrouille = finVerrou !== null

  useEffect(() => {
    appel('auth:comptesConnexion')
      .then(setComptes)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  // Le principal fait foi : on lui demande le temps restant (au choix du nom et après chaque refus).
  const lireVerrou = useCallback((id: number) => {
    appel('auth:etatVerrouillage', { utilisateurId: id })
      .then(({ resteMs: r }) => setFinVerrou(r > 0 ? Date.now() + r : null))
      .catch(() => setFinVerrou(null))
  }, [])

  useEffect(() => {
    if (finVerrou === null) return
    const tic = (): void => {
      const r = finVerrou - Date.now()
      if (r <= 0) {
        setFinVerrou(null)
        setErreur(null)
      } else setResteMs(r)
    }
    tic()
    const minuterie = window.setInterval(tic, 1000)
    return () => window.clearInterval(minuterie)
  }, [finVerrou])

  const choisir = (c: CompteConnexion | null): void => {
    setCompte(c)
    setEtape('code')
    setPin('')
    setCodeProvisoire('')
    setNouveauCode('')
    setErreur(null)
    setFinVerrou(null)
    if (c) lireVerrou(c.id)
  }

  const saisir = useCallback(
    (touche: string) => {
      if (envoi || verrouille || !compte) return
      setErreur(null)
      if (touche === 'effacer') return setPin('')
      if (touche === 'retour') return setPin((p) => p.slice(0, -1))
      setPin((p) => (p.length < 4 ? p + touche : p))
    },
    [envoi, verrouille, compte]
  )

  // Au 4e chiffre, l'étape en cours décide de la suite.
  useEffect(() => {
    if (pin.length !== 4 || !compte) return
    const saisi = pin
    setPin('')

    if (etape === 'nouveau') {
      setNouveauCode(saisi)
      setEtape('confirmation')
      return
    }
    if (etape === 'confirmation') {
      if (saisi !== nouveauCode) {
        setErreur('Les deux codes ne correspondent pas. Recommencez.')
        setEtape('nouveau')
        return
      }
      setEnvoi(true)
      appel('auth:definirCodePersonnel', { utilisateurId: compte.id, codeProvisoire, nouveauCode: saisi })
        .then(onConnexion)
        .catch((e: Error) => {
          setErreur(e.message)
          setEtape('nouveau')
        })
        .finally(() => setEnvoi(false))
      return
    }

    setEnvoi(true)
    appel('auth:connexion', { utilisateurId: compte.id, pin: saisi })
      .then((r) => {
        if ('utilisateur' in r) return onConnexion(r.utilisateur)
        setCodeProvisoire(saisi)
        setEtape('nouveau')
      })
      .catch((e: Error) => {
        setErreur(e.message)
        lireVerrou(compte.id)
      })
      .finally(() => setEnvoi(false))
  }, [pin, compte, etape, nouveauCode, codeProvisoire, onConnexion, lireVerrou])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) saisir(e.key)
      else if (e.key === 'Backspace') saisir('retour')
      else if (e.key === 'Escape') saisir('effacer')
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [saisir])

  if (!compte) {
    return (
      <div className="connexion">
        <div className="connexion-boite">
          <h1>Ma Boutique</h1>
          <p className="connexion-invite">Touchez votre nom</p>
          {erreur && (
            <p className="connexion-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="connexion-noms">
            {comptes?.map((c) => (
              <button key={c.id} className="connexion-nom" onClick={() => choisir(c)}>
                {c.nom}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const message = verrouille ? `Trop de codes faux. Réessayez dans ${formaterDelai(resteMs)}.` : erreur

  return (
    <div className="connexion">
      <div className="connexion-boite">
        <h1>Bonjour {compte.nom}</h1>
        {etape !== 'code' && <p className="connexion-invite">Votre code a été donné par l’administrateur.</p>}
        <p className="connexion-invite">{INVITES[etape]}</p>
        <div className="pin-points" aria-label={`${pin.length} chiffres saisis sur 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? 'plein' : undefined} />
          ))}
        </div>
        <p className="connexion-erreur" role="alert">
          {message ?? ' '}
        </p>
        <div className="pave">
          {TOUCHES.map((t) => (
            <button
              key={t}
              className={`pave-touche ${t.length > 1 ? 'pave-action' : ''}`}
              disabled={verrouille}
              onClick={() => saisir(t)}
            >
              {t === 'effacer' ? 'Effacer' : t === 'retour' ? '←' : t}
            </button>
          ))}
        </div>
        <button className="btn btn-discret connexion-changer" onClick={() => choisir(null)}>
          Ce n’est pas moi
        </button>
      </div>
    </div>
  )
}
