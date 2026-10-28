import { describe, it, expect } from 'vitest'
import { caractereDeTouche, chiffreDeTouche, type ToucheClavier } from '@renderer/lib/douchette'

const touche = (key: string, code: string, mod: Partial<ToucheClavier> = {}): ToucheClavier => ({
  key,
  code,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mod
})

// Ce qu'envoie une douchette réglée en QWERTY sur un Windows en AZERTY : rangée du haut sans Maj.
const AZERTY: Record<string, string> = {
  '1': '&',
  '2': 'é',
  '3': '"',
  '4': "'",
  '5': '(',
  '6': '-',
  '7': 'è',
  '8': '_',
  '9': 'ç',
  '0': 'à'
}

describe('douchette en QWERTY sur un clavier AZERTY', () => {
  it('relit le code-barres de la capture : « _ç"_(àèà"çàéà » = 8938507039020', () => {
    const code = '8938507039020'
    const frappes = [...code].map((c) => touche(AZERTY[c], `Digit${c}`))
    expect(frappes.map((f) => f.key).join('')).toBe('_ç"_(àèà"çàéà')
    expect(frappes.map(caractereDeTouche).join('')).toBe(code)
  })

  it('garde les chiffres déjà justes (Maj en AZERTY, QWERTY, pavé numérique)', () => {
    expect(chiffreDeTouche(touche('8', 'Digit8'))).toBe('8')
    expect(chiffreDeTouche(touche('4', 'Numpad4'))).toBe('4')
  })

  it('laisse les autres touches telles quelles', () => {
    expect(chiffreDeTouche(touche('a', 'KeyQ'))).toBeNull()
    expect(caractereDeTouche(touche('a', 'KeyQ'))).toBe('a')
    expect(caractereDeTouche(touche('Enter', 'Enter'))).toBe('Enter')
  })

  it('ne touche pas aux combinaisons Alt, Ctrl, Windows', () => {
    expect(chiffreDeTouche(touche('à', 'Digit0', { ctrlKey: true }))).toBeNull()
    expect(chiffreDeTouche(touche('', 'Numpad6', { altKey: true }))).toBeNull()
    expect(chiffreDeTouche(touche('&', 'Digit1', { metaKey: true }))).toBeNull()
  })
})
