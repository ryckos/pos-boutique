import { describe, expect, it } from 'vitest'
import type { FicheStockInitial } from '../src/shared/ipc/stock'
import {
  champsDepuisFiche,
  manque,
  totalComptage,
  versSaisie
} from '../src/renderer/src/modules/stock/saisieStockInitial'

const fiche = (suiviPeremption = false): FicheStockInitial => ({
  produitId: 9,
  nom: 'Tomate concentrée',
  etat: 'a_faire',
  suiviPeremption,
  stockActuel: 0,
  coutPropose: 250,
  prixUnite: 350,
  conditionnements: [
    { id: 3, nom: 'Carton de 24', quantiteBase: 24 },
    { id: 2, nom: 'Lot de 3', quantiteBase: 3 },
    { id: 1, nom: 'Unité', quantiteBase: 1 }
  ]
})

describe('Comptage du stock initial à l’écran', () => {
  it('convertit 1 carton + 5 lots + 2 unités en 41, les cases vides valent 0', () => {
    expect(totalComptage(fiche().conditionnements, { 3: '1', 2: '5', 1: '2' })).toBe(41)
    expect(totalComptage(fiche().conditionnements, { 2: ' 5 ' })).toBe(15)
    expect(totalComptage(fiche().conditionnements, { 1: 'deux' })).toBeNaN()
  })

  it('pré-remplit le coût proposé et dit ce qui manque', () => {
    const f = fiche(true)
    const c = champsDepuisFiche(f)
    expect(c.cout).toBe('250')
    expect(manque(f, c)).toBe('Saisissez ce que vous comptez en rayon')
    expect(manque(f, { ...c, nombres: { 1: '2' } })).toBe('Indiquez la date de péremption')
    expect(manque(f, { ...c, nombres: { 1: '2' }, cout: '262,8' })).toMatch(/sans virgule/)
    expect(manque(f, { ...c, nombres: { 1: '2' }, datePeremption: '2026-12-31' })).toBeNull()
  })

  it('n’envoie que les conditionnements comptés, et le lot seulement si le produit suit la péremption', () => {
    const c = {
      nombres: { 3: '1', 2: '', 1: '2' },
      cout: '250',
      datePeremption: '2026-12-31',
      numeroLot: ' L7 '
    }
    expect(versSaisie(fiche(), c)).toEqual({
      produitId: 9,
      comptage: [
        { conditionnementId: 3, nombre: 1 },
        { conditionnementId: 1, nombre: 2 }
      ],
      coutUnitaire: 250,
      datePeremption: null,
      numeroLot: null
    })
    expect(versSaisie(fiche(true), c)).toMatchObject({ datePeremption: '2026-12-31', numeroLot: 'L7' })
  })
})
