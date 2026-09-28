import { describe, expect, it } from 'vitest'
import { etatStock } from '../src/main/modules/stock/etat'
import { repartirStock } from '../src/shared/stock'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, une } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

// Produits de démo (tous entrés en stock aujourd'hui, jamais vendus).
const RIZ = 1
const TOMATE = 3
const BAGUETTE = 5
const SAVON = 7

const CARTON = { nom: 'Carton de 24', quantiteBase: 24 }
const LOT = { nom: 'Lot de 3', quantiteBase: 3 }
const UNITE = { nom: 'Unité', quantiteBase: 1 }

/** Date locale SQLite décalée de `jours` par rapport à maintenant. */
const dans = (db: Db, jours: number): string =>
  une<{ d: string }>(db, "SELECT datetime('now','localtime', ?) AS d", `${jours} days`)!.d

const ligne = (db: Db, produitId: number, maintenant?: string) =>
  etatStock(db, maintenant).lignes.find((l) => l.produitId === produitId)!

let numeroTicket = 0

/** Vente d'une unité du produit, datée : ticket, ligne et mouvement de stock. */
function vendre(
  db: Db,
  produitId: number,
  horodatage: string,
  options: { statut?: 'terminee' | 'annulee'; type?: 'ticket' | 'proforma' } = {}
): void {
  const caissiere = une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'caissier'")!.id
  const sessionId = executer(db, 'INSERT INTO sessions_caisse (utilisateur_id) VALUES (?)', caissiere).id
  const venteId = executer(
    db,
    `INSERT INTO ventes (numero_ticket, session_caisse_id, utilisateur_id, type, statut, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    `T-TEST-${++numeroTicket}`,
    sessionId,
    caissiere,
    options.type ?? 'ticket',
    options.statut ?? 'terminee',
    horodatage
  ).id
  const conditionnementId = une<{ id: number }>(
    db,
    'SELECT id FROM conditionnements WHERE produit_id = ? AND est_defaut = 1',
    produitId
  )!.id
  executer(
    db,
    `INSERT INTO lignes_vente (vente_id, produit_id, conditionnement_id, designation, quantite, prix_unitaire,
       quantite_base_totale, total_ligne)
     VALUES (?, ?, ?, 'Article', 1, 100, 1, 100)`,
    venteId,
    produitId,
    conditionnementId
  )
  enregistrerMouvement(db, {
    produitId,
    type: 'vente',
    quantite: -1,
    coutUnitaire: 0,
    documentType: 'vente',
    documentId: venteId,
    utilisateurId: caissiere
  })
}

describe('Stock — répartition indicative par conditionnement', () => {
  it('46 boîtes = 1 carton + 7 lots + 1 unité', () => {
    expect(repartirStock(46, [UNITE, LOT, CARTON])).toEqual([
      { nom: 'Carton de 24', nombre: 1 },
      { nom: 'Lot de 3', nombre: 7 },
      { nom: 'Unité', nombre: 1 }
    ])
  })

  it('41 boîtes = 1 carton + 5 lots + 2 unités (inventaire du scénario)', () => {
    expect(repartirStock(41, [UNITE, LOT, CARTON])).toEqual([
      { nom: 'Carton de 24', nombre: 1 },
      { nom: 'Lot de 3', nombre: 5 },
      { nom: 'Unité', nombre: 2 }
    ])
  })

  it('saute un conditionnement qui ne rentre pas : 48 = 2 cartons, sans unité ni lot', () => {
    expect(repartirStock(48, [UNITE, LOT, CARTON])).toEqual([{ nom: 'Carton de 24', nombre: 2 }])
  })

  it('rien pour un stock nul ou négatif (D-A1)', () => {
    expect(repartirStock(0, [UNITE, LOT, CARTON])).toBeNull()
    expect(repartirStock(-3, [UNITE, LOT, CARTON])).toBeNull()
  })

  it('rien quand elle ne dirait rien de plus : Unité seule, ou moins d’un lot', () => {
    expect(repartirStock(20, [UNITE])).toBeNull()
    expect(repartirStock(2, [UNITE, LOT, CARTON])).toBeNull()
  })

  it('au poids, le reste à virgule reste en unités : 12,5 kg avec un sac de 5 kg', () => {
    expect(
      repartirStock(
        12.5,
        [
          { nom: 'Kg', quantiteBase: 1 },
          { nom: 'Sac de 5 kg', quantiteBase: 5 }
        ],
        'kg'
      )
    ).toEqual([
      { nom: 'Sac de 5 kg', nombre: 2 },
      { nom: 'kg', nombre: 2.5 }
    ])
  })
})

describe('Stock — liste, valeur et alertes', () => {
  it('donne le stock, la valeur au CUMP et la répartition de la tomate (72 = 3 cartons)', () => {
    const tomate = ligne(baseAvecDemo(), TOMATE)
    expect(tomate).toMatchObject({
      nom: 'Tomate concentrée 70 g',
      rayon: 'Alimentation',
      stock: 72,
      seuil: 24,
      cump: 250,
      valeur: 18000,
      niveau: 'normal',
      repartition: [{ nom: 'Carton de 24', nombre: 3 }],
      derniereVente: null,
      dormant: false
    })
  })

  it('valeur totale = somme des valeurs de tous les produits actifs', () => {
    const etat = etatStock(baseAvecDemo())
    // Riz 20×3200 + Lait 12×2100 + Tomate 72×250 + Jus 18×420 + Baguette 40×180 + Gari 25×350 + Savon 30×150
    expect(etat.valeurTotale).toBe(64000 + 25200 + 18000 + 7560 + 7200 + 8750 + 4500)
    expect(etat.lignes).toHaveLength(7)
  })

  it('rupture à 0, stock bas au seuil, normal au-dessus', () => {
    const db = baseAvecDemo()
    const admin = une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id
    const sortir = (produitId: number, quantite: number): void => {
      enregistrerMouvement(db, {
        produitId,
        type: 'casse',
        quantite: -quantite,
        coutUnitaire: 0,
        utilisateurId: admin
      })
    }
    sortir(SAVON, 18) // 30 → 12 = seuil
    sortir(RIZ, 20) // 20 → 0
    sortir(TOMATE, 47) // 72 → 25 = seuil + 1

    expect(ligne(db, SAVON).niveau).toBe('stock_bas')
    expect(ligne(db, RIZ).niveau).toBe('rupture')
    expect(ligne(db, TOMATE).niveau).toBe('normal')
    const etat = etatStock(db)
    expect([etat.nbRuptures, etat.nbStockBas]).toEqual([1, 1])
  })

  it('un stock négatif reste affiché tel quel, en rupture, sans répartition (D-A1)', () => {
    const db = baseAvecDemo()
    vendre(db, BAGUETTE, dans(db, 0))
    const admin = une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id
    enregistrerMouvement(db, {
      produitId: BAGUETTE,
      type: 'casse',
      quantite: -42,
      coutUnitaire: 0,
      utilisateurId: admin
    })
    expect(ligne(db, BAGUETTE)).toMatchObject({
      stock: -3,
      niveau: 'rupture',
      repartition: null,
      valeur: -540
    })
  })

  it('ignore les produits désactivés', () => {
    const db = baseAvecDemo()
    executer(db, 'UPDATE produits SET actif = 0 WHERE id = ?', RIZ)
    expect(etatStock(db).lignes.map((l) => l.produitId)).not.toContain(RIZ)
  })
})

describe('Stock — produits dormants (aucune vente depuis dormant_jours, 60 par défaut)', () => {
  it('dernière vente il y a 61 jours → dormant ; il y a 59 jours → non', () => {
    const db = baseAvecDemo()
    const ilYA61Jours = dans(db, -61)
    vendre(db, RIZ, ilYA61Jours)
    vendre(db, SAVON, dans(db, -59))
    const etat = etatStock(db)
    expect(etat.dormantJours).toBe(60)
    expect(etat.lignes.find((l) => l.produitId === RIZ)!.dormant).toBe(true)
    expect(etat.lignes.find((l) => l.produitId === SAVON)!.dormant).toBe(false)
    expect(etat.lignes.find((l) => l.produitId === RIZ)!.derniereVente).toBe(ilYA61Jours)
  })

  it('jamais vendu : compte depuis la première entrée en stock', () => {
    const db = baseAvecDemo()
    expect(ligne(db, RIZ, dans(db, 59)).dormant).toBe(false)
    expect(ligne(db, RIZ, dans(db, 70)).dormant).toBe(true)
  })

  it('sans stock, un produit n’est jamais dormant', () => {
    const db = baseAvecDemo()
    const admin = une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id
    enregistrerMouvement(db, {
      produitId: RIZ,
      type: 'casse',
      quantite: -20,
      coutUnitaire: 0,
      utilisateurId: admin
    })
    expect(ligne(db, RIZ, dans(db, 70)).dormant).toBe(false)
  })

  it('une vente annulée ou une proforma ne réveille pas un produit', () => {
    const db = baseAvecDemo()
    const ilYA61Jours = dans(db, -61)
    vendre(db, RIZ, ilYA61Jours)
    vendre(db, RIZ, dans(db, -2), { statut: 'annulee' })
    vendre(db, RIZ, dans(db, -1), { type: 'proforma' })
    expect(ligne(db, RIZ)).toMatchObject({ dormant: true, derniereVente: ilYA61Jours })
  })

  it('suit le paramètre dormant_jours', () => {
    const db = baseAvecDemo()
    executer(db, "INSERT INTO parametres (cle, valeur) VALUES ('dormant_jours', '30')")
    vendre(db, RIZ, dans(db, -31))
    const etat = etatStock(db)
    expect(etat.dormantJours).toBe(30)
    expect(etat.nbDormants).toBe(1)
  })
})
