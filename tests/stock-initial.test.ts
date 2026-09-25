import { describe, expect, it } from 'vitest'
import {
  annulerStockInitial,
  enregistrerStockInitial,
  etatStockInitial,
  ficheStockInitial
} from '../src/main/modules/stock/stock-initial'
import { creerProduit, desactiverProduit } from '../src/main/modules/catalogue/produits'
import { enregistrerMouvement, stockProduit } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

// Données de démo : Riz = produit 1, stock venu d'une réception (non concerné par le stock initial).
const RIZ = 1

const admin = (db: Db): number =>
  une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id

/** Tomate concentrée comme dans le scénario : Unité 350, Lot de 3, Carton de 24 ; jamais réceptionnée. */
function tomate(
  db: Db,
  options: { peremption?: boolean; prixAchat?: number } = {}
): {
  id: number
  unite: number
  lot: number
  carton: number
} {
  const { id } = creerProduit(db, {
    nom: 'Tomate concentrée (import)',
    categorieId: 1,
    unite: 'piece',
    tauxTva: 18,
    suiviPeremption: options.peremption ?? false,
    seuilAlerte: 24,
    uniteVente: {
      prixVente: 350,
      codeBarres: '6181000000103',
      codePlu: null,
      boutonTactile: false,
      ordreBouton: 0
    },
    conditionnements: [
      {
        nom: 'Lot de 3',
        quantiteBase: 3,
        prixVente: 1000,
        codeBarres: null,
        codePlu: null,
        boutonTactile: false,
        ordreBouton: 0,
        actif: true
      },
      {
        nom: 'Carton de 24',
        quantiteBase: 24,
        prixVente: 7500,
        codeBarres: null,
        codePlu: null,
        boutonTactile: false,
        ordreBouton: 0,
        actif: true
      }
    ]
  })
  if (options.prixAchat !== undefined) {
    executer(db, 'UPDATE produits SET prix_achat_indicatif = ? WHERE id = ?', options.prixAchat, id)
  }
  const cond = (nom: string): number =>
    une<{ id: number }>(db, 'SELECT id FROM conditionnements WHERE produit_id = ? AND nom = ?', id, nom)!.id
  return { id, unite: cond('Unité'), lot: cond('Lot de 3'), carton: cond('Carton de 24') }
}

/** Le comptage du scénario : 1 carton + 5 lots + 2 unités = 41 boîtes. */
const comptage41 = (t: ReturnType<typeof tomate>): Array<{ conditionnementId: number; nombre: number }> => [
  { conditionnementId: t.carton, nombre: 1 },
  { conditionnementId: t.lot, nombre: 5 },
  { conditionnementId: t.unite, nombre: 2 }
]

const cump = (db: Db, id: number): number =>
  une<{ c: number }>(db, 'SELECT cout_moyen_pondere AS c FROM produits WHERE id = ?', id)!.c

describe('Stock initial — enregistrement', () => {
  it('1 carton + 5 lots + 2 unités à 250 F : stock 41, CUMP 250, valeur 10 250 F', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    const r = enregistrerStockInitial(db, admin(db), {
      produitId: t.id,
      comptage: comptage41(t),
      coutUnitaire: 250
    })
    expect(r).toEqual({ quantiteBase: 41, valeur: 10250 })
    expect(stockProduit(db, t.id)).toBe(41)
    expect(cump(db, t.id)).toBe(250)
    const mouvements = toutes(
      db,
      `SELECT type, quantite, cout_unitaire AS cout, document_type AS document, motif, lot_id AS lot
       FROM mouvements_stock WHERE produit_id = ?`,
      t.id
    )
    expect(mouvements).toEqual([
      {
        type: 'ajustement_inventaire',
        quantite: 41,
        cout: 250,
        document: 'stock_initial',
        motif: 'Stock initial : 1 Carton de 24 + 5 Lot de 3 + 2 Unité',
        lot: null
      }
    ])
  })

  it('propose le prix d’achat venu de l’import et range les conditionnements du plus grand au plus petit', () => {
    const db = baseAvecDemo()
    const t = tomate(db, { prixAchat: 240 })
    const f = ficheStockInitial(db, t.id)
    expect(f).toMatchObject({
      etat: 'a_faire',
      coutPropose: 240,
      prixUnite: 350,
      stockActuel: 0,
      suiviPeremption: false
    })
    expect(f.conditionnements.map((c) => [c.nom, c.quantiteBase])).toEqual([
      ['Carton de 24', 24],
      ['Lot de 3', 3],
      ['Unité', 1]
    ])
  })

  it('refuse un second stock initial pour le même produit', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    enregistrerStockInitial(db, admin(db), { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    expect(() =>
      enregistrerStockInitial(db, admin(db), { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    ).toThrow('déjà enregistré : annulez-le pour le refaire')
  })

  it('refuse un produit qui a déjà reçu une livraison (démo : le riz), sans toucher son CUMP', () => {
    const db = baseAvecDemo()
    const unite = une<{ id: number }>(db, 'SELECT id FROM conditionnements WHERE produit_id = ?', RIZ)!.id
    expect(() =>
      enregistrerStockInitial(db, admin(db), {
        produitId: RIZ,
        comptage: [{ conditionnementId: unite, nombre: 5 }],
        coutUnitaire: 1
      })
    ).toThrow('a déjà reçu une livraison')
    expect(cump(db, RIZ)).toBe(3200)
  })

  it('3 ventes avant le comptage puis 41 comptées : stock 41, la remise à zéro est un mouvement à part', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    enregistrerMouvement(db, {
      produitId: t.id,
      type: 'vente',
      quantite: -3,
      coutUnitaire: 0,
      utilisateurId: admin(db)
    })
    enregistrerStockInitial(db, admin(db), { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    expect(stockProduit(db, t.id)).toBe(41)
    const stockInitial = toutes<{ quantite: number; motif: string }>(
      db,
      "SELECT quantite, motif FROM mouvements_stock WHERE produit_id = ? AND document_type = 'stock_initial' ORDER BY id",
      t.id
    )
    expect(stockInitial.map((m) => m.quantite)).toEqual([41, 3])
    expect(stockInitial[1].motif).toBe('Stock initial : remise à zéro des mouvements antérieurs au comptage')
    // La liste montre ce qui a été compté, pas la somme des deux mouvements.
    expect(etatStockInitial(db).lignes.find((l) => l.produitId === t.id)).toMatchObject({
      quantite: 41,
      stockActuel: 41
    })
  })

  it('produit suivi en péremption : date obligatoire, puis un lot au coût saisi qui porte les 41 boîtes', () => {
    const db = baseAvecDemo()
    const t = tomate(db, { peremption: true })
    const saisie = { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 }
    expect(() => enregistrerStockInitial(db, admin(db), saisie)).toThrow(
      'Indiquez la date de péremption des articles comptés'
    )
    expect(() => enregistrerStockInitial(db, admin(db), { ...saisie, datePeremption: '2026-02-30' })).toThrow(
      'date de péremption'
    )
    enregistrerStockInitial(db, admin(db), { ...saisie, datePeremption: '2026-12-31' })
    const lots = toutes(
      db,
      `SELECT numero_lot AS numero, date_peremption AS date, prix_achat_unitaire AS prix, quantite_restante AS restant
       FROM v_stock_lots WHERE produit_id = ?`,
      t.id
    )
    expect(lots).toEqual([{ numero: null, date: '2026-12-31', prix: 250, restant: 41 }])
  })

  it('refuse un comptage vide, un coût nul ou à virgule, un conditionnement d’un autre produit, un produit désactivé', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    const u = admin(db)
    expect(() =>
      enregistrerStockInitial(db, u, {
        produitId: t.id,
        comptage: [{ conditionnementId: t.unite, nombre: 0 }],
        coutUnitaire: 250
      })
    ).toThrow('Rien n’est compté')
    expect(() =>
      enregistrerStockInitial(db, u, { produitId: t.id, comptage: comptage41(t), coutUnitaire: 0 })
    ).toThrow('supérieur à zéro')
    expect(() =>
      enregistrerStockInitial(db, u, { produitId: t.id, comptage: comptage41(t), coutUnitaire: 262.8 })
    ).toThrow('sans virgule')
    const unRiz = une<{ id: number }>(db, 'SELECT id FROM conditionnements WHERE produit_id = ?', RIZ)!.id
    expect(() =>
      enregistrerStockInitial(db, u, {
        produitId: t.id,
        comptage: [{ conditionnementId: unRiz, nombre: 2 }],
        coutUnitaire: 250
      })
    ).toThrow('Conditionnement introuvable pour ce produit')
    desactiverProduit(db, u, t.id, 'essai')
    expect(() =>
      enregistrerStockInitial(db, u, { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    ).toThrow('est désactivé')
    expect(stockProduit(db, t.id)).toBe(0)
  })
})

describe('Stock initial — annulation', () => {
  it('contre-passe, journalise, et permet de ressaisir avec un autre coût', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    enregistrerMouvement(db, {
      produitId: t.id,
      type: 'vente',
      quantite: -3,
      coutUnitaire: 0,
      utilisateurId: admin(db)
    })
    enregistrerStockInitial(db, admin(db), { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    expect(() => annulerStockInitial(db, admin(db), t.id, '  ')).toThrow('Indiquez pourquoi')

    annulerStockInitial(db, admin(db), t.id, 'carton compté deux fois')
    // Retour à l'état d'avant le comptage : les 3 ventes restent.
    expect(stockProduit(db, t.id)).toBe(-3)
    expect(
      une<{ n: number }>(
        db,
        "SELECT COUNT(*) AS n FROM mouvements_stock WHERE produit_id = ? AND type = 'contre_passation'",
        t.id
      )!.n
    ).toBe(2)
    const journal = une<{ valeur: string }>(
      db,
      "SELECT nouvelle_valeur AS valeur FROM journal_audit WHERE action = 'annulation_stock_initial' AND entite_id = ?",
      t.id
    )!
    expect(JSON.parse(journal.valeur)).toEqual({ motif: 'carton compté deux fois', stock: -3 })
    expect(ficheStockInitial(db, t.id).etat).toBe('a_faire')

    enregistrerStockInitial(db, admin(db), {
      produitId: t.id,
      comptage: [
        { conditionnementId: t.lot, nombre: 5 },
        { conditionnementId: t.unite, nombre: 2 }
      ],
      coutUnitaire: 240
    })
    expect(stockProduit(db, t.id)).toBe(17)
    expect(cump(db, t.id)).toBe(240)
  })

  it('refuse d’annuler un produit sans stock initial', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    expect(() => annulerStockInitial(db, admin(db), t.id, 'essai')).toThrow(
      'n’a pas de stock initial à annuler'
    )
  })
})

describe('Stock initial — liste', () => {
  it('compte les produits faits et à faire, et la valeur totale', () => {
    const db = baseAvecDemo()
    const t = tomate(db)
    const avant = etatStockInitial(db)
    // Démo : 7 produits, tous réceptionnés → non concernés.
    expect(avant).toMatchObject({ nbFaits: 0, nbAFaire: 1, valeurTotale: 0 })
    expect(avant.lignes.filter((l) => l.etat === 'non_concerne')).toHaveLength(7)

    enregistrerStockInitial(db, admin(db), { produitId: t.id, comptage: comptage41(t), coutUnitaire: 250 })
    const apres = etatStockInitial(db)
    expect(apres).toMatchObject({ nbFaits: 1, nbAFaire: 0, valeurTotale: 10250 })
    expect(apres.lignes.find((l) => l.produitId === t.id)).toMatchObject({
      etat: 'fait',
      rayon: 'Alimentation',
      quantite: 41,
      coutUnitaire: 250,
      prixUnite: 350
    })
  })
})
