import { describe, expect, it } from 'vitest'
import {
  creerCategorie,
  desactiverCategorie,
  listerCategories,
  renommerCategorie
} from '../src/main/modules/catalogue/categories'
import { grille, rechercherParCode, rechercherTexte } from '../src/main/modules/catalogue/service'
import { executer } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

// Données de démo : 1 Alimentation, 2 Boulangerie, 3 Entretien, 4 Boissons. Tomate = produit 3.
const ALIMENTATION = 1
const ENTRETIEN = 3
const CARTON_TOMATE = '16181000000049'

describe('Catégories : rayons et sous-rayons (REGLES_METIER § 2.5)', () => {
  it('liste les 4 rayons de démo par ordre alphabétique, avec leurs produits', () => {
    const cats = listerCategories(baseAvecDemo())
    expect(cats.map((c) => [c.nom, c.nbProduits])).toEqual([
      ['Alimentation', 4],
      ['Boissons', 1],
      ['Boulangerie', 1],
      ['Entretien', 1]
    ])
    expect(cats.every((c) => c.actif && c.parentId === null)).toBe(true)
  })

  it('place les sous-rayons juste après leur rayon', () => {
    const db = baseAvecDemo()
    creerCategorie(db, 'Épicerie sucrée', ALIMENTATION)
    creerCategorie(db, 'Conserves', ALIMENTATION)
    expect(listerCategories(db).map((c) => c.nom)).toEqual([
      'Alimentation', 'Conserves', 'Épicerie sucrée', 'Boissons', 'Boulangerie', 'Entretien'
    ])
  })

  it('refuse un sous-rayon dans un sous-rayon : un seul niveau', () => {
    const db = baseAvecDemo()
    const conserves = creerCategorie(db, 'Conserves', ALIMENTATION)
    expect(() => creerCategorie(db, 'Tomates', conserves)).toThrow(/choisissez un rayon/)
  })

  it('refuse un nom déjà pris au même niveau, casse et espaces ignorés', () => {
    const db = baseAvecDemo()
    expect(() => creerCategorie(db, '  boissons ')).toThrow('La catégorie « boissons » existe déjà à cet endroit')
    expect(() => creerCategorie(db, 'Boissons', ALIMENTATION)).not.toThrow() // autre niveau
    expect(() => renommerCategorie(db, ENTRETIEN, 'BOULANGERIE')).toThrow(/existe déjà/)
  })

  it('refuse un nom vide, un parent inconnu ou désactivé', () => {
    const db = baseAvecDemo()
    expect(() => creerCategorie(db, '   ')).toThrow(/obligatoire/)
    expect(() => creerCategorie(db, 'X', 99)).toThrow(/introuvable/)
    const vide = creerCategorie(db, 'Divers')
    desactiverCategorie(db, vide)
    expect(() => creerCategorie(db, 'X', vide)).toThrow(/désactivé/)
  })
})

describe('Désactivation (jamais de suppression)', () => {
  it('refuse de désactiver Alimentation, qui contient 4 produits', () => {
    expect(() => desactiverCategorie(baseAvecDemo(), ALIMENTATION)).toThrow(
      '« Alimentation » contient 4 produits : déplacez-les d’abord vers une autre catégorie'
    )
  })

  it('refuse de désactiver un rayon qui a un sous-rayon actif', () => {
    const db = baseAvecDemo()
    const divers = creerCategorie(db, 'Divers')
    creerCategorie(db, 'Piles', divers)
    expect(() => desactiverCategorie(db, divers)).toThrow(/1 sous-catégorie/)
  })

  it('désactive une catégorie vide : elle reste listée, désactivée, et son nom se libère', () => {
    const db = baseAvecDemo()
    const divers = creerCategorie(db, 'Divers')
    desactiverCategorie(db, divers)
    expect(listerCategories(db).find((c) => c.id === divers)).toMatchObject({ actif: false })
    expect(() => desactiverCategorie(db, divers)).toThrow(/déjà désactivée/)
    expect(() => renommerCategorie(db, divers, 'Autre')).toThrow(/désactivée/)
    expect(() => creerCategorie(db, 'Divers')).not.toThrow()
  })
})

describe('Rayon dans le contrat de la caisse (ArticleCatalogue.categorie)', () => {
  it('donne le rayon du carton de tomate scanné', () => {
    expect(rechercherParCode(baseAvecDemo(), CARTON_TOMATE)?.categorie).toBe('Alimentation')
  })

  it('donne le rayon, pas le sous-rayon, quand le produit est rangé dans « Conserves »', () => {
    const db = baseAvecDemo()
    const conserves = creerCategorie(db, 'Conserves', ALIMENTATION)
    executer(db, 'UPDATE produits SET categorie_id = ? WHERE id = 3', conserves)
    expect(rechercherParCode(db, CARTON_TOMATE)?.categorie).toBe('Alimentation')
    expect(grille(db).find((a) => a.codeBarres === CARTON_TOMATE)?.categorie).toBe('Alimentation')
  })

  it('suit le renommage d’un rayon dans la grille et la recherche', () => {
    const db = baseAvecDemo()
    renommerCategorie(db, ENTRETIEN, 'Hygiène et entretien')
    expect(rechercherTexte(db, 'savon')[0].categorie).toBe('Hygiène et entretien')
  })

  it('vaut null pour un produit sans catégorie', () => {
    const db = baseAvecDemo()
    executer(db, 'UPDATE produits SET categorie_id = NULL WHERE id = 3')
    expect(rechercherParCode(db, CARTON_TOMATE)?.categorie).toBeNull()
  })

  it('renseigne tous les boutons de la grille', () => {
    expect(grille(baseAvecDemo()).every((a) => typeof a.categorie === 'string')).toBe(true)
  })
})
