import { describe, expect, it } from 'vitest'
import {
  formaterTaille,
  messageCopieExterne
} from '../src/renderer/src/modules/sauvegardes/affichageSauvegardes'
import { formaterDateHeure } from '../src/shared/format'

describe('Écran Sauvegardes', () => {
  it('taille en Ko sous 1 Mo, en Mo au-delà', () => {
    expect(formaterTaille(300)).toBe('1 Ko')
    expect(formaterTaille(512 * 1024)).toBe('512 Ko')
    expect(formaterTaille(1.5 * 1024 * 1024)).toBe('1,5 Mo')
  })

  it('date et heure lisibles', () => {
    expect(formaterDateHeure('2026-10-12 18:30:05')).toBe('12/10/2026 à 18 h 30')
    expect(formaterDateHeure('2026-10-12')).toBe('12/10/2026')
  })

  it('clé absente ou en échec : message d’alerte qui dit quoi faire', () => {
    expect(messageCopieExterne('faite').alerte).toBe(false)
    expect(messageCopieExterne('non_reglee').alerte).toBe(false)
    expect(messageCopieExterne('absente')).toEqual({
      texte: 'Clé USB non branchée : branchez-la puis sauvegardez de nouveau.',
      alerte: true
    })
    expect(messageCopieExterne('echec').alerte).toBe(true)
  })
})
