import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { stockProduit } from '../src/main/core/mouvements'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { ventilerTva } from '../src/main/modules/caisse/calculs'
import { ouvrirSession, sessionOuverte } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import { baseAvecDemo } from './aide'

const AFI = 2
const KOSSI = 3
const TOMATE = 3

/** Identifiant de conditionnement à partir d'un code (comme le ferait un scan). */
function id(db: Db, code: string): number {
  return rechercherParCode(db, code)!.conditionnementId
}

/** Base de démo avec la caisse d'Afi ouverte (fond 10 000 F, scénario du lundi). */
function caisseOuverte(): Db {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI, 10000)
  return db
}

/** « 1 carton de tomate + 2 unités + 1 baguette » : 7 500 + 700 + 300 = 8 500 F. */
function venteDemo(db: Db): RequeteVente['lignes'] {
  return [
    { conditionnementId: id(db, '16181000000049'), quantite: 1 },
    { conditionnementId: id(db, '6181000000042'), quantite: 2 },
    { conditionnementId: id(db, '101'), quantite: 1 }
  ]
}

const compter = (db: Db, table: string): number =>
  une<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`)!.n

describe('Calcul de la TVA (règle 6.4)', () => {
  it('ventile 12 700 F à 18 % et 600 F à 0 % : HT 11 363, TVA 1 937', () => {
    const t = ventilerTva([
      { totalTtc: 12700, tauxTva: 18 },
      { totalTtc: 600, tauxTva: 0 }
    ])
    expect(t).toEqual({
      parTaux: [
        { taux: 18, ttc: 12700, ht: 10763, tva: 1937 },
        { taux: 0, ttc: 600, ht: 600, tva: 0 }
      ],
      totalTtc: 13300,
      totalHt: 11363,
      totalTva: 1937
    })
  })

  it('additionne les lignes d’un même taux avant d’arrondir', () => {
    const t = ventilerTva([
      { totalTtc: 350, tauxTva: 18 },
      { totalTtc: 350, tauxTva: 18 }
    ])
    // arrondi(700 / 1,18) = 593, et non 2 × arrondi(350 / 1,18) = 594
    expect(t.totalHt).toBe(593)
    expect(t.totalTva).toBe(107)
  })
})

describe('Sessions de caisse (minimum pour vendre)', () => {
  it('ouvre une session avec son fond et la journalise', () => {
    const db = caisseOuverte()
    expect(sessionOuverte(db, AFI)?.fondOuverture).toBe(10000)
    expect(une(db, "SELECT id FROM journal_audit WHERE action = 'ouverture_session_caisse'")).toBeDefined()
  })

  it('refuse une deuxième session ouverte pour le même caissier', () => {
    const db = caisseOuverte()
    expect(() => ouvrirSession(db, AFI, 5000)).toThrow(/déjà ouverte/)
    expect(compter(db, 'sessions_caisse')).toBe(1)
  })

  it('refuse un fond négatif ou à virgule', () => {
    const db = baseAvecDemo()
    expect(() => ouvrirSession(db, AFI, -1)).toThrow(/Fond de caisse invalide/)
    expect(() => ouvrirSession(db, AFI, 10.5)).toThrow(/Fond de caisse invalide/)
  })
})

describe('Enregistrement d’une vente (règle 6.3)', () => {
  it('vente de démo : 8 500 F TTC, HT 7 249, TVA 1 251, numéro T-AAAA-000001', () => {
    const db = caisseOuverte()
    const r = enregistrerVente(db, AFI, {
      lignes: venteDemo(db),
      paiements: [{ mode: 'especes', montant: 8500 }],
      montantRecu: 10000
    })
    expect(r.numeroTicket).toMatch(/^T-\d{4}-000001$/)
    expect(r.totalTtc).toBe(8500)
    expect(r.monnaieRendue).toBe(1500)
    expect(r.alertesStock).toEqual([])
    expect(une(db, 'SELECT total_ht AS ht, total_tva AS tva, total_ttc AS ttc FROM ventes')).toEqual({
      ht: 7249,
      tva: 1251,
      ttc: 8500
    })
  })

  it('la tomate passe de 72 à 46 boîtes : un mouvement de −24 et un de −2', () => {
    const db = caisseOuverte()
    enregistrerVente(db, AFI, { lignes: venteDemo(db), paiements: [{ mode: 'especes', montant: 8500 }] })
    expect(stockProduit(db, TOMATE)).toBe(46)
    const mvts = toutes<{ quantite: number; cout: number }>(
      db,
      "SELECT quantite, cout_unitaire AS cout FROM mouvements_stock WHERE type = 'vente' AND produit_id = ? ORDER BY id",
      TOMATE
    )
    expect(mvts).toEqual([
      { quantite: -24, cout: 250 },
      { quantite: -2, cout: 250 }
    ])
  })

  it('photocopie prix et coûts : marges carton 1 500, unités 200, baguette 120', () => {
    const db = caisseOuverte()
    enregistrerVente(db, AFI, { lignes: venteDemo(db), paiements: [{ mode: 'especes', montant: 8500 }] })
    const marges = toutes<{ designation: string; marge: number; base: number }>(
      db,
      `SELECT designation, total_ligne - quantite * cout_unitaire AS marge, quantite_base_totale AS base
       FROM lignes_vente ORDER BY id`
    )
    expect(marges.map((m) => [m.marge, m.base])).toEqual([
      [1500, 24],
      [200, 2],
      [120, 1]
    ])
    expect(marges[0].designation).toBe('Tomate concentrée 70 g — Carton de 24')
  })

  it('un changement de prix au catalogue ne modifie pas une vente passée', () => {
    const db = caisseOuverte()
    const carton = id(db, '16181000000049')
    enregistrerVente(db, AFI, {
      lignes: [{ conditionnementId: carton, quantite: 1 }],
      paiements: [{ mode: 'especes', montant: 7500 }]
    })
    executer(db, 'UPDATE conditionnements SET prix_vente = 8000 WHERE id = ?', carton)
    expect(une(db, 'SELECT prix_unitaire AS p, total_ligne AS t FROM lignes_vente')).toEqual({
      p: 7500,
      t: 7500
    })
  })

  it('les prix viennent de la base, jamais de l’écran', () => {
    const db = caisseOuverte()
    // Une requête « trafiquée » avec un prix n'a aucun effet : le champ est ignoré.
    const lignes = [{ conditionnementId: id(db, '16181000000049'), quantite: 1, prixVente: 1 }]
    expect(() => enregistrerVente(db, AFI, { lignes, paiements: [{ mode: 'especes', montant: 1 }] })).toThrow(
      /Paiement incomplet : il manque 7\s499 F/
    )
  })

  it('vente mixte du scénario : 10 100 F, 29 boîtes de tomate sorties', () => {
    const db = caisseOuverte()
    const r = enregistrerVente(db, AFI, {
      lignes: [
        { conditionnementId: id(db, '16181000000049'), quantite: 1 },
        { conditionnementId: id(db, '2000000000015'), quantite: 1 },
        { conditionnementId: id(db, '6181000000042'), quantite: 2 },
        { conditionnementId: id(db, '101'), quantite: 1 },
        { conditionnementId: id(db, '6034000012345'), quantite: 1 }
      ],
      paiements: [{ mode: 'especes', montant: 10100 }]
    })
    expect(r.totalTtc).toBe(10100)
    expect(stockProduit(db, TOMATE)).toBe(72 - 29)
  })

  it('accepte un paiement mixte espèces + TMoney avec référence', () => {
    const db = caisseOuverte()
    const r = enregistrerVente(db, AFI, {
      lignes: venteDemo(db),
      paiements: [
        { mode: 'especes', montant: 5000 },
        { mode: 'tmoney', montant: 3500, reference: ' TM-88213 ' }
      ],
      montantRecu: 5000
    })
    expect(r.monnaieRendue).toBe(0)
    expect(toutes(db, 'SELECT mode, montant, reference FROM paiements ORDER BY id')).toEqual([
      { mode: 'especes', montant: 5000, reference: null },
      { mode: 'tmoney', montant: 3500, reference: 'TM-88213' }
    ])
  })
})

describe('Refus et rollback', () => {
  /** Rien ne doit avoir été écrit : ni vente, ni ligne, ni mouvement de vente, ni paiement. */
  function rienEcrit(db: Db): void {
    expect(compter(db, 'ventes')).toBe(0)
    expect(compter(db, 'lignes_vente')).toBe(0)
    expect(compter(db, 'paiements')).toBe(0)
    expect(une<{ n: number }>(db, "SELECT COUNT(*) AS n FROM mouvements_stock WHERE type = 'vente'")!.n).toBe(
      0
    )
    expect(stockProduit(db, TOMATE)).toBe(72)
  }

  it('refuse un paiement insuffisant sans rien écrire ni consommer de numéro', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, AFI, { lignes: venteDemo(db), paiements: [{ mode: 'especes', montant: 7300 }] })
    ).toThrow(/Paiement incomplet : il manque 1\s200 F/)
    rienEcrit(db)
    const r = enregistrerVente(db, AFI, {
      lignes: venteDemo(db),
      paiements: [{ mode: 'especes', montant: 8500 }]
    })
    expect(r.numeroTicket).toMatch(/-000001$/)
  })

  it('refuse un paiement supérieur au total', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, AFI, {
        lignes: venteDemo(db),
        paiements: [{ mode: 'flooz', montant: 9000, reference: 'F1' }]
      })
    ).toThrow(/supérieur au total de 500 F/)
    rienEcrit(db)
  })

  it('refuse TMoney ou Flooz sans référence', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, AFI, {
        lignes: venteDemo(db),
        paiements: [{ mode: 'flooz', montant: 8500, reference: '  ' }]
      })
    ).toThrow(/référence de la transaction Flooz/)
    rienEcrit(db)
  })

  it('refuse des espèces reçues inférieures à la part en espèces', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, AFI, {
        lignes: venteDemo(db),
        paiements: [{ mode: 'especes', montant: 8500 }],
        montantRecu: 5000
      })
    ).toThrow(/Espèces reçues insuffisantes : il manque 3\s500 F/)
    rienEcrit(db)
  })

  it('refuse le crédit tant que la fiche client n’existe pas', () => {
    const db = caisseOuverte()
    for (const mode of ['credit', 'constructor']) {
      const paiements = [{ mode, montant: 8500 }] as unknown as RequeteVente['paiements']
      expect(() => enregistrerVente(db, AFI, { lignes: venteDemo(db), paiements })).toThrow(/non accepté/)
    }
    rienEcrit(db)
  })

  it('rollback complet si une ligne est invalide après une ligne valide', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, AFI, {
        lignes: [
          { conditionnementId: id(db, '16181000000049'), quantite: 1 },
          { conditionnementId: 99999, quantite: 1 }
        ],
        paiements: [{ mode: 'especes', montant: 7500 }]
      })
    ).toThrow(/n’est plus en vente/)
    rienEcrit(db)
  })

  it('refuse une quantité nulle ou à virgule', () => {
    const db = caisseOuverte()
    const carton = id(db, '16181000000049')
    for (const quantite of [0, 1.5]) {
      expect(() =>
        enregistrerVente(db, AFI, {
          lignes: [{ conditionnementId: carton, quantite }],
          paiements: [{ mode: 'especes', montant: 7500 }]
        })
      ).toThrow(/Quantité invalide/)
    }
    rienEcrit(db)
  })

  it('refuse de vendre sans session ouverte', () => {
    const db = caisseOuverte()
    expect(() =>
      enregistrerVente(db, KOSSI, { lignes: venteDemo(db), paiements: [{ mode: 'especes', montant: 8500 }] })
    ).toThrow(/Ouvrez la caisse/)
    rienEcrit(db)
  })

  it('refuse un ticket vide', () => {
    const db = caisseOuverte()
    expect(() => enregistrerVente(db, AFI, { lignes: [], paiements: [] })).toThrow(/ticket est vide/)
  })
})

describe('Stock insuffisant (D-A1 en attente : jamais bloquant)', () => {
  it('enregistre la vente et signale le stock négatif', () => {
    const db = caisseOuverte()
    const carton = id(db, '16181000000049')
    const r = enregistrerVente(db, AFI, {
      lignes: [{ conditionnementId: carton, quantite: 4 }],
      paiements: [{ mode: 'especes', montant: 30000 }]
    })
    expect(stockProduit(db, TOMATE)).toBe(72 - 96)
    expect(r.alertesStock).toEqual([
      { produitId: TOMATE, designation: 'Tomate concentrée 70 g', stockApres: -24 }
    ])
  })
})
