import { describe, expect, it } from 'vitest'
import {
  estNumeroFacture,
  manqueClient,
  nettoyerClient,
  saisieClientVide
} from '../src/renderer/src/modules/caisse/documents'

describe('client d’une facture ou d’une proforma (A10)', () => {
  it('retire les espaces et les champs vides', () => {
    expect(nettoyerClient({ nom: '  Ets Agbodjan ', telephone: ' ', adresse: 'Bè, Lomé ', nif: '' })).toEqual(
      { nom: 'Ets Agbodjan', adresse: 'Bè, Lomé' }
    )
  })

  it('garde le NIF et le téléphone saisis', () => {
    expect(
      nettoyerClient({ nom: 'Kodjo', telephone: '90 12 34 56', adresse: '', nif: '1000123456' })
    ).toEqual({
      nom: 'Kodjo',
      telephone: '90 12 34 56',
      nif: '1000123456'
    })
  })

  it('rien de saisi = pas de client (proforma de passage)', () => {
    expect(nettoyerClient({ nom: ' ', telephone: '', adresse: '  ', nif: '' })).toBeNull()
  })

  it('facture : le nom est obligatoire', () => {
    expect(manqueClient(saisieClientVide, true)).toMatch(/nom du client/)
    expect(manqueClient({ ...saisieClientVide, nom: '   ' }, true)).toMatch(/nom du client/)
    expect(manqueClient({ ...saisieClientVide, nom: 'Kodjo' }, true)).toBeNull()
  })

  it('proforma : client facultatif, mais un client donné a un nom', () => {
    expect(manqueClient(saisieClientVide, false)).toBeNull()
    expect(manqueClient({ ...saisieClientVide, telephone: '90 12 34 56' }, false)).toMatch(/nom/)
    expect(manqueClient({ ...saisieClientVide, telephone: '90 12 34 56' }, true)).toMatch(/nom/)
  })

  it('reconnaît un numéro de facture', () => {
    expect(estNumeroFacture(' f-2026-000003')).toBe(true)
    expect(estNumeroFacture('T-2026-000158')).toBe(false)
    expect(estNumeroFacture('158')).toBe(false)
  })
})
