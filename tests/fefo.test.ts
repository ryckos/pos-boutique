import { describe, expect, it } from 'vitest'
import { allouerFefo } from '../src/main/modules/stock/fefo'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, une } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

// Produits de démo. Le lait a déjà un lot DEMO-01 de 12 boîtes, qui périme dans 10 jours.
const RIZ = 1
const LAIT = 2
const GARI = 6
const ADMIN = 1

const lotDemo = (db: Db): number =>
  une<{ id: number }>(db, "SELECT id FROM lots WHERE produit_id = ? AND numero_lot = 'DEMO-01'", LAIT)!.id

/** Lot d'arrivage périmant dans `jours` jours (négatif = déjà périmé), avec `quantite` en stock. */
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
    produitId, lotId, type: 'reception', quantite, coutUnitaire: 2100, utilisateurId: ADMIN
  })
  return lotId
}

function sortir(db: Db, produitId: number, lotId: number, quantite: number): void {
  enregistrerMouvement(db, {
    produitId, lotId, type: 'vente', quantite: -quantite, coutUnitaire: 2100, utilisateurId: ADMIN
  })
}

describe('allouerFefo', () => {
  it('sert d’abord le lot qui périme le plus tôt (scénario : LOT-A12 avant LOT-B03)', () => {
    const db = baseAvecDemo()
    sortir(db, LAIT, lotDemo(db), 12) // on vide le lot de démo pour s'en tenir au scénario
    const b03 = ajouterLot(db, LAIT, 'LOT-B03', 60, 12)
    const a12 = ajouterLot(db, LAIT, 'LOT-A12', 8, 9)

    expect(allouerFefo(db, LAIT, 2)).toEqual([{ lotId: a12, quantite: 2 }])
    // Une vente de 12 : les 9 du LOT-A12, puis 3 du LOT-B03.
    expect(allouerFefo(db, LAIT, 12)).toEqual([
      { lotId: a12, quantite: 9 },
      { lotId: b03, quantite: 3 }
    ])
  })

  it('fait sortir sans lot ce que les lots ne couvrent pas, sans jamais bloquer', () => {
    const db = baseAvecDemo()
    expect(allouerFefo(db, LAIT, 15)).toEqual([
      { lotId: lotDemo(db), quantite: 12 },
      { lotId: null, quantite: 3 }
    ])
  })

  it('renvoie une seule part sans lot pour un produit sans lot', () => {
    const db = baseAvecDemo()
    expect(allouerFefo(db, RIZ, 4)).toEqual([{ lotId: null, quantite: 4 }])
  })

  it('ignore un lot vidé et un lot déjà périmé', () => {
    const db = baseAvecDemo()
    const vide = ajouterLot(db, LAIT, 'LOT-VIDE', 2, 5)
    sortir(db, LAIT, vide, 5)
    ajouterLot(db, LAIT, 'LOT-PERIME', -1, 6)

    expect(allouerFefo(db, LAIT, 3)).toEqual([{ lotId: lotDemo(db), quantite: 3 }])
  })

  it('sert un lot qui périme aujourd’hui', () => {
    const db = baseAvecDemo()
    const aujourdhui = ajouterLot(db, LAIT, 'LOT-J0', 0, 2)
    expect(allouerFefo(db, LAIT, 3)).toEqual([
      { lotId: aujourdhui, quantite: 2 },
      { lotId: lotDemo(db), quantite: 1 }
    ])
  })

  it('à date égale, sert d’abord le lot arrivé le premier', () => {
    const db = baseAvecDemo()
    sortir(db, LAIT, lotDemo(db), 12)
    const premier = ajouterLot(db, LAIT, 'LOT-1', 5, 2)
    const second = ajouterLot(db, LAIT, 'LOT-2', 5, 2)
    expect(allouerFefo(db, LAIT, 3)).toEqual([
      { lotId: premier, quantite: 2 },
      { lotId: second, quantite: 1 }
    ])
  })

  it('accepte une quantité à virgule (vente au poids)', () => {
    const db = baseAvecDemo()
    const lot = ajouterLot(db, GARI, 'LOT-KG', 5, 1.2)
    const parts = allouerFefo(db, GARI, 1.5)
    expect(parts[0]).toEqual({ lotId: lot, quantite: 1.2 })
    expect(parts[1].lotId).toBeNull()
    expect(parts[1].quantite).toBeCloseTo(0.3)
    expect(allouerFefo(db, GARI, 1.2)).toEqual([{ lotId: lot, quantite: 1.2 }])
  })

  it('ne renvoie rien pour une quantité nulle', () => {
    const db = baseAvecDemo()
    expect(allouerFefo(db, LAIT, 0)).toEqual([])
  })
})
