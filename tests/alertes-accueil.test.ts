import { describe, expect, it } from 'vitest'
import { alertesAccueil } from '../src/main/modules/stock/alertes'
import { tableauPeremptions } from '../src/main/modules/stock/peremptions'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

// Démo : riz 20 (seuil 5), lait 12 (6), tomate 72 (24), jus 18 (6), gari 25 (10), savon 30 (12).
const RIZ = 1
const LAIT = 2
const TOMATE = 3
const JUS = 4
const GARI = 6
const SAVON = 7
const GERANT = 3

/** Sortie (vente) de `quantite` unités de base, sans lot. */
function vendre(db: Db, produitId: number, quantite: number): void {
  enregistrerMouvement(db, {
    produitId, lotId: null, type: 'vente', quantite: -quantite, coutUnitaire: 0, utilisateurId: GERANT
  })
}

/** Lot d'arrivage périmant dans `jours` jours (négatif = déjà périmé), avec `quantite` en stock. */
function ajouterLot(db: Db, produitId: number, numero: string, jours: number, quantite: number, prix: number) {
  const lotId = executer(
    db,
    `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire)
     VALUES (?, ?, date('now','localtime', ?), ?)`,
    produitId,
    numero,
    `${jours} days`,
    prix
  ).id
  enregistrerMouvement(db, {
    produitId, lotId, type: 'reception', quantite, coutUnitaire: prix, utilisateurId: GERANT
  })
}

/** Vide les lots de démo (lait et jus, à 10 jours) pour s'en tenir aux lots du test. */
function viderLotsDemo(db: Db): void {
  for (const l of toutes<{ id: number; produitId: number; restant: number }>(
    db,
    "SELECT id, produit_id AS produitId, quantite_restante AS restant FROM v_stock_lots WHERE numero_lot = 'DEMO-01'"
  )) {
    enregistrerMouvement(db, {
      produitId: l.produitId, lotId: l.id, type: 'vente', quantite: -l.restant, coutUnitaire: 0, utilisateurId: GERANT
    })
  }
}

describe('alertes de l’accueil — stock', () => {
  it('sépare ruptures et stocks bas, ruptures d’abord puis du stock le plus bas', () => {
    const db = baseAvecDemo()
    vendre(db, RIZ, 20) // 0 : rupture
    vendre(db, GARI, 27) // −2 : rupture (D-A1)
    vendre(db, LAIT, 8) // 4 ≤ 6 : stock bas
    vendre(db, SAVON, 18) // 12 = seuil : stock bas

    const { stock } = alertesAccueil(db)
    expect(stock.nbRuptures).toBe(2)
    expect(stock.nbStockBas).toBe(2)
    expect(stock.produits.map((p) => [p.nom, p.stock, p.niveau])).toEqual([
      ['Gari (sachet)', -2, 'rupture'],
      ['Riz parfumé 5 kg', 0, 'rupture'],
      ['Lait en poudre 400 g', 4, 'stock_bas'],
      ['Savon de ménage', 12, 'stock_bas']
    ])
  })

  it('compte tout mais ne détaille que les 5 premiers ; ignore un produit désactivé', () => {
    const db = baseAvecDemo()
    for (const [id, q] of [[RIZ, 20], [LAIT, 12], [TOMATE, 72], [JUS, 18], [GARI, 25], [SAVON, 25]]) {
      vendre(db, id, q)
    }
    executer(db, 'UPDATE produits SET actif = 0 WHERE id = ?', TOMATE)

    const { stock } = alertesAccueil(db)
    expect(stock.nbRuptures).toBe(4)
    expect(stock.nbStockBas).toBe(1)
    expect(stock.produits).toHaveLength(5)
    expect(stock.produits.map((p) => p.produitId)).not.toContain(TOMATE)
    expect(stock.produits[4]).toMatchObject({ produitId: SAVON, stock: 5, niveau: 'stock_bas' })
  })

  it('base sans alerte : tout à zéro, listes vides', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    // Les lots de démo vidés font passer lait et jus à 0 : on les remet au-dessus du seuil.
    enregistrerMouvement(db, { produitId: LAIT, lotId: null, type: 'reception', quantite: 12, coutUnitaire: 2100, utilisateurId: GERANT })
    enregistrerMouvement(db, { produitId: JUS, lotId: null, type: 'reception', quantite: 18, coutUnitaire: 420, utilisateurId: GERANT })

    expect(alertesAccueil(db)).toEqual({
      stock: { nbRuptures: 0, nbStockBas: 0, produits: [] },
      peremptions: { horizonJours: 15, nbPerimes: 0, nbUrgents: 0, nbProches: 0, valeurEnJeu: 0, lots: [] }
    })
  })
})

describe('alertes de l’accueil — péremptions', () => {
  it('compte périmés, urgents et proches ; valeur en jeu identique au tableau des péremptions', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    ajouterLot(db, LAIT, 'LOT-PERIME', -2, 4, 2100) // périmé : 8 400
    ajouterLot(db, LAIT, 'LOT-A12', 0, 2, 2100) // périme aujourd'hui : urgent, 4 200
    ajouterLot(db, JUS, 'LOT-J03', 3, 6, 420) // 3 jours : urgent, 2 520
    ajouterLot(db, JUS, 'LOT-J08', 8, 10, 420) // ambre : 4 200
    ajouterLot(db, JUS, 'LOT-J60', 60, 10, 420) // hors horizon

    const { peremptions } = alertesAccueil(db)
    expect(peremptions).toMatchObject({ horizonJours: 15, nbPerimes: 1, nbUrgents: 2, nbProches: 1 })
    expect(peremptions.valeurEnJeu).toBe(19320)
    expect(peremptions.valeurEnJeu).toBe(tableauPeremptions(db).valeurTotale)
    expect(peremptions.lots.map((l) => l.numeroLot)).toEqual(['LOT-PERIME', 'LOT-A12', 'LOT-J03', 'LOT-J08'])
  })

  it('ne détaille que les 5 lots les plus proches, mais les compte tous', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    for (let j = 1; j <= 7; j++) ajouterLot(db, JUS, `LOT-${j}`, j, 1, 420)

    const { peremptions } = alertesAccueil(db)
    expect(peremptions.nbUrgents + peremptions.nbProches).toBe(7)
    expect(peremptions.valeurEnJeu).toBe(7 * 420)
    expect(peremptions.lots.map((l) => l.numeroLot)).toEqual(['LOT-1', 'LOT-2', 'LOT-3', 'LOT-4', 'LOT-5'])
  })
})
