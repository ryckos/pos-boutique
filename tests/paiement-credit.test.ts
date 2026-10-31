import { describe, expect, it } from 'vitest'
import {
  ajouterMode,
  blocage,
  changerCredit,
  changerEcheance,
  ouvrirPaiement,
  partEspeces,
  resteAPayer,
  retirerMode,
  versRequete,
  type ClientCredit
} from '../src/renderer/src/modules/caisse/paiement'
import { formaterFCFA } from '../src/shared/format'
import { messageAnnulation } from '../src/renderer/src/modules/caisse/annulation'

// Vente de démo : 8 500 F. Mme Akouvi : plafond 50 000 F, encours 45 000 F → 5 000 F disponibles.
const TOTAL = 8500
const LIGNES = [{ conditionnementId: 3, quantite: 1 }]
const AKOUVI: ClientCredit = { id: 4, nom: 'Mme Akouvi', plafondCredit: 50000, encours: 45000, enRetard: 0 }
const ECHEANCE = '2026-11-30'
const ouvrirCredit = (client = AKOUVI) => ouvrirPaiement(TOTAL, 'especes', { client, echeance: ECHEANCE })

describe('Fenêtre de paiement — crédit', () => {
  it('un client avec assez de plafond : tout le ticket à crédit, sans espèces', () => {
    const e = ouvrirCredit({ ...AKOUVI, encours: 0 })
    expect(e.credit?.montant).toBe(8500)
    expect(partEspeces(e)).toBe(0)
    expect(resteAPayer(e)).toBe(0)
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES)).toEqual({
      lignes: LIGNES,
      paiements: [{ mode: 'credit', montant: 8500 }],
      clientId: 4,
      echeance: ECHEANCE
    })
  })

  it('crédit au-delà du plafond : bloqué, avec le reste disponible', () => {
    const e = ouvrirCredit()
    expect(blocage(e)).toContain(formaterFCFA(5000))
    expect(blocage(e)).toContain('Mme Akouvi')
  })

  it('exactement le plafond restant : passe', () => {
    const e = changerCredit(ajouterMode(ouvrirCredit(), 'especes'), 5000)
    expect(blocage(e)).toBeNull()
  })

  it('ajouter des espèces limite le crédit au disponible : 5 000 F à crédit, 3 500 F en espèces', () => {
    const e = ajouterMode(ouvrirCredit(), 'especes')
    expect(e.credit?.montant).toBe(5000)
    expect(partEspeces(e)).toBe(3500)
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES).paiements).toEqual([
      { mode: 'especes', montant: 3500 },
      { mode: 'credit', montant: 5000 }
    ])
  })

  it('crédit + TMoney : le reste à payer se voit, la référence reste obligatoire', () => {
    let e = ajouterMode(ouvrirCredit(), 'tmoney')
    expect(e.credit?.montant).toBe(5000)
    expect(e.mobiles[0].montant).toBe(3500)
    expect(blocage(e)).toMatch(/référence/)
    e = { ...e, mobiles: [{ ...e.mobiles[0], reference: 'TM-1' }] }
    expect(blocage(e)).toBeNull()
  })

  it('un crédit de 0 F est refusé, une échéance vidée aussi', () => {
    const e = ajouterMode(ouvrirCredit({ ...AKOUVI, encours: 0 }), 'especes')
    expect(blocage(changerCredit(e, 0))).toMatch(/crédit/)
    expect(blocage(changerEcheance(e, ''))).toMatch(/échéance/)
  })

  it('retirer le crédit d’un paiement mixte laisse les espèces payer tout', () => {
    const e = retirerMode(ajouterMode(ouvrirCredit(), 'especes'), 'credit')
    expect(e.credit).toBeNull()
    expect(partEspeces(e)).toBe(8500)
  })

  it('on ne retire pas le seul mode', () => {
    expect(retirerMode(ouvrirCredit(), 'credit').credit).not.toBeNull()
  })

  it('un paiement sans crédit n’envoie ni client ni échéance', () => {
    const r = versRequete(ouvrirPaiement(TOTAL, 'especes'), LIGNES)
    expect(r).not.toHaveProperty('clientId')
    expect(r).not.toHaveProperty('echeance')
  })
})

describe('Annulation d’un ticket à crédit', () => {
  it('le message dit que le crédit est effacé', () => {
    const m = messageAnnulation({
      venteId: 9,
      numeroTicket: 'T-2026-000009',
      especesARendre: 0,
      autresARendre: [],
      creditAnnule: 5000,
      avoirRetabli: 0,
      tiroirOuvert: false
    })
    expect(m).toContain(`Le crédit de ${formaterFCFA(5000)} est effacé`)
  })
})
