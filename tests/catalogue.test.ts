import { describe, expect, it } from 'vitest'
import {
  conditionnementsProduit,
  grille,
  produitsAvecStock,
  rechercherParCode,
  rechercherTexte
} from '../src/main/modules/catalogue/service'
import { executer } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

describe('Catalogue — le contrat du scan (consommé par la caisse)', () => {
  it('reconnaît le carton de tomate et sa conversion en boîtes', () => {
    const a = rechercherParCode(baseAvecDemo(), '16181000000049')
    expect(a).toMatchObject({
      designation: 'Tomate concentrée 70 g — Carton de 24',
      quantiteBase: 24,
      prixVente: 7500,
      coutConditionnement: 6000
    })
  })

  it('reconnaît un code PLU (produit sans code-barres)', () => {
    expect(rechercherParCode(baseAvecDemo(), '101')?.designation).toBe('Baguette')
  })

  it('renvoie null pour un code inconnu ou vide', () => {
    const db = baseAvecDemo()
    expect(rechercherParCode(db, '0000000000000')).toBeNull()
    expect(rechercherParCode(db, '   ')).toBeNull()
  })

  it('fournit les boutons tactiles dans l’ordre', () => {
    const noms = grille(baseAvecDemo()).map((a) => a.designation)
    expect(noms[0]).toBe('Tomate concentrée 70 g — Lot de 3')
    expect(noms).toContain('Baguette')
  })

  it('recherche par nom', () => {
    expect(rechercherTexte(baseAvecDemo(), 'tomate')).toHaveLength(3)
  })

  it('signale les produits sous le seuil', () => {
    const lait = produitsAvecStock(baseAvecDemo()).find((p) => p.nom.startsWith('Lait'))
    expect(lait).toMatchObject({ stockActuel: 12, enAlerte: false, valeurStock: 25200 })
  })
})

describe('Catalogue — conditionnements d’un produit (changer le conditionnement à la caisse)', () => {
  const tomate = (db: ReturnType<typeof baseAvecDemo>): number => rechercherParCode(db, '16181000000049')!.produitId

  it('liste l’Unité d’abord, puis du plus petit au plus grand, avec leurs prix libres', () => {
    const db = baseAvecDemo()
    const liste = conditionnementsProduit(db, tomate(db))
    expect(liste.map((a) => [a.conditionnement, a.quantiteBase, a.prixVente])).toEqual([
      ['Unité', 1, 350],
      ['Lot de 3', 3, 1000],
      ['Carton de 24', 24, 7500]
    ])
    // Même forme que le scan : la caisse peut remplacer la ligne telle quelle.
    expect(liste[2]).toEqual(rechercherParCode(db, '16181000000049'))
  })

  it('ignore les conditionnements désactivés', () => {
    const db = baseAvecDemo()
    const id = tomate(db)
    executer(db, `UPDATE conditionnements SET actif = 0 WHERE code_barres = '16181000000049'`)
    expect(conditionnementsProduit(db, id).map((a) => a.conditionnement)).toEqual(['Unité', 'Lot de 3'])
  })

  it('renvoie une liste vide pour un produit inconnu ou désactivé', () => {
    const db = baseAvecDemo()
    const id = tomate(db)
    expect(conditionnementsProduit(db, 9999)).toEqual([])
    executer(db, 'UPDATE produits SET actif = 0 WHERE id = ?', id)
    expect(conditionnementsProduit(db, id)).toEqual([])
  })
})
