/**
 * Chiffres de la douchette quelle que soit la disposition du clavier. ZONE PARTAGÉE.
 *
 * Une douchette en émulation clavier est réglée en QWERTY d'usine : pour « 8 », elle envoie la touche
 * physique Digit8 sans Maj. Sous Windows en AZERTY, cette touche produit « _ » : un EAN 8938507039020
 * arrivait sous la forme « _ç"_(àèà"çàéà ». On lit donc la touche physique (`code`), qui ne dépend pas
 * de la disposition, plutôt que le caractère produit (`key`).
 */

/** Ce qu'il faut d'un KeyboardEvent : permet de tester sans navigateur. */
export interface ToucheClavier {
  key: string
  code: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/**
 * Chiffre de la touche physique (rangée du haut ou pavé numérique), ou null si ce n'en est pas une.
 * Alt, Ctrl et Windows sont laissés tels quels : raccourcis, et saisie Alt + pavé numérique.
 */
export function chiffreDeTouche(e: ToucheClavier): string | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)
  return m ? m[1] : null
}

/** Caractère à retenir pour une frappe : le chiffre de la touche physique s'il y en a un. */
export function caractereDeTouche(e: ToucheClavier): string {
  return chiffreDeTouche(e) ?? e.key
}

/**
 * Dans les champs `data-scan` (code-barres d'un produit, réception…), remplace le caractère AZERTY par
 * le chiffre de la touche. À installer une fois au démarrage de l'interface.
 */
export function installerChiffresDouchette(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      const cible = e.target as HTMLElement | null
      if (!(cible instanceof HTMLInputElement) || cible.dataset.scan === undefined) return
      const chiffre = chiffreDeTouche(e)
      if (chiffre === null || chiffre === e.key) return
      e.preventDefault()
      // insertText passe par l'historique du champ et déclenche l'événement input : React voit le changement.
      document.execCommand('insertText', false, chiffre)
    },
    // En capture : avant que le champ n'insère le caractère AZERTY.
    true
  )
}
