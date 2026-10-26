/**
 * Bouton réduit à une icône, avec son infobulle. ZONE PARTAGÉE.
 *
 * Réservé aux actions répétées sur chaque ligne d'un tableau (modifier, désactiver, historique…) :
 * les actions principales d'une page et les boutons de validation gardent leur texte (UI_UX § 4).
 *
 * - Le nom de l'action est l'`aria-label` du bouton et le texte de l'infobulle.
 * - L'infobulle s'ouvre au survol de la souris et au focus clavier. Sur l'écran tactile, il n'y a
 *   pas de survol : un **appui long** l'affiche sans déclencher l'action ; un appui bref agit.
 * - Elle est rendue dans `document.body`, en position fixe : un tableau qui défile ne la coupe pas.
 * - Un bouton indisponible reste survolable (`aria-disabled` plutôt que `disabled`) : son infobulle
 *   peut dire pourquoi il est grisé.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icone, type NomIcone } from './Icone'

const DELAI_APPUI_LONG = 450
const DUREE_AU_DOIGT = 1600

interface Proprietes extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icone: NomIcone
  /** Ce que fait le bouton, avec un verbe : « Modifier le produit ». */
  libelle: string
  /** `attention` : action sensible (désactiver, annuler), en rouge. `principal` : plein. */
  variante?: 'secondaire' | 'attention' | 'principal'
}

export function BoutonIcone(props: Proprietes): React.JSX.Element {
  const { icone, libelle, variante = 'secondaire', className, onClick, disabled, ...reste } = props
  const ref = useRef<HTMLButtonElement>(null)
  const { infobulle, gestionnaires, appuiLongEnCours } = useInfobulle(ref, libelle)

  const classe = ['btn', 'btn-icone', variante === 'principal' ? '' : `btn-${variante}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={classe}
        aria-label={libelle}
        aria-disabled={disabled || undefined}
        {...reste}
        {...gestionnaires}
        onClick={(e) => {
          // Un appui long sert à lire l'infobulle : il ne déclenche pas l'action.
          if (appuiLongEnCours() || disabled) return
          onClick?.(e)
        }}
      >
        <Icone nom={icone} />
      </button>
      {infobulle}
    </>
  )
}

/**
 * Infobulle attachée à un élément (bouton à icône, lien du menu replié). Renvoie les gestionnaires à
 * poser sur l'élément et l'infobulle à rendre à côté.
 */
export function useInfobulle(
  ref: React.RefObject<HTMLElement | null>,
  texte: string
): {
  infobulle: React.ReactNode
  gestionnaires: Pick<
    React.DOMAttributes<HTMLElement>,
    | 'onPointerEnter'
    | 'onPointerLeave'
    | 'onPointerDown'
    | 'onPointerUp'
    | 'onPointerCancel'
    | 'onFocus'
    | 'onBlur'
    | 'onContextMenu'
  >
  appuiLongEnCours: () => boolean
} {
  const [position, setPosition] = useState<{ x: number; y: number; dessous: boolean } | null>(null)
  const minuterie = useRef<number | undefined>(undefined)
  const appuiLong = useRef(false)

  const montrer = (): void => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // Centrée au-dessus de l'élément ; dessous s'il touche le haut de l'écran ; jamais hors de l'écran.
    const x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90)
    const dessous = r.top < 48
    setPosition({ x, y: dessous ? r.bottom + 8 : r.top - 8, dessous })
  }
  const cacher = (): void => {
    window.clearTimeout(minuterie.current)
    setPosition(null)
  }

  useEffect(() => () => window.clearTimeout(minuterie.current), [])
  // L'élément peut bouger (défilement) : on ferme plutôt que de laisser l'infobulle flotter.
  useEffect(() => {
    if (!position) return
    window.addEventListener('scroll', cacher, true)
    return () => window.removeEventListener('scroll', cacher, true)
  }, [position])

  return {
    infobulle:
      position &&
      createPortal(
        <span
          className={position.dessous ? 'infobulle infobulle-dessous' : 'infobulle'}
          role="tooltip"
          style={{ left: position.x, top: position.y }}
        >
          {texte}
        </span>,
        document.body
      ),
    gestionnaires: {
      onPointerEnter: (e) => {
        if (e.pointerType === 'mouse') montrer()
      },
      onPointerLeave: (e) => {
        if (e.pointerType === 'mouse') cacher()
      },
      onPointerDown: (e) => {
        appuiLong.current = false
        if (e.pointerType === 'mouse') return
        window.clearTimeout(minuterie.current)
        minuterie.current = window.setTimeout(() => {
          appuiLong.current = true
          montrer()
          minuterie.current = window.setTimeout(cacher, DUREE_AU_DOIGT)
        }, DELAI_APPUI_LONG)
      },
      onPointerUp: (e) => {
        if (e.pointerType !== 'mouse' && !appuiLong.current) window.clearTimeout(minuterie.current)
      },
      onPointerCancel: () => {
        if (!appuiLong.current) window.clearTimeout(minuterie.current)
      },
      onFocus: () => {
        if (ref.current?.matches(':focus-visible')) montrer()
      },
      onBlur: cacher,
      // L'appui long ouvre sinon le menu contextuel du navigateur.
      onContextMenu: (e) => e.preventDefault()
    },
    appuiLongEnCours: () => {
      const v = appuiLong.current
      appuiLong.current = false
      return v
    }
  }
}
