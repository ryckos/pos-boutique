import { describe, expect, it } from 'vitest'
import { grille, produitsAvecStock, rechercherParCode, rechercherTexte } from '../src/main/modules/catalogue/service'
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
