import { describe, expect, it } from 'vitest'
import type { Categorie } from '../src/shared/ipc/catalogue'
import type { Promotion } from '../src/shared/ipc/promotions'
import type { ArticleCatalogue } from '../src/shared/types'
import {
  apercuPrix,
  blocage,
  estModifiable,
  filtrerPromotions,
  formulaireDepuis,
  formulaireVide,
  lirePreRemplissage,
  lireValeur,
  nomDuProduit,
  nomSuggere,
  optionsRayons,
  versSaisie,
  type FormulairePromotion
} from '../src/renderer/src/modules/promotions/promotions'

const tomate = (f: Partial<FormulairePromotion> = {}): FormulairePromotion => ({
  ...formulaireVide('2026-11-02', '2026-11-09'),
  produit: { id: 3, nom: 'Tomate concentrée' },
  valeur: '20',
  ...f
})

const article = (conditionnement: string, quantiteBase: number, prixVente: number): ArticleCatalogue => ({
  conditionnementId: quantiteBase,
  produitId: 3,
  designation: quantiteBase > 1 ? `Tomate — ${conditionnement}` : 'Tomate',
  conditionnement,
  quantiteBase,
  prixVente,
  tauxTva: 18,
  suiviPeremption: false,
  coutConditionnement: 250 * quantiteBase,
  codeBarres: null,
  codePlu: null
})

const promo = (p: Partial<Promotion>): Promotion => ({
  id: 1,
  nom: 'Promo',
  type: 'remise_pourcent',
  valeur: 20,
  produitId: 3,
  produit: 'Tomate',
  categorieId: null,
  categorie: null,
  dateDebut: '2026-11-02',
  dateFin: '2026-11-09',
  etat: 'en_cours',
  ...p
})

describe('Formulaire de promotion (A16)', () => {
  it('valeur : entier positif seulement, espaces tolérés', () => {
    expect(lireValeur('20')).toBe(20)
    expect(lireValeur(' 1 000 ')).toBe(1000)
    expect(lireValeur('12,5')).toBeNaN()
    expect(lireValeur('-5')).toBeNaN()
    expect(lireValeur('')).toBeNaN()
  })

  it('nom suggéré à partir de la cible et de la règle', () => {
    expect(nomSuggere(tomate(), null)).toBe('Tomate concentrée −20 %')
    expect(nomSuggere(tomate({ cible: 'rayon', produit: null }), 'Boissons')).toBe('Boissons −20 %')
    expect(nomSuggere(tomate({ valeur: '' }), null)).toBe('')
  })

  it('le nom du produit sans son conditionnement', () => {
    expect(nomDuProduit('Tomate concentrée — Carton de 24')).toBe('Tomate concentrée')
    expect(nomDuProduit('Baguette')).toBe('Baguette')
  })

  it('blocages, dans l’ordre où on les rencontre', () => {
    expect(blocage(tomate({ produit: null }), null)).toMatch(/produit/)
    expect(blocage(tomate({ cible: 'rayon', produit: null }), null)).toMatch(/rayon/)
    expect(blocage(tomate({ valeur: '' }), null)).toMatch(/valeur/)
    expect(blocage(tomate({ valeur: '100' }), null)).toMatch(/1 à 99/)
    expect(blocage(tomate({ type: 'prix_fixe', valeur: '100' }), null)).toBeNull()
    expect(blocage(tomate({ dateDebut: '2026-11-10' }), null)).toMatch(/précéder/)
    expect(blocage(tomate(), null)).toBeNull()
  })

  it('envoi : nom proposé si vide, nom tapé sinon, cible produit OU rayon', () => {
    expect(versSaisie(tomate(), null)).toEqual({
      nom: 'Tomate concentrée −20 %',
      type: 'remise_pourcent',
      valeur: 20,
      produitId: 3,
      categorieId: null,
      dateDebut: '2026-11-02',
      dateFin: '2026-11-09'
    })
    expect(versSaisie(tomate({ nom: '  Offre de la semaine ' }), null)?.nom).toBe('Offre de la semaine')
    const rayon = versSaisie(tomate({ cible: 'rayon', produit: null, categorieId: 7 }), 'Boissons')
    expect(rayon).toMatchObject({ produitId: null, categorieId: 7, nom: 'Boissons −20 %' })
    expect(versSaisie(tomate({ valeur: '' }), null)).toBeNull()
  })

  it('modification : le formulaire reprend la promotion telle quelle', () => {
    const f = formulaireDepuis(promo({ nom: 'Tomate −20 %', valeur: 20 }))
    expect(f).toMatchObject({ nom: 'Tomate −20 %', valeur: '20', cible: 'produit', produit: { id: 3 } })
    const r = formulaireDepuis(
      promo({ produitId: null, produit: null, categorieId: 5, categorie: 'Boissons' })
    )
    expect(r).toMatchObject({ cible: 'rayon', categorieId: 5, produit: null })
  })
})

describe('Aperçu des prix (A16)', () => {
  const tomates = [article('Unité', 1, 350), article('Lot de 3', 3, 1000), article('Carton de 24', 24, 7500)]

  it('−20 % : 280 / 800 / 6 000', () => {
    expect(apercuPrix(tomate(), tomates).map((l) => l.prixPromo)).toEqual([280, 800, 6000])
  })

  it('prix fixe 400 F : aucun effet, affiché comme tel', () => {
    expect(apercuPrix(tomate({ type: 'prix_fixe', valeur: '400' }), tomates).map((l) => l.prixPromo)).toEqual(
      [null, null, null]
    )
  })

  it('valeur pas encore saisie : aucun prix promotionnel', () => {
    expect(apercuPrix(tomate({ valeur: '' }), tomates).every((l) => l.prixPromo === null)).toBe(true)
  })
})

describe('Liste des promotions (A16)', () => {
  const liste = [
    promo({ id: 1, etat: 'a_venir', dateDebut: '2026-11-20' }),
    promo({ id: 2, etat: 'en_cours', dateDebut: '2026-11-05' }),
    promo({ id: 3, etat: 'terminee' }),
    promo({ id: 4, etat: 'arretee' }),
    promo({ id: 5, etat: 'a_venir', dateDebut: '2026-11-10' }),
    promo({ id: 6, etat: 'en_cours', dateDebut: '2026-11-01' })
  ]

  it('« En cours et à venir » : en cours d’abord, puis par date de début', () => {
    expect(filtrerPromotions(liste, 'actives').map((p) => p.id)).toEqual([6, 2, 5, 1])
  })

  it('« Terminées et arrêtées »', () => {
    expect(filtrerPromotions(liste, 'terminees').map((p) => p.id)).toEqual([3, 4])
  })

  it('seule une promotion en cours ou à venir se modifie ou s’arrête', () => {
    expect(liste.map(estModifiable)).toEqual([true, true, false, false, true, true])
  })
})

describe('Lien depuis un autre écran (A16)', () => {
  it('produit, pourcentage et fin lus dans le lien', () => {
    expect(lirePreRemplissage(new URLSearchParams('produit=12&pourcent=20&fin=2026-11-15'))).toEqual({
      produitId: 12,
      pourcent: 20,
      fin: '2026-11-15'
    })
  })

  it('valeurs invalides ignorées, sans produit aucun pré-remplissage', () => {
    expect(lirePreRemplissage(new URLSearchParams('produit=12&pourcent=150&fin=demain'))).toEqual({
      produitId: 12,
      pourcent: null,
      fin: null
    })
    expect(lirePreRemplissage(new URLSearchParams('pourcent=20'))).toBeNull()
    expect(lirePreRemplissage(new URLSearchParams('produit=abc'))).toBeNull()
  })
})

describe('Choix du rayon (A16)', () => {
  const categories: Categorie[] = [
    { id: 1, nom: 'Boissons', parentId: null, actif: true, nbProduits: 0 },
    { id: 2, nom: 'Alimentation', parentId: null, actif: true, nbProduits: 0 },
    { id: 3, nom: 'Conserves', parentId: 2, actif: true, nbProduits: 4 },
    { id: 4, nom: 'Ancien rayon', parentId: null, actif: false, nbProduits: 0 }
  ]

  it('rayons et sous-rayons actifs, par ordre alphabétique', () => {
    expect(optionsRayons(categories).map((r) => r.libelle)).toEqual([
      'Alimentation',
      'Alimentation › Conserves',
      'Boissons'
    ])
  })
})

// ─── Caisse : le panier au prix du jour (A16) ───
import {
  ajouterArticle,
  appliquerPromotion,
  appliquerPromotions,
  economiePanier,
  panierVide,
  reducteurPanier,
  totalPanier,
  versPanierClient
} from '../src/renderer/src/modules/caisse/panier'
import type { PromotionEnCours } from '../src/shared/ipc/promotions'

describe('Panier sous promotion (A16)', () => {
  const unite = article('Unité', 1, 350)
  const carton = article('Carton de 24', 24, 7500)
  const moins20: PromotionEnCours = {
    id: 1,
    nom: 'Tomate −20 %',
    type: 'remise_pourcent',
    valeur: 20,
    produitIds: [3]
  }
  const moins50F: PromotionEnCours = {
    id: 2,
    nom: '−50 F',
    type: 'remise_montant',
    valeur: 50,
    produitIds: [3]
  }

  it('l’article prend le prix promotionnel et garde le prix normal', () => {
    expect(appliquerPromotion(unite, [moins20])).toMatchObject({
      prixVente: 280,
      prixNormal: 350,
      promotion: { id: 1, nom: 'Tomate −20 %' }
    })
    expect(appliquerPromotion(carton, [moins20]).prixVente).toBe(6000)
  })

  it('la plus avantageuse seule, sans cumul ; un autre produit n’est pas touché', () => {
    expect(appliquerPromotion(unite, [moins50F, moins20]).prixVente).toBe(280)
    expect(appliquerPromotion(carton, [moins50F, moins20]).prixVente).toBe(6000)
    const autre = { ...unite, produitId: 9 }
    expect(appliquerPromotion(autre, [moins20])).toBe(autre)
  })

  it('idempotent : refaire le calcul ne change rien, et n’applique pas une promotion sur une promotion', () => {
    const une = appliquerPromotion(unite, [moins20])
    expect(appliquerPromotion(une, [moins20])).toBe(une)
    expect(appliquerPromotion(une, [moins50F]).prixVente).toBe(300)
  })

  it('la promotion qui se termine rend le prix normal', () => {
    const une = appliquerPromotion(unite, [moins20])
    const retour = appliquerPromotion(une, [])
    expect(retour).toEqual(unite)
    expect(retour.prixNormal).toBeUndefined()
  })

  it('panier : 1 carton + 2 unités = 6 560 F au lieu de 8 200 F, économie 1 640 F', () => {
    let p = ajouterArticle(panierVide, carton)
    p = ajouterArticle(p, unite)
    p = ajouterArticle(p, unite)
    expect(totalPanier(p)).toBe(8200)
    const promo = reducteurPanier(p, { type: 'promotions', promotions: [moins20] })
    expect(totalPanier(promo)).toBe(6560)
    expect(economiePanier(promo)).toBe(1640)
    expect(economiePanier(p)).toBe(0)
  })

  it('rien à changer : le même panier est rendu (pas de rendu inutile)', () => {
    const p = ajouterArticle(panierVide, unite)
    expect(appliquerPromotions(p, [])).toBe(p)
    const promo = appliquerPromotions(p, [moins20])
    expect(appliquerPromotions(promo, [moins20])).toBe(promo)
  })

  it('une remise de ligne trop grande pour le nouveau prix est ramenée à la ligne', () => {
    let p = ajouterArticle(panierVide, unite)
    p = reducteurPanier(p, { type: 'remiserLigne', conditionnementId: 1, montant: 340 })
    const promo = reducteurPanier(p, { type: 'promotions', promotions: [moins20] })
    expect(promo.lignes[0].remise).toBe(280)
    expect(totalPanier(promo)).toBe(0)
  })

  it('écran client : la ligne en promotion montre le nom et le total au prix normal', () => {
    let p = ajouterArticle(panierVide, carton)
    p = ajouterArticle(p, carton)
    const client = versPanierClient(reducteurPanier(p, { type: 'promotions', promotions: [moins20] }))
    expect(client.lignes[0]).toMatchObject({
      total: 12000,
      promotion: { nom: 'Tomate −20 %', totalNormal: 15000 }
    })
    expect(versPanierClient(p).lignes[0].promotion).toBeUndefined()
  })
})
