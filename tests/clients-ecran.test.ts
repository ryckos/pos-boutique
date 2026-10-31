import { describe, expect, it } from 'vitest'
import {
  etatCreance,
  lireMontant,
  manqueClient,
  resteDisponible,
  texteCredit
} from '../src/renderer/src/modules/clients/clients'

describe('écran Clients (logique pure)', () => {
  it('reste disponible = plafond − encours, jamais négatif', () => {
    expect(resteDisponible({ plafondCredit: 50000, encours: 30000 })).toBe(20000)
    expect(resteDisponible({ plafondCredit: 50000, encours: 50000 })).toBe(0)
    expect(resteDisponible({ plafondCredit: 10000, encours: 12000 })).toBe(0)
  })

  it('texte de crédit', () => {
    expect(texteCredit({ plafondCredit: 0, encours: 0 })).toBe('Aucun crédit autorisé')
    expect(texteCredit({ plafondCredit: 50000, encours: 30000 })).toContain('sur')
  })

  it('lit un montant entier, avec espaces', () => {
    expect(lireMontant('50 000')).toBe(50000)
    expect(lireMontant('')).toBeNull()
    expect(lireMontant('12,5')).toBeNaN()
  })

  it('valide la fiche comme le service', () => {
    const ok = { nom: 'Mme Akouvi', telephone: '90 00 00 01', plafond: '50000' }
    expect(manqueClient(ok, true)).toBeNull()
    expect(manqueClient({ ...ok, nom: ' ' }, true)).toMatch(/nom/)
    expect(manqueClient({ ...ok, telephone: '123' }, true)).toMatch(/incomplet/)
    expect(manqueClient({ ...ok, telephone: '' }, true)).toMatch(/téléphone/)
    expect(manqueClient({ ...ok, plafond: 'abc' }, true)).toMatch(/plafond/)
  })

  it('la caissière crée sans téléphone et sans plafond', () => {
    expect(manqueClient({ nom: 'Client de passage', telephone: '', plafond: '0' }, false)).toBeNull()
    // son champ plafond est grisé : une valeur résiduelle ne l'empêche pas
    expect(manqueClient({ nom: 'X', telephone: '', plafond: '50000' }, false)).toBeNull()
  })

  it('statut d’une créance : en retard prime sur ouverte', () => {
    expect(etatCreance({ statut: 'ouverte', enRetard: true }).libelle).toBe('En retard')
    expect(etatCreance({ statut: 'ouverte', enRetard: false }).libelle).toBe('Ouverte')
    expect(etatCreance({ statut: 'soldee', enRetard: false }).libelle).toBe('Soldée')
    expect(etatCreance({ statut: 'annulee', enRetard: false }).libelle).toBe('Annulée')
  })
})
