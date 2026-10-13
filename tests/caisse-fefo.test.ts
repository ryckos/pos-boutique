import { describe, expect, it } from 'vitest'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import { baseAvecDemo } from './aide'

// Démo : lait en poudre (produit 2, 2 800 F, CUMP 2 100, lot DEMO-01 de 12 boîtes à +10 jours) ;
// jus d'ananas (produit 4, unité 600 F, pack de 6 à 3 300 F, lot DEMO-01 de 18 à +10 jours).
const ADMIN = 1
const AFI = 2
const LAIT = 2
const JUS = 4
const TOMATE = 3
const CODE_LAIT = '6181000000028'
const CODE_JUS = '6034000012345'
const CARTON_TOMATE = '16181000000049'

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId
const lotDemo = (db: Db, produitId: number): number =>
  une<{ id: number }>(db, "SELECT id FROM lots WHERE produit_id = ? AND numero_lot = 'DEMO-01'", produitId)!
    .id

/** Lot d'arrivage qui périme dans `jours` jours (négatif = déjà périmé), avec `quantite` en stock. */
function ajouterLot(db: Db, produitId: number, numero: string, jours: number, quantite: number): number {
  const lotId = executer(
    db,
    `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire)
     VALUES (?, ?, date('now','localtime', ?), 2100)`,
    produitId,
    numero,
    `${jours} days`
  ).id
  enregistrerMouvement(db, {
    produitId,
    lotId,
    type: 'reception',
    quantite,
    coutUnitaire: 2100,
    utilisateurId: ADMIN
  })
  return lotId
}

/** Vide le lot de démo du lait pour s'en tenir aux lots du scénario. */
function viderLotDemo(db: Db): void {
  enregistrerMouvement(db, {
    produitId: LAIT,
    lotId: lotDemo(db, LAIT),
    type: 'casse',
    quantite: -12,
    coutUnitaire: 2100,
    utilisateurId: ADMIN
  })
}

/** Mardi du scénario : LOT-A12 (9 boîtes, 8 jours) et LOT-B03 (12 boîtes, plus tard). */
function mardi(): { db: Db; a12: number; b03: number } {
  const db = baseAvecDemo()
  viderLotDemo(db)
  const b03 = ajouterLot(db, LAIT, 'LOT-B03', 60, 12)
  const a12 = ajouterLot(db, LAIT, 'LOT-A12', 8, 9)
  ouvrirSession(db, AFI, 10000)
  return { db, a12, b03 }
}

const especes = (lignes: RequeteVente['lignes'], montant: number): RequeteVente => ({
  lignes,
  paiements: [{ mode: 'especes', montant }]
})

const mouvementsVente = (
  db: Db,
  venteId: number
): { produitId: number; lotId: number | null; quantite: number }[] =>
  toutes(
    db,
    `SELECT produit_id AS produitId, lot_id AS lotId, quantite FROM mouvements_stock
     WHERE document_type = 'vente' AND document_id = ? ORDER BY id`,
    venteId
  )

const restantLot = (db: Db, lotId: number): number =>
  une<{ q: number }>(
    db,
    'SELECT COALESCE(SUM(quantite), 0) AS q FROM mouvements_stock WHERE lot_id = ?',
    lotId
  )!.q

const lotDeLigne = (db: Db, venteId: number): (number | null)[] =>
  toutes<{ lotId: number | null }>(
    db,
    'SELECT lot_id AS lotId FROM lignes_vente WHERE vente_id = ? ORDER BY id',
    venteId
  ).map((l) => l.lotId)

describe('Vente en FEFO (A9)', () => {
  it('12 boîtes de lait : 9 du LOT-A12 puis 3 du LOT-B03 ; restants 0 et 9', () => {
    const { db, a12, b03 } = mardi()
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 12 }], 33600)
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([
      { produitId: LAIT, lotId: a12, quantite: -9 },
      { produitId: LAIT, lotId: b03, quantite: -3 }
    ])
    expect(restantLot(db, a12)).toBe(0)
    expect(restantLot(db, b03)).toBe(9)
    // Deux lots pour une ligne : la ligne ne porte pas de lot, les mouvements font foi.
    expect(lotDeLigne(db, v.venteId)).toEqual([null])
    expect(v.alertesStock).toEqual([])
    expect(v.alertesPeremption).toEqual([])
  })

  it('5 boîtes : un seul lot, noté sur la ligne ; coût de la ligne au CUMP', () => {
    const { db, a12 } = mardi()
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 5 }], 14000)
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([{ produitId: LAIT, lotId: a12, quantite: -5 }])
    expect(lotDeLigne(db, v.venteId)).toEqual([a12])
    expect(restantLot(db, a12)).toBe(4)
    const ligne = une<{ cout: number }>(
      db,
      'SELECT cout_unitaire AS cout FROM lignes_vente WHERE vente_id = ?',
      v.venteId
    )!
    expect(ligne.cout).toBe(2100)
  })

  it('deux lignes du même produit : la seconde reprend où la première s’arrête', () => {
    const db = baseAvecDemo()
    const lot18 = lotDemo(db, JUS)
    const proche = ajouterLot(db, JUS, 'LOT-J01', 3, 4)
    ouvrirSession(db, AFI, 10000)
    const pack = une<{ id: number }>(
      db,
      "SELECT id FROM conditionnements WHERE produit_id = ? AND nom = 'Pack de 6'",
      JUS
    )!.id
    // 1 pack (6) + 2 unités : 4 du lot à 3 jours + 2 du lot de démo, puis 2 du lot de démo.
    const v = enregistrerVente(
      db,
      AFI,
      especes(
        [
          { conditionnementId: pack, quantite: 1 },
          { conditionnementId: id(db, CODE_JUS), quantite: 2 }
        ],
        4500
      )
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([
      { produitId: JUS, lotId: proche, quantite: -4 },
      { produitId: JUS, lotId: lot18, quantite: -2 },
      { produitId: JUS, lotId: lot18, quantite: -2 }
    ])
    expect(lotDeLigne(db, v.venteId)).toEqual([null, lot18])
    expect(restantLot(db, lot18)).toBe(14)
  })

  it('plus que les lots : le reste sort sans lot, la vente passe avec l’alerte de stock', () => {
    const { db, a12, b03 } = mardi()
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 23 }], 64400)
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([
      { produitId: LAIT, lotId: a12, quantite: -9 },
      { produitId: LAIT, lotId: b03, quantite: -12 },
      { produitId: LAIT, lotId: null, quantite: -2 }
    ])
    expect(v.alertesStock).toEqual([{ produitId: LAIT, designation: 'Lait en poudre 400 g', stockApres: -2 }])
    // Aucun lot périmé en stock : pas d'alerte de péremption.
    expect(v.alertesPeremption).toEqual([])
  })

  it('un lot périmé n’est jamais servi ; s’il reste seul en stock, la caissière est prévenue', () => {
    const db = baseAvecDemo()
    viderLotDemo(db)
    const perime = ajouterLot(db, LAIT, 'LOT-A12', -2, 3)
    ouvrirSession(db, AFI, 10000)
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 1 }], 2800)
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([{ produitId: LAIT, lotId: null, quantite: -1 }])
    expect(restantLot(db, perime)).toBe(3)
    expect(v.alertesPeremption).toEqual([
      { produitId: LAIT, designation: 'Lait en poudre 400 g', lots: ['LOT-A12'] }
    ])
  })

  it('lot valable servi d’abord, même si un lot périmé reste : pas d’alerte', () => {
    const { db } = mardi()
    ajouterLot(db, LAIT, 'LOT-Z00', -1, 2)
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 2 }], 5600)
    )
    expect(mouvementsVente(db, v.venteId).every((m) => m.lotId !== null)).toBe(true)
    expect(v.alertesPeremption).toEqual([])
  })

  it('produit non suivi (tomate) : un seul mouvement sans lot, comme avant', () => {
    const db = baseAvecDemo()
    ouvrirSession(db, AFI, 10000)
    const v = enregistrerVente(
      db,
      AFI,
      especes([{ conditionnementId: id(db, CARTON_TOMATE), quantite: 1 }], 7500)
    )
    expect(mouvementsVente(db, v.venteId)).toEqual([{ produitId: TOMATE, lotId: null, quantite: -24 }])
    expect(v.alertesPeremption).toEqual([])
  })

  it('refus de la vente : aucun mouvement, les lots sont intacts', () => {
    const { db, a12, b03 } = mardi()
    expect(() =>
      enregistrerVente(db, AFI, especes([{ conditionnementId: id(db, CODE_LAIT), quantite: 12 }], 30000))
    ).toThrow(/Paiement incomplet/)
    expect(restantLot(db, a12)).toBe(9)
    expect(restantLot(db, b03)).toBe(12)
    expect(une(db, "SELECT id FROM mouvements_stock WHERE document_type = 'vente'")).toBeUndefined()
  })
})
