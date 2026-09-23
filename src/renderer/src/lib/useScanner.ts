/**
 * Écoute de la douchette code-barres (émulation clavier). ZONE PARTAGÉE.
 * Utilisée par la caisse (Dev A), la réception et l'inventaire (Dev B).
 *
 * Principe validé en Phase 0 (test T1) : la douchette « tape » très vite puis envoie Entrée.
 * Les frappes espacées de plus de `delaiMaxMs` sont considérées comme humaines et ignorées.
 * Les champs de saisie sont ignorés, sauf s'ils portent l'attribut data-scan.
 */
import { useEffect, useRef } from 'react'

interface OptionsScanner {
  actif?: boolean
  delaiMaxMs?: number
  longueurMin?: number
}

export function useScanner(surScan: (code: string) => void, options: OptionsScanner = {}): void {
  const { actif = true, delaiMaxMs = 50, longueurMin = 3 } = options
  const rappel = useRef(surScan)
  rappel.current = surScan

  useEffect(() => {
    if (!actif) return
    let tampon = ''
    let derniere = 0

    const surTouche = (e: KeyboardEvent): void => {
      const cible = e.target as HTMLElement | null
      const estChamp =
        !!cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)
      if (estChamp && cible?.dataset.scan === undefined) return

      const maintenant = performance.now()
      if (e.key === 'Enter') {
        if (tampon.length >= longueurMin && maintenant - derniere <= delaiMaxMs * 2) {
          e.preventDefault()
          rappel.current(tampon)
        }
        tampon = ''
        return
      }
      if (e.key.length !== 1) return
      if (tampon && maintenant - derniere > delaiMaxMs) tampon = ''
      tampon += e.key
      derniere = maintenant
    }

    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [actif, delaiMaxMs, longueurMin])
}
