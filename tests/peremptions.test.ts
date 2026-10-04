import { describe, expect, it } from 'vitest'
import { retirerLot, tableauPeremptions } from '../src/main/modules/stock/peremptions'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

const LAIT = 2
const JUS = 4
const GERANT = 3

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
  return lotId
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

function creerYaourt(db: Db): number {
  return executer(
    db,
    "INSERT INTO produits (nom, taux_tva, suivi_peremption, seuil_alerte, cout_moyen_pondere) VALUES ('Yaourt nature', 18, 1, 6, 300)"
  ).id
}

const stock = (db: Db, produitId: number): number =>
  une<{ s: number }>(db, 'SELECT COALESCE(SUM(quantite), 0) AS s FROM mouvements_stock WHERE produit_id = ?', produitId)!.s

describe('tableau des péremptions', () => {
  it('reprend le mardi du scénario : 5 400 + 18 900 = 24 300 F en jeu', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    const yaourt = creerYaourt(db)
    ajouterLot(db, yaourt, 'LOT-Y07', 3, 18, 300)
    ajouterLot(db, LAIT, 'LOT-A12', 8, 9, 2100)
    ajouterLot(db, LAIT, 'LOT-B03', 60, 12, 2100) // au-delà des 15 jours : absent

    const t = tableauPeremptions(db)
    expect(t.horizonJours).toBe(15)
    expect(t.valeurTotale).toBe(24300)
    expect(t.lots.map((l) => [l.produit, l.numeroLot, l.joursRestants, l.restant, l.valeur, l.urgent])).toEqual([
      ['Yaourt nature', 'LOT-Y07', 3, 18, 5400, true],
      ['Lait en poudre 400 g', 'LOT-A12', 8, 9, 18900, false]
    ])
  })

  it('montre les lots déjà périmés en premier, en urgent, et ignore les lots vides', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    ajouterLot(db, LAIT, 'LOT-PERIME', -2, 4, 2100)
    const vide = ajouterLot(db, JUS, 'LOT-VIDE', 5, 6, 420)
    retirerLot(db, GERANT, { lotId: vide, quantite: 6 })

    const t = tableauPeremptions(db)
    expect(t.lots).toHaveLength(1)
    expect(t.lots[0]).toMatchObject({ numeroLot: 'LOT-PERIME', joursRestants: -2, urgent: true, valeur: 8400 })
  })

  it('suit le paramètre peremption_seuil_jours', () => {
    const db = baseAvecDemo()
    executer(db, "INSERT INTO parametres (cle, valeur) VALUES ('peremption_seuil_jours', '7')")
    const t = tableauPeremptions(db)
    expect(t.horizonJours).toBe(7)
    expect(t.lots).toEqual([]) // les lots de démo périment dans 10 jours
  })
})

describe('retirer un lot', () => {
  it('sort la quantité du lot en perte_peremption, au CUMP, motif « Périmé »', () => {
    const db = baseAvecDemo()
    const lot = ajouterLot(db, LAIT, 'LOT-A12', 8, 9, 2100)
    const avant = stock(db, LAIT)

    expect(retirerLot(db, GERANT, { lotId: lot, quantite: 4, commentaire: ' boîtes cabossées ' })).toEqual({
      restant: 5
    })
    expect(stock(db, LAIT)).toBe(avant - 4)
    const m = une<Record<string, unknown>>(
      db,
      'SELECT type, quantite, lot_id AS lotId, cout_unitaire AS cout, motif, utilisateur_id AS u FROM mouvements_stock ORDER BY id DESC LIMIT 1'
    )
    expect(m).toEqual({
      type: 'perte_peremption', quantite: -4, lotId: lot, cout: 2100, motif: 'Périmé : boîtes cabossées', u: GERANT
    })
  })

  it('un lot retiré en entier disparaît du tableau, et un second retrait est refusé', () => {
    const db = baseAvecDemo()
    viderLotsDemo(db)
    const lot = ajouterLot(db, LAIT, 'LOT-A12', 8, 9, 2100)

    expect(retirerLot(db, GERANT, { lotId: lot, quantite: 9 })).toEqual({ restant: 0 })
    expect(tableauPeremptions(db).lots).toEqual([])
    expect(() => retirerLot(db, GERANT, { lotId: lot, quantite: 1 })).toThrow('n’a plus de stock')
  })

  it('refuse plus que le restant, une quantité nulle, une quantité à virgule hors poids, un lot inconnu', () => {
    const db = baseAvecDemo()
    const lot = ajouterLot(db, LAIT, 'LOT-A12', 8, 9, 2100)
    expect(() => retirerLot(db, GERANT, { lotId: lot, quantite: 10 })).toThrow('au plus')
    expect(() => retirerLot(db, GERANT, { lotId: lot, quantite: 0 })).toThrow('quantité')
    expect(() => retirerLot(db, GERANT, { lotId: lot, quantite: 1.5 })).toThrow('entier')
    expect(() => retirerLot(db, GERANT, { lotId: 9999, quantite: 1 })).toThrow('n’existe pas')
  })
})
