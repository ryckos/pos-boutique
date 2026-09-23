import { describe, expect, it } from 'vitest'
import { ouvrirBase } from '../src/main/db/connexion'
import { migrer } from '../src/main/db/migrations'
import { executer } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

describe('Migrations', () => {
  it('appliquent toutes les migrations sur une base vierge, puis plus rien', () => {
    const db = ouvrirBase(':memory:')
    expect(migrer(db).length).toBeGreaterThanOrEqual(2)
    expect(migrer(db)).toEqual([])
  })
})

describe('Immutabilité (règle 3.1 du cahier des charges)', () => {
  it('interdit de modifier ou supprimer un mouvement de stock', () => {
    const db = baseAvecDemo()
    expect(() => executer(db, 'UPDATE mouvements_stock SET quantite = 999 WHERE id = 1')).toThrow(/immuable/)
    expect(() => executer(db, 'DELETE FROM mouvements_stock WHERE id = 1')).toThrow(/immuable/)
  })

  it('interdit de modifier ou supprimer le journal d’audit', () => {
    const db = baseAvecDemo()
    executer(db, "INSERT INTO journal_audit (utilisateur_id, action) VALUES (1, 'test')")
    expect(() => executer(db, "UPDATE journal_audit SET action = 'x'")).toThrow(/immuable/)
    expect(() => executer(db, 'DELETE FROM journal_audit')).toThrow(/immuable/)
  })
})
