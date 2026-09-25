import { describe, expect, it } from 'vitest'
import {
  champsDuGroupe,
  lireEntier,
  versModifications
} from '../src/renderer/src/modules/parametres/saisieParametres'
import { lireParametres } from '../src/main/modules/parametres/service'
import { baseAvecDemo } from './aide'

describe('Saisie des paramètres', () => {
  it('lit un entier saisi avec espaces, refuse le reste', () => {
    expect(lireEntier('1 500')).toBe(1500)
    expect(lireEntier('15')).toBe(15)
    expect(lireEntier('12,5')).toBeNaN()
    expect(lireEntier('')).toBeNaN()
    expect(lireEntier('-3')).toBeNaN()
  })

  it('pré-remplit chaque bloc depuis les paramètres de la démo', () => {
    const p = lireParametres(baseAvecDemo())
    expect(champsDuGroupe('boutique', p)).toEqual({
      boutiqueNom: 'MA BOUTIQUE',
      boutiqueAdresse: 'Lomé, Togo',
      boutiqueNif: '',
      ticketPied: 'Merci de votre visite !'
    })
    expect(champsDuGroupe('stock', p)).toEqual({ peremptionSeuilJours: '15', dormantJours: '60' })
    expect(champsDuGroupe('caisse', p)).toEqual({ tvaDefaut: '18', plafondRemiseCaissier: '' })
  })

  it('n’envoie que les champs du bloc, convertis', () => {
    expect(versModifications('stock', { peremptionSeuilJours: '7', dormantJours: '90' })).toEqual({
      peremptionSeuilJours: 7,
      dormantJours: 90
    })
    expect(versModifications('caisse', { tvaDefaut: '0', plafondRemiseCaissier: '1 000' })).toEqual({
      tvaDefaut: 0,
      plafondRemiseCaissier: 1000
    })
  })

  it('plafond vide = aucun plafond fixé (null)', () => {
    expect(versModifications('caisse', { tvaDefaut: '18', plafondRemiseCaissier: '  ' })).toEqual({
      tvaDefaut: 18,
      plafondRemiseCaissier: null
    })
  })
})
