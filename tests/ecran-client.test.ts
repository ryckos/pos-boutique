import { describe, expect, it } from 'vitest'
import { choisirEcranClient } from '../src/shared/ecran-client'

const ecran = (id: number, x: number) => ({ id, bounds: { x, y: 0, width: 1366, height: 768 } })

describe('choix de l’écran client (A13)', () => {
  it('prend le second écran quand il existe', () => {
    const principal = ecran(1, 0)
    const client = ecran(2, 1920)
    expect(choisirEcranClient([principal, client], 1)).toBe(client)
  })

  it('prend le premier écran qui n’est pas le principal, même listé en tête', () => {
    expect(choisirEcranClient([ecran(2, 1920), ecran(1, 0)], 1)?.id).toBe(2)
  })

  it('ne choisit rien avec un seul écran : la fenêtre client reste à la demande', () => {
    expect(choisirEcranClient([ecran(1, 0)], 1)).toBeNull()
  })
})
