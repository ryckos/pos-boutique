import { describe, expect, it } from 'vitest'
import {
  articleReception,
  lireReception,
  listerReceptions,
  validerReception
} from '../src/main/modules/achats/receptions'
import {
  listerFournisseurs,
  creerFournisseur,
  desactiverFournisseur
} from '../src/main/modules/fournisseurs/service'
import { historiqueProduit } from '../src/main/modules/stock/historique'
import { convertirLigne, nouveauCump } from '../src/shared/achats'
import { enregistrerMouvement, stockProduit } from '../src/main/core/mouvements'
import { executer, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1, 15 jours ;
// Lait = produit 2 (périssable, 12 à 2 100) ; Tomate = produit 3 (72 boîtes, CUMP 250).
const KOSSI = 3
const GROSSISTE = 1
const LAIT = 2
const TOMATE = 3
const DATE_LOINTAINE = '2099-11-15'

function conditionnement(db: Db, code: string): number {
  return une<{ id: number }>(
    db,
    'SELECT id FROM conditionnements WHERE code_barres = ? OR code_plu = ?',
    code,
    code
  )!.id
}
const CARTON_TOMATE = '16181000000049'
const UNITE_LAIT = '6181000000028'

function cump(db: Db, produitId: number): number {
  return une<{ c: number }>(db, 'SELECT cout_moyen_pondere AS c FROM produits WHERE id = ?', produitId)!.c
}
/** Ramène le stock de tomate à la valeur voulue par une vente fictive. */
function vendreTomate(db: Db, quantite: number): void {
  enregistrerMouvement(db, {
    produitId: TOMATE,
    type: 'vente',
    quantite: -quantite,
    coutUnitaire: 250,
    utilisateurId: 2
  })
}
function compter(db: Db, table: string): number {
  return une<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`)!.n
}

describe('Réception : règles pures (REGLES_METIER § 4.1 et 4.3)', () => {
  it('3 cartons de 24 à 6 000 → 72 boîtes à 250 F, 18 000 F', () => {
    expect(convertirLigne(3, 6000, 24)).toEqual({ quantiteBase: 72, coutBase: 250, total: 18000 })
  })

  it('au poids, la quantité garde ses décimales et le total est arrondi au franc', () => {
    expect(convertirLigne(2.35, 333, 1)).toEqual({ quantiteBase: 2.35, coutBase: 333, total: 783 })
  })

  it('CUMP : 46 à 250 + 48 à 275 → 262,8', () => {
    expect(nouveauCump(46, 250, 48, 275)).toBeCloseTo(262.766, 3)
  })

  it('CUMP : stock nul ou négatif avant l’entrée → coût de la réception', () => {
    expect(nouveauCump(0, 400, 72, 250)).toBe(250)
    expect(nouveauCump(-8, 400, 72, 250)).toBe(250)
  })
})

describe('Réception : article à recevoir', () => {
  it('décrit le carton de tomate, prix proposé = prix indicatif ramené au carton à défaut d’achat', () => {
    const db = baseAvecDemo()
    executer(db, 'UPDATE produits SET prix_achat_indicatif = 240 WHERE id = ?', TOMATE)
    expect(articleReception(db, conditionnement(db, CARTON_TOMATE))).toEqual({
      produitId: TOMATE,
      conditionnementId: conditionnement(db, CARTON_TOMATE),
      produit: 'Tomate concentrée 70 g',
      conditionnement: 'Carton de 24',
      quantiteBase: 24,
      unite: 'piece',
      suiviPeremption: false,
      prixUnite: 350,
      prixPropose: 5760
    })
  })

  it('propose ensuite le dernier prix payé pour ce conditionnement', () => {
    const db = baseAvecDemo()
    const carton = conditionnement(db, CARTON_TOMATE)
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: carton, quantite: 3, prix: 6000 }]
    })
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: carton, quantite: 2, prix: 6600 }]
    })
    expect(articleReception(db, carton)!.prixPropose).toBe(6600)
  })

  it('rien pour un conditionnement désactivé', () => {
    const db = baseAvecDemo()
    const carton = conditionnement(db, CARTON_TOMATE)
    executer(db, 'UPDATE conditionnements SET actif = 0 WHERE id = ?', carton)
    expect(articleReception(db, carton)).toBeNull()
  })
})

describe('Réception : validation (scénario lundi 8 h, REGLES_METIER § 4.2)', () => {
  function livraisonDuLundi(db: Db) {
    return validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      commentaire: '  BL n° 457 ',
      lignes: [
        { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 },
        {
          conditionnementId: conditionnement(db, UNITE_LAIT),
          quantite: 12,
          prix: 2100,
          numeroLot: ' LOT-B03 ',
          datePeremption: DATE_LOINTAINE
        }
      ]
    })
  }

  it('numéro RC, total 43 200, échéance à 15 jours', () => {
    const db = baseAvecDemo()
    const r = livraisonDuLundi(db)
    const attendue = une<{ d: string }>(db, "SELECT date('now','localtime','+15 days') AS d")!.d
    expect(r).toEqual({
      id: 1,
      numero: `RC-${new Date().getFullYear()}-000001`,
      total: 43200,
      dateEcheance: attendue
    })
  })

  it('enregistre les lignes telles que saisies et les relit', () => {
    const db = baseAvecDemo()
    const { id } = livraisonDuLundi(db)
    const r = lireReception(db, id)
    expect(r).toMatchObject({
      fournisseur: 'Grossiste Hédzranawoé',
      total: 43200,
      utilisateur: 'Kossi',
      commentaire: 'BL n° 457'
    })
    expect(r.lignes).toEqual([
      {
        produitId: TOMATE,
        produit: 'Tomate concentrée 70 g',
        conditionnement: 'Carton de 24',
        quantite: 3,
        prix: 6000,
        quantiteBase: 72,
        coutBase: 250,
        total: 18000,
        numeroLot: null,
        datePeremption: null
      },
      {
        produitId: LAIT,
        produit: 'Lait en poudre 400 g',
        conditionnement: 'Unité',
        quantite: 12,
        prix: 2100,
        quantiteBase: 12,
        coutBase: 2100,
        total: 25200,
        numeroLot: 'LOT-B03',
        datePeremption: DATE_LOINTAINE
      }
    ])
  })

  it('stock de tomate +72 et CUMP à 250 au premier arrivage (stock à zéro avant)', () => {
    const db = baseAvecDemo()
    vendreTomate(db, 72)
    executer(db, 'UPDATE produits SET cout_moyen_pondere = 400 WHERE id = ?', TOMATE)
    livraisonDuLundi(db)
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(cump(db, TOMATE)).toBe(250)
  })

  it('CUMP : 46 boîtes en stock à 250 + 2 cartons à 6 600 → 262,8', () => {
    const db = baseAvecDemo()
    vendreTomate(db, 26)
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 2, prix: 6600 }]
    })
    expect(stockProduit(db, TOMATE)).toBe(94)
    expect(Math.round(cump(db, TOMATE) * 10) / 10).toBe(262.8)
  })

  it('CUMP : stock négatif avant la réception → coût de la réception', () => {
    const db = baseAvecDemo()
    vendreTomate(db, 80)
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 7200 }]
    })
    expect(stockProduit(db, TOMATE)).toBe(64)
    expect(cump(db, TOMATE)).toBe(300)
  })

  it('deux lignes du même produit : le CUMP se calcule ligne après ligne', () => {
    const db = baseAvecDemo()
    vendreTomate(db, 26) // 46 à 250
    const carton = conditionnement(db, CARTON_TOMATE)
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [
        { conditionnementId: carton, quantite: 2, prix: 6600 }, // 94 à 262,77
        { conditionnementId: carton, quantite: 1, prix: 7200 } // + 24 à 300
      ]
    })
    expect(cump(db, TOMATE)).toBeCloseTo((94 * nouveauCump(46, 250, 48, 275) + 24 * 300) / 118, 6)
  })

  it('crée un lot pour le lait (n° et date, coût par unité), aucun pour la tomate', () => {
    const db = baseAvecDemo()
    const { id } = livraisonDuLundi(db)
    const lots = db
      .prepare(
        'SELECT produit_id, numero_lot, date_peremption, prix_achat_unitaire FROM lots WHERE reception_id = ?'
      )
      .all(id)
    expect(lots).toEqual([
      { produit_id: LAIT, numero_lot: 'LOT-B03', date_peremption: DATE_LOINTAINE, prix_achat_unitaire: 2100 }
    ])
  })

  it('mouvements « reception » en unités de base, liés au document et au lot', () => {
    const db = baseAvecDemo()
    const { id } = livraisonDuLundi(db)
    const mv = db
      .prepare(
        `SELECT produit_id, lot_id IS NOT NULL AS avecLot, quantite, cout_unitaire, utilisateur_id
         FROM mouvements_stock WHERE type = 'reception' AND document_type = 'reception' AND document_id = ? ORDER BY id`
      )
      .all(id)
    expect(mv).toEqual([
      { produit_id: TOMATE, avecLot: 0, quantite: 72, cout_unitaire: 250, utilisateur_id: KOSSI },
      { produit_id: LAIT, avecLot: 1, quantite: 12, cout_unitaire: 2100, utilisateur_id: KOSSI }
    ])
  })

  it('la dette du fournisseur est le total de la réception', () => {
    const db = baseAvecDemo()
    livraisonDuLundi(db)
    const f = listerFournisseurs(db).find((x) => x.id === GROSSISTE)!
    expect(f.soldeDu).toBe(43200)
    expect(f.derniereReception).not.toBeNull()
    expect(une(db, 'SELECT solde_du FROM v_dettes_fournisseurs WHERE id = ?', GROSSISTE)).toEqual({
      solde_du: 43200
    })
  })

  it('l’historique de la tomate affiche « Réception RC-… »', () => {
    const db = baseAvecDemo()
    const { numero } = livraisonDuLundi(db)
    const h = historiqueProduit(db, TOMATE)
    expect(h.mouvements.at(-1)).toMatchObject({
      type: 'reception',
      quantite: 72,
      document: `Réception ${numero}`
    })
  })

  it('l’échéance suit le délai du fournisseur : comptant = le jour même', () => {
    const db = baseAvecDemo()
    const comptant = creerFournisseur(db, { nom: 'Boulangerie du Port', delaiPaiementJours: 0 })
    const r = validerReception(db, KOSSI, {
      fournisseurId: comptant,
      lignes: [{ conditionnementId: conditionnement(db, '101'), quantite: 40, prix: 180 }]
    })
    expect(r.dateEcheance).toBe(une<{ d: string }>(db, "SELECT date('now','localtime') AS d")!.d)
  })

  it('liste les réceptions, la plus récente d’abord', () => {
    const db = baseAvecDemo()
    livraisonDuLundi(db)
    const { numero } = livraisonDuLundi(db)
    const liste = listerReceptions(db)
    expect(liste).toHaveLength(2)
    expect(liste[0]).toMatchObject({
      numero,
      fournisseur: 'Grossiste Hédzranawoé',
      total: 43200,
      utilisateur: 'Kossi',
      nbLignes: 2
    })
  })

  it('numéros RC à la suite', () => {
    const db = baseAvecDemo()
    livraisonDuLundi(db)
    expect(livraisonDuLundi(db).numero).toMatch(/-000002$/)
  })
})

describe('Réception : refus (rien n’est écrit)', () => {
  function tenter(
    db: Db,
    lignes: Parameters<typeof validerReception>[2]['lignes'],
    fournisseurId = GROSSISTE
  ) {
    return () => validerReception(db, KOSSI, { fournisseurId, lignes })
  }
  function rienEcrit(db: Db): void {
    expect(compter(db, 'receptions')).toBe(0)
    expect(compter(db, 'lignes_reception')).toBe(0)
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(cump(db, TOMATE)).toBe(250)
    expect(une(db, "SELECT COUNT(*) AS n FROM sequences WHERE prefixe LIKE 'RC-%'")).toEqual({ n: 0 })
  }

  it('sans article', () => {
    const db = baseAvecDemo()
    expect(tenter(db, [])).toThrow(/au moins un article/)
    rienEcrit(db)
  })

  it('fournisseur inconnu ou désactivé', () => {
    const db = baseAvecDemo()
    const l = [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 }]
    expect(tenter(db, l, 99)).toThrow(/fournisseur/)
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(tenter(db, l)).toThrow(/désactivé/)
    rienEcrit(db)
  })

  it.each([0, -1, 2.5, Number.NaN])('quantité %s pour un produit à la pièce', (quantite) => {
    const db = baseAvecDemo()
    expect(
      tenter(db, [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite, prix: 6000 }])
    ).toThrow(/quantité reçue entière/)
    rienEcrit(db)
  })

  it('accepte une quantité à virgule pour un produit au kilo', () => {
    const db = baseAvecDemo()
    executer(db, "UPDATE produits SET unite = 'kg' WHERE id = ?", TOMATE)
    const r = validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, '6181000000042'), quantite: 2.5, prix: 333 }]
    })
    expect(r.total).toBe(833)
    expect(stockProduit(db, TOMATE)).toBe(74.5)
  })

  it.each([0, -100, 6000.5])('prix d’achat %s', (prix) => {
    const db = baseAvecDemo()
    expect(
      tenter(db, [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix }])
    ).toThrow(/prix d’achat/)
    rienEcrit(db)
  })

  it('conditionnement désactivé', () => {
    const db = baseAvecDemo()
    const carton = conditionnement(db, CARTON_TOMATE)
    executer(db, 'UPDATE conditionnements SET actif = 0 WHERE id = ?', carton)
    expect(tenter(db, [{ conditionnementId: carton, quantite: 3, prix: 6000 }])).toThrow(
      /introuvable ou désactivé/
    )
    rienEcrit(db)
  })

  it.each([
    [{ datePeremption: DATE_LOINTAINE }, /numéro de lot/],
    [{ numeroLot: '  ', datePeremption: DATE_LOINTAINE }, /numéro de lot/],
    [{ numeroLot: 'LOT-B03' }, /date de péremption/],
    [{ numeroLot: 'LOT-B03', datePeremption: '2099-02-30' }, /date de péremption/],
    [{ numeroLot: 'LOT-B03', datePeremption: '2020-01-01' }, /déjà passée/]
  ])('produit périssable : %o', (lot, message) => {
    const db = baseAvecDemo()
    const lotsAvant = compter(db, 'lots')
    expect(
      tenter(db, [{ conditionnementId: conditionnement(db, UNITE_LAIT), quantite: 12, prix: 2100, ...lot }])
    ).toThrow(message)
    expect(compter(db, 'lots')).toBe(lotsAvant)
    rienEcrit(db)
  })

  it('une panne en pleine écriture annule tout, y compris la 1ʳᵉ ligne déjà écrite', () => {
    const db = baseAvecDemo()
    // Panne simulée à la création du lot de la 2ᵉ ligne, après l'écriture complète de la 1ʳᵉ.
    db.exec("CREATE TRIGGER panne BEFORE INSERT ON lots BEGIN SELECT RAISE(ABORT, 'panne'); END")
    expect(
      tenter(db, [
        { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 },
        {
          conditionnementId: conditionnement(db, UNITE_LAIT),
          quantite: 12,
          prix: 2100,
          numeroLot: 'L1',
          datePeremption: DATE_LOINTAINE
        }
      ])
    ).toThrow(/panne/)
    rienEcrit(db)
  })

  it('une erreur de saisie sur la 2ᵉ ligne refuse toute la réception', () => {
    const db = baseAvecDemo()
    expect(
      tenter(db, [
        { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 },
        { conditionnementId: conditionnement(db, UNITE_LAIT), quantite: 12, prix: 2100 }
      ])
    ).toThrow(/Lait en poudre 400 g — Unité : indiquez le numéro de lot/)
    rienEcrit(db)
  })
})
