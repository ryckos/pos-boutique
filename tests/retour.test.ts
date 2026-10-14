import { describe, expect, it } from 'vitest'
import {
  montantRetourLigne,
  numeroTicketComplet,
  quantiteRetournable,
  texteMotifRetour
} from '../src/shared/retour'

describe('Règles pures du retour client (A7)', () => {
  const ligne = { quantiteVendue: 3, quantiteDejaRetournee: 0, montantPaye: 950, montantDejaRembourse: 0 }

  it('montant rendu au prorata, le dernier retour prend le reste', () => {
    expect(montantRetourLigne(ligne, 1)).toBe(316)
    expect(montantRetourLigne(ligne, 2)).toBe(633)
    expect(montantRetourLigne(ligne, 3)).toBe(950)
    expect(montantRetourLigne(ligne, 0)).toBe(0)
    const apresDeux = { ...ligne, quantiteDejaRetournee: 2, montantDejaRembourse: 632 }
    expect(quantiteRetournable(apresDeux)).toBe(1)
    expect(montantRetourLigne(apresDeux, 1)).toBe(318)
  })

  it('sans remise, chaque conditionnement rend son prix exact', () => {
    const carton = {
      quantiteVendue: 4,
      quantiteDejaRetournee: 0,
      montantPaye: 30000,
      montantDejaRembourse: 0
    }
    expect(montantRetourLigne(carton, 1)).toBe(7500)
    expect(montantRetourLigne(carton, 3)).toBe(22500)
  })

  it('motif en clair', () => {
    expect(texteMotifRetour('defectueux')).toBe('Produit défectueux')
    expect(texteMotifRetour('defectueux', ' boîte bombée ')).toBe('Produit défectueux (boîte bombée)')
    expect(texteMotifRetour('erreur_article', '')).toBe('Erreur d’article')
    expect(texteMotifRetour('autre', '  ')).toBeNull()
    expect(texteMotifRetour('autre', 'taille')).toBe('Autre : taille')
  })

  it('numéro court du ticket', () => {
    expect(numeroTicketComplet('158', 2026)).toBe('T-2026-000158')
    expect(numeroTicketComplet(' t-2025-000012 ', 2026)).toBe('T-2025-000012')
    expect(numeroTicketComplet('R-2026-000001', 2026)).toBe('R-2026-000001')
  })
})
