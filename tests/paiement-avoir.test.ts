import { describe, expect, it } from 'vitest'
import {
  ajouterMode,
  blocage,
  changerAvoir,
  ouvrirPaiement,
  partEspeces,
  resteAPayer,
  retirerMode,
  versRequete,
  type ClientAvoir
} from '../src/renderer/src/modules/caisse/paiement'
import { formaterFCFA } from '../src/shared/format'
import { messageAnnulation } from '../src/renderer/src/modules/caisse/annulation'

// Vente de 8 500 F. Mme Abra a 600 F d'avoir ; M. Dossou en a 10 000.
const TOTAL = 8500
const LIGNES = [{ conditionnementId: 3, quantite: 1 }]
const ABRA: ClientAvoir = { id: 4, nom: 'Mme Abra', soldeAvoir: 600 }
const DOSSOU: ClientAvoir = { id: 5, nom: 'M. Dossou', soldeAvoir: 10000 }
const ouvrirAvoir = (client: ClientAvoir) => ouvrirPaiement(TOTAL, 'especes', null, client)

describe('Fenêtre de paiement — avoir en boutique', () => {
  it('l’avoir ne couvre pas tout : il prend son solde, les espèces le reste', () => {
    const e = ouvrirAvoir(ABRA)
    expect(e.avoir?.montant).toBe(600)
    expect(e.especes).toBe(true)
    expect(partEspeces(e)).toBe(7900)
    expect(resteAPayer(e)).toBe(0)
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES)).toEqual({
      lignes: LIGNES,
      paiements: [
        { mode: 'especes', montant: 7900 },
        { mode: 'avoir', montant: 600 }
      ],
      clientId: 4
    })
  })

  it('l’avoir couvre tout : pas d’espèces, rien à rendre', () => {
    const e = ouvrirAvoir(DOSSOU)
    expect(e.avoir?.montant).toBe(8500)
    expect(e.especes).toBe(false)
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES).paiements).toEqual([{ mode: 'avoir', montant: 8500 }])
  })

  it('jamais plus que le solde : bloqué avec le montant disponible', () => {
    const e = changerAvoir(ouvrirAvoir(ABRA), 700)
    expect(blocage(e)).toContain(formaterFCFA(600))
    expect(blocage(e)).toContain('Mme Abra')
  })

  it('baisser l’avoir fait grossir les espèces (elles prennent toujours le reste)', () => {
    const e = changerAvoir(ouvrirAvoir(DOSSOU), 5000)
    expect(e.avoir?.montant).toBe(5000)
    expect(partEspeces({ ...e, especes: true })).toBe(3500)
  })

  it('un avoir à 0 F est refusé', () => {
    expect(blocage(changerAvoir(ouvrirAvoir(ABRA), 0))).toMatch(/avoir/)
  })

  it('avoir + TMoney : le TMoney prend le reste, la référence est exigée', () => {
    let e = retirerMode(ouvrirAvoir(ABRA), 'especes')
    e = ajouterMode(e, 'tmoney')
    expect(e.mobiles[0].montant).toBe(7900)
    expect(blocage(e)).toMatch(/référence/)
  })

  it('on ne retire pas le seul mode', () => {
    expect(retirerMode(ouvrirAvoir(DOSSOU), 'avoir').avoir).not.toBeNull()
  })

  it('retirer l’avoir d’un paiement mixte laisse les espèces payer tout', () => {
    const e = retirerMode(ouvrirAvoir(ABRA), 'avoir')
    expect(e.avoir).toBeNull()
    expect(partEspeces(e)).toBe(8500)
    expect(versRequete(e, LIGNES)).not.toHaveProperty('clientId')
  })

  it('annulation : le message dit que l’avoir est rendu au solde', () => {
    const m = messageAnnulation({
      venteId: 9,
      numeroTicket: 'T-2026-000009',
      especesARendre: 100,
      autresARendre: [],
      creditAnnule: 0,
      avoirRetabli: 600,
      tiroirOuvert: true
    })
    expect(m).toContain(`${formaterFCFA(600)} d’avoir rendus au solde`)
  })
})
