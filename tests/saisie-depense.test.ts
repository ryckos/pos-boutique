import { describe, expect, it } from 'vitest'
import type { Depense } from '../src/shared/ipc/depenses'
import {
  aujourdhuiLocal,
  depenseAnnulable,
  etatDepense,
  libellePayeePar,
  lireMontant,
  manqueDepense,
  type SaisieEcranDepense
} from '../src/renderer/src/modules/depenses/saisieDepense'

const JOUR = '2026-10-08'
const TAXI: SaisieEcranDepense = {
  categorieId: 5,
  libelle: 'Taxi-moto',
  montant: 1000,
  source: 'fonds_propres',
  date: JOUR
}

describe('Saisie d’une dépense (écran)', () => {
  it('lit un montant en francs entiers, espaces acceptés', () => {
    expect(lireMontant('1 000')).toBe(1000)
    expect(lireMontant('')).toBeNull()
    expect(lireMontant('1000,5')).toBeNaN()
    expect(aujourdhuiLocal(new Date(2026, 9, 8))).toBe(JOUR)
  })

  it('la saisie complète du taxi-moto est bonne ; une date passée aussi', () => {
    expect(manqueDepense(TAXI, JOUR)).toBeNull()
    expect(manqueDepense({ ...TAXI, date: '2026-09-30' }, JOUR)).toBeNull()
  })

  it('dit ce qui manque, dans l’ordre des champs', () => {
    expect(manqueDepense({ ...TAXI, categorieId: null }, JOUR)).toMatch(/catégorie/)
    expect(manqueDepense({ ...TAXI, libelle: ' ' }, JOUR)).toMatch(/à quoi correspond/)
    expect(manqueDepense({ ...TAXI, montant: null }, JOUR)).toMatch(/Indiquez le montant/)
    expect(manqueDepense({ ...TAXI, montant: Number.NaN }, JOUR)).toMatch(/sans virgule/)
    expect(manqueDepense({ ...TAXI, montant: 0 }, JOUR)).toMatch(/sans virgule/)
    expect(manqueDepense({ ...TAXI, date: '2026-10-09' }, JOUR)).toMatch(/futur/)
  })

  it('au tiroir : date ignorée, caisse à choisir s’il y en a plusieurs, refus sans caisse ouverte', () => {
    const tiroir = { ...TAXI, source: 'caisse' as const, date: '2026-10-09' }
    // Caissière : sa propre caisse, rien à choisir ; la date future ne compte pas.
    expect(manqueDepense(tiroir, JOUR)).toBeNull()
    expect(manqueDepense({ ...tiroir, caissesOuvertes: 1 }, JOUR)).toBeNull()
    expect(manqueDepense({ ...tiroir, caissesOuvertes: 0 }, JOUR)).toMatch(/Aucune caisse/)
    expect(manqueDepense({ ...tiroir, caissesOuvertes: 2 }, JOUR)).toMatch(/Choisissez la caisse/)
    expect(manqueDepense({ ...tiroir, caissesOuvertes: 2, sessionId: 4 }, JOUR)).toBeNull()
  })

  it('payée par : la caisse de qui, ou les fonds propres ; annulable tant que la caisse est ouverte', () => {
    expect(libellePayeePar({ source: 'caisse', caissier: 'Afi' })).toBe('Caisse (Afi)')
    expect(libellePayeePar({ source: 'fonds_propres', caissier: null })).toBe('Fonds propres')
    expect(depenseAnnulable({ annuleLe: null, sessionCloturee: false })).toBe(true)
    expect(depenseAnnulable({ annuleLe: null, sessionCloturee: true })).toBe(false)
    expect(depenseAnnulable({ annuleLe: '2026-10-08 10:00:00', sessionCloturee: false })).toBe(false)
  })

  it('état : enregistrée ou annulée', () => {
    const d = { annuleLe: null } as Depense
    expect(etatDepense(d).texte).toBe('Enregistrée')
    expect(etatDepense({ ...d, annuleLe: '2026-10-08 10:00:00' }).texte).toBe('Annulée')
  })
})
