import { describe, expect, it } from 'vitest'
import {
  etatCreance,
  lireMontant,
  manqueClient,
  manqueEncaissement,
  messageEncaissement,
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

describe('Encaissement d’une créance (A12)', () => {
  it('guide la saisie : montant entier, pas plus que le dû, référence en mobile money', () => {
    const saisie = { montant: '1 500', mode: 'especes' as const, reference: '' }
    expect(manqueEncaissement(saisie, 3500)).toBeNull()
    expect(manqueEncaissement({ ...saisie, montant: '' }, 3500)).toMatch(/Saisissez le montant/)
    expect(manqueEncaissement({ ...saisie, montant: '12,5' }, 3500)).toMatch(/nombre entier/)
    expect(manqueEncaissement({ ...saisie, montant: '0' }, 3500)).toMatch(/nombre entier/)
    expect(manqueEncaissement({ ...saisie, montant: '3501' }, 3500)).toMatch(/ne doit que 3\s500\sF/)
    expect(manqueEncaissement({ ...saisie, mode: 'tmoney' }, 3500)).toMatch(/référence du transfert TMoney/)
    expect(manqueEncaissement({ ...saisie, mode: 'flooz', reference: 'FL-1' }, 3500)).toBeNull()
  })

  it('message : reste à payer, reçu non sorti, tiroir à ouvrir à la clé', () => {
    const r = {
      numeroRecu: 'EC-2026-000001',
      client: 'Mme Abra',
      montant: 1000,
      mode: 'especes' as const,
      parts: [],
      restantClient: 2500,
      recuImprime: true,
      tiroirOuvert: true
    }
    expect(messageEncaissement(r)).toMatch(
      /^1\s000\sF encaissés de Mme Abra \(reçu EC-2026-000001\)\. Il reste 2\s500\sF à payer\.$/
    )
    expect(messageEncaissement({ ...r, restantClient: 0 })).toMatch(/Plus rien à payer\.$/)
    expect(messageEncaissement({ ...r, recuImprime: false, tiroirOuvert: false })).toMatch(
      /Le reçu n’est pas sorti.*ouvrez-le à la clé\.$/
    )
    expect(messageEncaissement({ ...r, mode: 'tmoney', tiroirOuvert: false })).not.toMatch(/tiroir/)
  })
})
