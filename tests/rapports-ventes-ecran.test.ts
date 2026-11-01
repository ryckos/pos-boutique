import { describe, expect, it } from 'vitest'
import { formaterFCFA } from '../src/shared/format'
import {
  largeurBarre,
  libelleHeure,
  meilleureHeure,
  texteEcart,
  tonDeEcart
} from '../src/renderer/src/modules/rapports-ventes/rapports-ventes'

describe('Rapports de ventes — affichage (A14)', () => {
  it('libellé d’une tranche horaire', () => {
    expect(libelleHeure(9)).toBe('9 h – 10 h')
    expect(libelleHeure(23)).toBe('23 h – 0 h')
  })

  it('barre : proportion de la meilleure heure, jamais négative', () => {
    expect(largeurBarre(8200, 8200)).toBe(100)
    expect(largeurBarre(1000, 8200)).toBe(12)
    expect(largeurBarre(0, 8200)).toBe(0)
    expect(largeurBarre(500, 0)).toBe(0)
  })

  it('meilleure heure : la plus forte, la plus matinale à égalité', () => {
    const l = (heure: number, chiffreAffaires: number) => ({
      heure,
      nbTickets: 1,
      chiffreAffaires,
      panierMoyen: chiffreAffaires
    })
    expect(meilleureHeure([l(9, 8200), l(14, 1000)])?.heure).toBe(9)
    expect(meilleureHeure([l(9, 500), l(14, 500)])?.heure).toBe(9)
    expect(meilleureHeure([])).toBeNull()
  })

  it('écart : rouge s’il manque, ambre s’il y a un surplus, vert si juste, rien en cours', () => {
    expect(tonDeEcart(-500)).toBe('manque')
    expect(tonDeEcart(300)).toBe('surplus')
    expect(tonDeEcart(0)).toBe('juste')
    expect(tonDeEcart(null)).toBeNull()
  })

  it('écart : cas de référence −500 F (compté 58 200, attendu 58 700)', () => {
    expect(texteEcart(-500, formaterFCFA)).toBe(`−${formaterFCFA(500)}`)
    expect(texteEcart(500, formaterFCFA)).toBe(`+${formaterFCFA(500)}`)
    expect(texteEcart(0, formaterFCFA)).toBe(formaterFCFA(0))
    expect(texteEcart(null, formaterFCFA)).toBe('—')
  })
})
