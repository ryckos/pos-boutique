import { describe, expect, it } from 'vitest'
import type { ArticleReception, Commande } from '../src/shared/ipc/achats'
import { formaterFCFA } from '../src/shared/format'
import {
  ajouterArticleCommande,
  changerConditionnementCommande,
  commandeVide,
  depuisCommande,
  etatLigneCommande,
  manqueCommande,
  modifierLigneCommande,
  resteEnSaisie,
  retirerLigneCommande,
  texteApercu,
  texteConversionCommande,
  texteReste,
  totalPrevuCommande,
  versSaisieCommande,
  type BrouillonCommande
} from '../src/renderer/src/modules/achats/saisieCommande'
import {
  brouillonVide,
  changerFournisseur,
  etatLigne,
  livrerCommande,
  versSaisie
} from '../src/renderer/src/modules/achats/saisieReception'

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
const UNITE_TOMATE: ArticleReception = { ...CARTON_TOMATE, conditionnementId: 3, conditionnement: 'Unité', quantiteBase: 1, prixPropose: 250 }
const RIZ: ArticleReception = {
  produitId: 1,
  conditionnementId: 1,
  produit: 'Riz parfumé 5 kg',
  conditionnement: 'Unité',
  quantiteBase: 1,
  unite: 'piece',
  suiviPeremption: false,
  prixUnite: 4500,
  prixPropose: null
}
const SUCRE_KG: ArticleReception = { ...RIZ, produitId: 9, conditionnementId: 9, produit: 'Sucre', unite: 'kg' }

function avec(...articles: ArticleReception[]): BrouillonCommande {
  let b: BrouillonCommande = { ...commandeVide(), fournisseurId: 1 }
  for (const a of articles) b = ajouterArticleCommande(b, a).brouillon
  return b
}

const COMMANDE: Commande = {
  id: 7,
  numero: 'CA-2026-000001',
  fournisseurId: 1,
  fournisseur: 'Grossiste Hédzranawoé',
  statut: 'recue_partiel',
  dateCommande: '2026-10-01',
  utilisateur: 'Kossi',
  commentaire: 'Livrer avant samedi',
  totalPrevu: 18000,
  receptions: [],
  lignes: [
    {
      produitId: 3,
      conditionnementId: 5,
      produit: 'Tomate concentrée 70 g',
      conditionnement: 'Carton de 24',
      unite: 'piece',
      quantiteCond: 24,
      quantite: 3,
      prix: 6000,
      total: 18000,
      commandeBase: 72,
      recuBase: 48,
      resteBase: 24
    },
    {
      produitId: 1,
      conditionnementId: 1,
      produit: 'Riz parfumé 5 kg',
      conditionnement: 'Unité',
      unite: 'piece',
      quantiteCond: 1,
      quantite: 10,
      prix: null,
      total: null,
      commandeBase: 10,
      recuBase: 10,
      resteBase: 0
    }
  ]
}

describe('Saisie d’une commande (REGLES_METIER § 4.7)', () => {
  it('prix prévu pré-rempli par le dernier prix payé, vide sinon', () => {
    const b = avec(CARTON_TOMATE, RIZ)
    expect(b.lignes.map((l) => [l.quantite, l.prix])).toEqual([
      ['', '6000'],
      ['', '']
    ])
  })

  it('refuse un produit déjà commandé, même dans un autre conditionnement', () => {
    const r = ajouterArticleCommande(avec(CARTON_TOMATE), UNITE_TOMATE)
    expect(r.dejaPresent).toBe('Tomate concentrée 70 g')
    expect(r.brouillon.lignes).toHaveLength(1)
  })

  it('3 cartons de 24 à 6 000 → « = 72 unités », 18 000 F ; sans prix, pas de total', () => {
    let b = avec(CARTON_TOMATE, RIZ)
    b = modifierLigneCommande(b, 1, { quantite: '3' })
    b = modifierLigneCommande(b, 2, { quantite: '10' })
    expect(etatLigneCommande(b.lignes[0])).toEqual({ quantiteBase: 72, total: 18000, erreur: null })
    expect(texteConversionCommande(b.lignes[0])).toBe('= 72 unités')
    expect(texteConversionCommande(b.lignes[1])).toBeNull()
    expect(etatLigneCommande(b.lignes[1]).total).toBeNull()
    expect(totalPrevuCommande(b)).toBe(18000)
    expect(manqueCommande(b)).toBeNull()
    expect(versSaisieCommande(b)).toEqual({
      fournisseurId: 1,
      commentaire: null,
      lignes: [
        { conditionnementId: 5, quantite: 3, prix: 6000 },
        { conditionnementId: 1, quantite: 10, prix: null }
      ]
    })
  })

  it('dit ce qui manque : fournisseur, article, quantité entière, prix sans virgule', () => {
    expect(manqueCommande(commandeVide())).toMatch(/fournisseur/)
    expect(manqueCommande({ ...commandeVide(), fournisseurId: 1 })).toMatch(/premier article/)
    let b = avec(CARTON_TOMATE)
    expect(manqueCommande(b)).toMatch(/indiquez la quantité commandée/)
    b = modifierLigneCommande(b, 1, { quantite: '1,5' })
    expect(manqueCommande(b)).toMatch(/nombre entier/)
    b = modifierLigneCommande(b, 1, { quantite: '2', prix: '99,5' })
    expect(manqueCommande(b)).toMatch(/sans virgule/)
    // Au poids, les décimales sont permises.
    const s = modifierLigneCommande(avec(SUCRE_KG), 1, { quantite: '2,5' })
    expect(manqueCommande(s)).toBeNull()
  })

  it('changer de conditionnement garde la quantité et repart du dernier prix ; retirer une ligne', () => {
    let b = modifierLigneCommande(avec(CARTON_TOMATE, RIZ), 1, { quantite: '3', prix: '6500' })
    b = changerConditionnementCommande(b, 1, UNITE_TOMATE)
    expect(b.lignes[0]).toMatchObject({ quantite: '3', prix: '250' })
    expect(retirerLigneCommande(b, 1).lignes.map((l) => l.article.produit)).toEqual(['Riz parfumé 5 kg'])
  })

  it('rouvre un brouillon enregistré, en écartant un article désactivé depuis', () => {
    const { brouillon, retires } = depuisCommande(
      { ...COMMANDE, statut: 'brouillon' },
      new Map([
        [5, CARTON_TOMATE],
        [1, null]
      ])
    )
    expect(retires).toEqual(['Riz parfumé 5 kg — Unité'])
    expect(brouillon).toMatchObject({ id: 7, numero: 'CA-2026-000001', fournisseurId: 1, commentaire: 'Livrer avant samedi' })
    expect(brouillon.lignes.map((l) => [l.quantite, l.prix])).toEqual([['3', '6000']])
  })
})

describe('Commande : aperçu et reste à recevoir', () => {
  it('aperçu à recopier pour le fournisseur', () => {
    expect(texteApercu(COMMANDE, 'Ma Boutique')).toBe(
      [
        'Commande CA-2026-000001',
        'De : Ma Boutique',
        'Pour : Grossiste Hédzranawoé',
        'Le 01/10/2026',
        '',
        `- Tomate concentrée 70 g : 3 × Carton de 24 (${formaterFCFA(6000)})`,
        '- Riz parfumé 5 kg : 10 × Unité',
        '',
        `Total prévu : ${formaterFCFA(18000)}`,
        '',
        'Livrer avant samedi'
      ].join('\n')
    )
  })

  it('reste dans le conditionnement s’il tombe juste, sinon en unités', () => {
    expect(resteEnSaisie(24, 24)).toEqual({ dansConditionnement: true, quantite: 1 })
    expect(resteEnSaisie(42, 24)).toEqual({ dansConditionnement: false, quantite: 42 })
    expect(texteReste(COMMANDE.lignes[0])).toBe('1 × Carton de 24')
    expect(texteReste({ ...COMMANDE.lignes[0], resteBase: 42 })).toBe('42 unités')
    expect(texteReste(COMMANDE.lignes[1])).toBe('—')
  })
})

describe('Réception d’une commande', () => {
  it('pré-remplit le reste, signale un prix différent du prix prévu, envoie la commande', () => {
    let b = changerFournisseur(brouillonVide(), 1)
    b = livrerCommande(b, { id: 7, numero: 'CA-2026-000001' }, [
      { article: CARTON_TOMATE, quantite: 1, prixPrevu: 6000 },
      { article: RIZ, quantite: 2.5, prixPrevu: null }
    ])
    expect(b.commande).toEqual({ id: 7, numero: 'CA-2026-000001' })
    expect(b.lignes.map((l) => [l.quantite, l.prix])).toEqual([
      ['1', '6000'],
      ['2,5', '']
    ])
    expect(etatLigne(b.lignes[0], '2026-10-01', 15).alertes).toEqual([])
    b = { ...b, lignes: b.lignes.map((l) => (l.cle === 1 ? { ...l, prix: '6600' } : l)) }
    expect(etatLigne(b.lignes[0], '2026-10-01', 15).alertes).toContain(`prix prévu à la commande : ${formaterFCFA(6000)}`)
    expect(versSaisie(b).commandeId).toBe(7)
  })

  it('changer de fournisseur détache la commande', () => {
    let b = livrerCommande(changerFournisseur(brouillonVide(), 1), { id: 7, numero: 'CA' }, [])
    expect(changerFournisseur(b, 1).commande).toEqual({ id: 7, numero: 'CA' })
    b = changerFournisseur(b, 2)
    expect(b.commande).toBeNull()
    expect(versSaisie(b).commandeId).toBeNull()
  })
})
