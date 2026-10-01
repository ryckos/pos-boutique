import { describe, expect, it } from 'vitest'
import type { ArticleReception } from '../src/shared/ipc/achats'
import {
  ajouterArticle,
  ajouterJours,
  brouillonVide,
  etatLigne,
  lireBrouillon,
  lireNombre,
  manque,
  modifierLigne,
  retirerLigne,
  texteConversion,
  totalBrouillon,
  versSaisie,
  type Brouillon
} from '../src/renderer/src/modules/achats/saisieReception'

const AUJOURDHUI = '2026-09-30'
const SEUIL = 15

const CARTON_TOMATE: ArticleReception = {
  produitId: 3,
  conditionnementId: 5,
  produit: 'Tomate concentrée 70 g',
  conditionnement: 'Carton de 24',
  quantiteBase: 24,
  unite: 'piece',
  suiviPeremption: false,
  prixUnite: 350,
  prixPropose: 6000
}
const LAIT: ArticleReception = {
  produitId: 2,
  conditionnementId: 2,
  produit: 'Lait en poudre 400 g',
  conditionnement: 'Unité',
  quantiteBase: 1,
  unite: 'piece',
  suiviPeremption: true,
  prixUnite: 2800,
  prixPropose: null
}

/** Livraison du lundi saisie en entier (SCENARIO_REFERENCE, lundi 8 h). */
function lundi(): Brouillon {
  let b: Brouillon = { ...brouillonVide(), fournisseurId: 1 }
  b = ajouterArticle(b, CARTON_TOMATE)
  b = ajouterArticle(b, LAIT)
  b = modifierLigne(b, 1, { quantite: '3' })
  b = modifierLigne(b, 2, {
    quantite: '12',
    prix: '2 100',
    numeroLot: ' LOT-B03 ',
    datePeremption: '2026-11-15'
  })
  return b
}

describe('Saisie d’une réception', () => {
  it('pré-remplit le prix avec le dernier prix connu, sinon laisse le champ vide', () => {
    const b = lundi()
    expect(ajouterArticle(brouillonVide(), CARTON_TOMATE).lignes[0].prix).toBe('6000')
    expect(ajouterArticle(brouillonVide(), LAIT).lignes[0].prix).toBe('')
    expect(b.lignes.map((l) => l.cle)).toEqual([1, 2])
  })

  it('lit les nombres tapés avec espaces ou virgule', () => {
    expect(lireNombre('6 000')).toBe(6000)
    expect(lireNombre('2,5')).toBe(2.5)
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('3x')).toBeNaN()
  })

  it('conversion en direct : 3 cartons à 6 000 → « = 72 unités à 250 F l’unité », 18 000 F', () => {
    const e = etatLigne(lundi().lignes[0], AUJOURDHUI, SEUIL)
    expect(e).toEqual({
      conversion: { quantiteBase: 72, coutBase: 250, total: 18000 },
      erreur: null,
      alertes: []
    })
    expect(texteConversion(CARTON_TOMATE, e.conversion!)).toBe('= 72 unités à 250 F l’unité')
  })

  it('pas de conversion affichée pour l’Unité ; au kilo, « le kg »', () => {
    expect(texteConversion(LAIT, { quantiteBase: 12, coutBase: 2100, total: 25200 })).toBeNull()
    const sac = { ...CARTON_TOMATE, conditionnement: 'Sac de 25 kg', quantiteBase: 25, unite: 'kg' }
    expect(texteConversion(sac, { quantiteBase: 50, coutBase: 400, total: 20000 })).toBe(
      '= 50 kg à 400 F le kg'
    )
  })

  it('total de la livraison du lundi : 43 200 F, prête à valider', () => {
    const b = lundi()
    expect(totalBrouillon(b, AUJOURDHUI, SEUIL)).toBe(43200)
    expect(manque(b, AUJOURDHUI, SEUIL)).toBeNull()
  })

  it('dit ce qui manque, dans l’ordre', () => {
    expect(manque(brouillonVide(), AUJOURDHUI, SEUIL)).toMatch(/fournisseur/)
    expect(manque({ ...brouillonVide(), fournisseurId: 1 }, AUJOURDHUI, SEUIL)).toMatch(/premier article/)
    const b = lundi()
    expect(manque(modifierLigne(b, 1, { quantite: '' }), AUJOURDHUI, SEUIL)).toBe(
      'Tomate concentrée 70 g — Carton de 24 : indiquez la quantité reçue.'
    )
    expect(manque(modifierLigne(b, 1, { quantite: '2,5' }), AUJOURDHUI, SEUIL)).toMatch(/nombre entier/)
    expect(manque(modifierLigne(b, 1, { prix: '0' }), AUJOURDHUI, SEUIL)).toMatch(/sans virgule/)
    expect(manque(modifierLigne(b, 2, { numeroLot: '  ' }), AUJOURDHUI, SEUIL)).toMatch(/numéro de lot/)
    expect(manque(modifierLigne(b, 2, { datePeremption: '' }), AUJOURDHUI, SEUIL)).toMatch(
      /date de péremption/
    )
    expect(manque(modifierLigne(b, 2, { datePeremption: '2026-09-29' }), AUJOURDHUI, SEUIL)).toMatch(
      /déjà passée/
    )
  })

  it('au kilo, une quantité à virgule est acceptée', () => {
    let b = ajouterArticle(
      { ...brouillonVide(), fournisseurId: 1 },
      { ...CARTON_TOMATE, quantiteBase: 1, unite: 'kg' }
    )
    b = modifierLigne(b, 1, { quantite: '2,5', prix: '333' })
    expect(etatLigne(b.lignes[0], AUJOURDHUI, SEUIL)).toMatchObject({
      erreur: null,
      conversion: { total: 833 }
    })
  })

  it('alerte sans bloquer : péremption sous le seuil, coût au-dessus du prix de vente', () => {
    const b = lundi()
    const proche = etatLigne(
      modifierLigne(b, 2, { datePeremption: '2026-10-15' }).lignes[1],
      AUJOURDHUI,
      SEUIL
    )
    expect(proche.erreur).toBeNull()
    expect(proche.alertes).toEqual(['périme bientôt : à vendre en priorité'])
    const loin = etatLigne(modifierLigne(b, 2, { datePeremption: '2026-10-16' }).lignes[1], AUJOURDHUI, SEUIL)
    expect(loin.alertes).toEqual([])
    const cher = etatLigne(modifierLigne(b, 1, { prix: '8 400' }).lignes[0], AUJOURDHUI, SEUIL)
    expect(cher.erreur).toBeNull()
    expect(cher.alertes).toEqual(['coût par unité (350 F) égal ou supérieur au prix de vente (350 F)'])
  })

  it('prépare la saisie envoyée au principal', () => {
    expect(versSaisie({ ...lundi(), commentaire: '  BL 457 ' })).toEqual({
      fournisseurId: 1,
      commandeId: null,
      commentaire: 'BL 457',
      lignes: [
        { conditionnementId: 5, quantite: 3, prix: 6000, numeroLot: null, datePeremption: null },
        { conditionnementId: 2, quantite: 12, prix: 2100, numeroLot: 'LOT-B03', datePeremption: '2026-11-15' }
      ]
    })
  })

  it('retire une ligne', () => {
    expect(retirerLigne(lundi(), 1).lignes.map((l) => l.article.produit)).toEqual(['Lait en poudre 400 g'])
  })

  it('relit un brouillon gardé sur le poste, ignore un brouillon abîmé', () => {
    const b = lundi()
    expect(lireBrouillon(JSON.stringify(b))).toEqual(b)
    expect(lireBrouillon(null)).toBeNull()
    expect(lireBrouillon('{pas du json')).toBeNull()
    expect(lireBrouillon(JSON.stringify({ fournisseurId: 'x' }))).toBeNull()
  })

  it('ajoute des jours à une date sans fuseau horaire', () => {
    expect(ajouterJours('2026-09-30', 15)).toBe('2026-10-15')
    expect(ajouterJours('2026-12-25', 10)).toBe('2027-01-04')
  })
})
