import { describe, expect, it } from 'vitest'
import type { DettesFournisseur, EcheanceReception } from '../src/shared/ipc/fournisseurs'
import { formaterFCFA } from '../src/shared/format'
import {
  GLOBAL,
  lireMontant,
  manqueReglement,
  resteAPayer,
  texteEcheance
} from '../src/renderer/src/modules/fournisseurs/saisieReglement'

const RC1: EcheanceReception = {
  receptionId: 1,
  numero: 'RC-2026-000001',
  dateReception: '2026-09-16 08:00:00',
  dateEcheance: '2026-10-01',
  total: 18000,
  regle: 0,
  reste: 18000,
  etat: 'en_retard',
  joursRetard: 5
}
const RC2: EcheanceReception = {
  ...RC1,
  receptionId: 2,
  numero: 'RC-2026-000002',
  dateEcheance: '2026-10-21',
  total: 13200,
  reste: 11200,
  regle: 2000,
  etat: 'a_payer',
  joursRetard: 0
}
const DETTES: DettesFournisseur = {
  fournisseurId: 1,
  nom: 'Grossiste',
  actif: true,
  soldeDu: 29200,
  enRetard: 18000,
  echeances: [RC1, RC2],
  reglements: [],
  avoirs: [],
  avoirsAttendus: 0
}

describe('Saisie d’un règlement fournisseur (écran B10)', () => {
  it('reste à payer : le solde global ou celui de la réception choisie', () => {
    expect(resteAPayer(DETTES, GLOBAL)).toBe(29200)
    expect(resteAPayer(DETTES, '2')).toBe(11200)
    expect(resteAPayer(DETTES, '99')).toBe(0)
  })

  it('lit un montant en francs entiers, espaces acceptés', () => {
    expect(lireMontant('18 000')).toBe(18000)
    expect(lireMontant('')).toBeNull()
    expect(lireMontant('2,5')).toBeNaN()
  })

  it('dit ce qui manque, dans l’ordre', () => {
    const jour = '2026-10-06'
    expect(manqueReglement(null, 0, jour, jour)).toBe('Rien à payer ici')
    expect(manqueReglement(null, 11200, jour, jour)).toBe('Indiquez le montant payé')
    expect(manqueReglement(0, 11200, jour, jour)).toMatch(/sans virgule/)
    expect(manqueReglement(11201, 11200, jour, jour)).toBe(`Au plus ${formaterFCFA(11200)}`)
    expect(manqueReglement(11200, 11200, '2026-10-07', jour)).toMatch(/futur/)
    expect(manqueReglement(11200, 11200, '2026-10-05', jour)).toBeNull()
  })

  it('écrit l’état de chaque échéance', () => {
    expect(texteEcheance(RC1)).toBe('En retard de 5 j')
    expect(texteEcheance(RC2)).toBe('À payer le 21/10/2026')
    expect(texteEcheance({ ...RC2, reste: 0, etat: 'soldee' })).toBe('Soldée')
    expect(texteEcheance({ ...RC2, dateEcheance: null })).toBe('À payer')
  })
})
