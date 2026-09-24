import { describe, expect, it } from 'vitest'
import {
  ajouterBillet,
  ajouterMode,
  blocage,
  changerMontant,
  changerRecu,
  changerReference,
  lireMontant,
  monnaieARendre,
  montantExact,
  ouvrirPaiement,
  partEspeces,
  resteAPayer,
  retirerMode,
  versRequete
} from '../src/renderer/src/modules/caisse/paiement'

// Vente de démo : 1 carton de tomate + 2 unités + 1 baguette = 8 500 F.
const TOTAL = 8500
const LIGNES = [{ conditionnementId: 3, quantite: 1 }]

describe('Fenêtre de paiement — espèces', () => {
  it('« Espèces » puis « Encaisser » : montant exact, rien à rendre', () => {
    const e = ouvrirPaiement(TOTAL, 'especes')
    expect(partEspeces(e)).toBe(8500)
    expect(monnaieARendre(e)).toBe(0)
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES)).toEqual({
      lignes: LIGNES,
      paiements: [{ mode: 'especes', montant: 8500 }]
    })
  })

  it('un billet de 10 000 : monnaie à rendre 1 500 F', () => {
    const e = ajouterBillet(ouvrirPaiement(TOTAL, 'especes'), 10000)
    expect(monnaieARendre(e)).toBe(1500)
    expect(versRequete(e, LIGNES).montantRecu).toBe(10000)
  })

  it('les billets s’additionnent : 5 000 + 2 000 + 2 000 = 9 000 reçus, 500 F à rendre', () => {
    let e = ouvrirPaiement(TOTAL, 'especes')
    for (const b of [5000, 2000, 2000]) e = ajouterBillet(e, b)
    expect(e.recu).toBe(9000)
    expect(monnaieARendre(e)).toBe(500)
  })

  it('espèces reçues insuffisantes : bloqué, il manque 1 500 F', () => {
    const e = ajouterBillet(ajouterBillet(ouvrirPaiement(TOTAL, 'especes'), 5000), 2000)
    expect(blocage(e)).toMatch(/Espèces reçues insuffisantes : il manque 1\s500 F/)
    expect(monnaieARendre(e)).toBe(0)
  })

  it('« Montant exact » et effacement du montant reçu', () => {
    let e = montantExact(ajouterBillet(ouvrirPaiement(TOTAL, 'especes'), 10000))
    expect(e.recu).toBe(8500)
    e = changerRecu(e, null)
    expect(e.recu).toBeNull()
    expect(blocage(e)).toBeNull()
  })
})

describe('Fenêtre de paiement — mobile money', () => {
  it('TMoney seul exige une référence', () => {
    let e = ouvrirPaiement(TOTAL, 'tmoney')
    expect(blocage(e)).toMatch(/référence de la transaction TMoney/)
    e = changerReference(e, 'tmoney', '  TM-88213 ')
    expect(blocage(e)).toBeNull()
    expect(versRequete(e, LIGNES)).toEqual({
      lignes: LIGNES,
      paiements: [{ mode: 'tmoney', montant: 8500, reference: 'TM-88213' }]
    })
  })

  it('TMoney + Flooz sans espèces : l’un prend le reste de l’autre', () => {
    let e = ajouterMode(ouvrirPaiement(TOTAL, 'tmoney'), 'flooz')
    e = changerMontant(e, 'tmoney', 3500)
    expect(e.mobiles.map((m) => m.montant)).toEqual([3500, 5000])
    expect(resteAPayer(e)).toBe(0)
  })
})

describe('Fenêtre de paiement — mixte : les espèces prennent toujours le reste', () => {
  it('3 500 F en TMoney : les espèces valent 5 000 F sans rien saisir', () => {
    let e = ajouterMode(ouvrirPaiement(TOTAL, 'especes'), 'tmoney')
    e = changerReference(changerMontant(e, 'tmoney', 3500), 'tmoney', 'TM-456')
    expect(partEspeces(e)).toBe(5000)
    expect(resteAPayer(e)).toBe(0)
    expect(blocage(e)).toBeNull()
    e = ajouterBillet(e, 10000)
    expect(monnaieARendre(e)).toBe(5000)
    expect(versRequete(e, LIGNES)).toEqual({
      lignes: LIGNES,
      paiements: [
        { mode: 'especes', montant: 5000 },
        { mode: 'tmoney', montant: 3500, reference: 'TM-456' }
      ],
      montantRecu: 10000
    })
  })

  // Bogue trouvé à l'essai (2026-09-24) : « Ajouter un paiement TMoney » alors que les espèces
  // couvraient tout créait une ligne TMoney à 0 F, sans référence exigée ; la vente partait en
  // espèces alors que la caissière croyait encaisser du TMoney.
  it('une ligne TMoney ajoutée à 0 F bloque l’encaissement', () => {
    const e = ajouterMode(ouvrirPaiement(TOTAL, 'especes'), 'tmoney')
    expect(e.mobiles[0].montant).toBe(0)
    expect(blocage(e)).toMatch(/Saisissez le montant payé en TMoney, ou retirez ce paiement/)
  })

  it('TMoney au-delà du total : bloqué, les espèces tombent à 0', () => {
    let e = ajouterMode(ouvrirPaiement(TOTAL, 'especes'), 'tmoney')
    e = changerReference(changerMontant(e, 'tmoney', 9000), 'tmoney', 'TM-1')
    expect(partEspeces(e)).toBe(0)
    expect(blocage(e)).toMatch(/supérieur au total de 500 F : baissez le montant TMoney/)
  })

  it('TMoney couvre exactement tout avec les espèces ajoutées : bloqué', () => {
    let e = ajouterMode(changerReference(ouvrirPaiement(TOTAL, 'tmoney'), 'tmoney', 'TM-1'), 'especes')
    expect(partEspeces(e)).toBe(0)
    expect(blocage(e)).toMatch(/retirez les espèces ou baissez un montant/)
    e = changerMontant(e, 'tmoney', 6000)
    expect(partEspeces(e)).toBe(2500)
    expect(blocage(e)).toBeNull()
  })

  it('un mode déjà présent n’est pas ajouté deux fois', () => {
    const e = ouvrirPaiement(TOTAL, 'especes')
    expect(ajouterMode(e, 'especes')).toBe(e)
    const t = ouvrirPaiement(TOTAL, 'tmoney')
    expect(ajouterMode(t, 'tmoney')).toBe(t)
  })

  it('retirer les espèces : TMoney resté seul reprend tout le total, le reçu est oublié', () => {
    let e = ajouterBillet(ajouterMode(ouvrirPaiement(TOTAL, 'especes'), 'tmoney'), 5000)
    e = retirerMode(changerMontant(e, 'tmoney', 3500), 'especes')
    expect(e.especes).toBe(false)
    expect(e.mobiles).toEqual([{ mode: 'tmoney', montant: 8500, reference: '' }])
    expect(e.recu).toBeNull()
    expect(retirerMode(e, 'tmoney')).toBe(e)
  })

  it('retirer TMoney : les espèces reprennent tout le total', () => {
    let e = changerMontant(ajouterMode(ouvrirPaiement(TOTAL, 'especes'), 'tmoney'), 'tmoney', 3500)
    e = retirerMode(e, 'tmoney')
    expect(e.mobiles).toEqual([])
    expect(partEspeces(e)).toBe(8500)
    expect(blocage(e)).toBeNull()
  })
})

describe('Saisie des montants', () => {
  it('lit un montant saisi au clavier en entier', () => {
    expect(lireMontant('10 000')).toBe(10000)
    // Au Togo, « 10.000 » s'écrit souvent pour dix mille : le point n'est pas une virgule décimale.
    expect(lireMontant('10.000')).toBe(10000)
    expect(lireMontant('')).toBe(0)
    expect(lireMontant('abc')).toBe(0)
  })
})
