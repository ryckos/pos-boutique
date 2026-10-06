import { describe, expect, it } from 'vitest'
import type { FicheSortie } from '../src/shared/ipc/stock'
import {
  SANS_LOT,
  avoirCalcule,
  champsInitiaux,
  changerLot,
  manqueSortie,
  versSaisieSortie
} from '../src/renderer/src/modules/stock/saisieSortie'

// Tomate du scénario : 144 boîtes, CUMP 250, livrée par le grossiste (1) à 250 puis 275.
const TOMATE: FicheSortie = {
  produitId: 3,
  nom: 'Tomate concentrée 70 g',
  unite: 'piece',
  stock: 144,
  cump: 262.8,
  suiviPeremption: false,
  lots: [],
  prixFournisseurs: [
    { fournisseurId: 1, fournisseur: 'Grossiste', coutUnitaire: 250, date: '2026-10-05 08:00:00' }
  ],
  fournisseurPropose: 1
}
// Lait : deux lots, le premier livré par le fournisseur 2 (inactif, absent des prix), l'autre par 1.
const LAIT: FicheSortie = {
  ...TOMATE,
  produitId: 2,
  nom: 'Lait en poudre',
  stock: 15,
  suiviPeremption: true,
  lots: [
    {
      lotId: 10,
      numeroLot: 'A12',
      datePeremption: '2026-10-08',
      restant: 3,
      prixAchat: 2000,
      fournisseurId: 2
    },
    {
      lotId: 11,
      numeroLot: 'B03',
      datePeremption: '2026-12-01',
      restant: 12,
      prixAchat: 2100,
      fournisseurId: 1
    }
  ]
}

describe('Saisie d’une sortie de stock (écran B11)', () => {
  it('propose le lot le plus proche et le fournisseur de la fiche', () => {
    expect(champsInitiaux(LAIT)).toMatchObject({ lot: '10', fournisseur: '1', motif: 'casse', retour: false })
    expect(champsInitiaux(TOMATE).lot).toBe(SANS_LOT)
  })

  it('scénario du mercredi : 2 boîtes bombées renvoyées, avoir attendu 500 F', () => {
    const c = { ...champsInitiaux(TOMATE), quantite: '2', retour: true, commentaire: ' boîtes bombées ' }
    expect(manqueSortie(TOMATE, c)).toBeNull()
    expect(avoirCalcule(TOMATE, c)).toBe(500)
    expect(versSaisieSortie(TOMATE, c)).toEqual({
      produitId: 3,
      lotId: null,
      quantite: 2,
      motif: 'casse',
      commentaire: 'boîtes bombées',
      retour: { fournisseurId: 1, montantAttendu: 500 }
    })
  })

  it('un avoir corrigé à la main l’emporte, s’il est un nombre de francs', () => {
    const c = { ...champsInitiaux(TOMATE), quantite: '2', retour: true, avoir: '480' }
    expect(versSaisieSortie(TOMATE, c).retour).toEqual({ fournisseurId: 1, montantAttendu: 480 })
    expect(manqueSortie(TOMATE, { ...c, avoir: '480,5' })).toMatch(/sans virgule/)
  })

  it('changer de lot propose son fournisseur et recalcule l’avoir au prix du lot', () => {
    const c = changerLot(LAIT, { ...champsInitiaux(LAIT), quantite: '2', retour: true, avoir: '999' }, '11')
    expect(c).toMatchObject({ lot: '11', fournisseur: '1', avoir: '' })
    expect(avoirCalcule(LAIT, c)).toBe(4200)
    // Le lot 10 vient d'un fournisseur absent des prix : on garde le fournisseur choisi, coût du dernier prix.
    expect(avoirCalcule(LAIT, changerLot(LAIT, c, '10'))).toBe(500)
  })

  it('quantité : obligatoire, entière, au plus le lot ou le stock', () => {
    const c = champsInitiaux(LAIT)
    expect(manqueSortie(LAIT, c)).toMatch(/Indiquez la quantité/)
    expect(manqueSortie(LAIT, { ...c, quantite: '1,5' })).toMatch(/entier/)
    expect(manqueSortie(LAIT, { ...c, quantite: '4' })).toMatch(/reste que 3 dans ce lot/)
    expect(manqueSortie(LAIT, { ...c, lot: SANS_LOT, quantite: '15' })).toBeNull()
    expect(manqueSortie(LAIT, { ...c, lot: SANS_LOT, quantite: '16' })).toMatch(/15 en stock/)
  })

  it('la case retour est ignorée pour un vol ou un don ; un fournisseur est exigé', () => {
    const c = { ...champsInitiaux(TOMATE), quantite: '1', retour: true }
    expect(manqueSortie(TOMATE, { ...c, motif: 'don', fournisseur: '' })).toBeNull()
    expect(versSaisieSortie(TOMATE, { ...c, motif: 'don' }).retour).toBeNull()
    expect(manqueSortie(TOMATE, { ...c, fournisseur: '' })).toMatch(/fournisseur/)
  })
})
