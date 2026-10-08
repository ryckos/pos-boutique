import { describe, expect, it } from 'vitest'
import {
  annulerInventaire,
  compterProduit,
  detailInventaire,
  inventaireEnCours,
  listerInventaires,
  ouvrirInventaire,
  validerInventaire
} from '../src/main/modules/inventaires/service'
import { historiqueProduit } from '../src/main/modules/stock/historique'
import { enregistrerMouvement, stockProduit } from '../src/main/core/mouvements'
import { repartirManquant } from '../src/shared/inventaires'
import { executer, toutes, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; rayons Alimentation = 1, Entretien = 3 ; riz = 1 (20, sans lot),
// lait = 2 (12 dans le lot DEMO-01), tomate = 3 (72, CUMP 250, Carton de 24 / Lot de 3 / Unité),
// savon = 7 (30, CUMP 150, rayon Entretien).
const KOSSI = 3
const ALIMENTATION = 1
const ENTRETIEN = 3
const RIZ = 1
const TOMATE = 3
const SAVON = 7

function vendre(db: Db, produitId: number, quantite: number, lotId: number | null = null): void {
  enregistrerMouvement(db, {
    produitId,
    lotId,
    type: 'vente',
    quantite: -quantite,
    coutUnitaire: 0,
    utilisateurId: KOSSI
  })
}

/** Ids des conditionnements d'un produit, par nom. */
function cond(db: Db, produitId: number): Record<string, number> {
  const lignes = toutes<{ id: number; nom: string }>(
    db,
    'SELECT id, nom FROM conditionnements WHERE produit_id = ?',
    produitId
  )
  return Object.fromEntries(lignes.map((l) => [l.nom, l.id]))
}

function compterUnites(db: Db, inventaireId: number, produitId: number, n: number, motif?: 'vol' | 'casse') {
  return compterProduit(db, {
    inventaireId,
    produitId,
    comptage: [{ conditionnementId: cond(db, produitId)['Unité'], nombre: n }],
    motif
  })
}

/** Samedi : 41 boîtes de tomate et 29 savons en stock (SCENARIO_REFERENCE). */
function samedi(db: Db): void {
  vendre(db, TOMATE, 31)
  vendre(db, SAVON, 1)
}

describe('Inventaires : scénario du samedi (SCENARIO_REFERENCE)', () => {
  it('1 carton + 5 lots + 2 unités = 41 : écart nul, détail conservé', () => {
    const db = baseAvecDemo()
    samedi(db)
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    const c = cond(db, TOMATE)
    const l = compterProduit(db, {
      inventaireId: inv.id,
      produitId: TOMATE,
      comptage: [
        { conditionnementId: c['Carton de 24'], nombre: 1 },
        { conditionnementId: c['Lot de 3'], nombre: 5 },
        { conditionnementId: c['Unité'], nombre: 2 }
      ]
    })
    expect(l.quantiteTheorique).toBe(41)
    expect(l.quantiteComptee).toBe(41)
    expect(l.ecart).toBe(0)
    expect(l.motif).toBeNull()
    expect(l.detail.map((d) => `${d.nombre} ${d.conditionnement}`)).toEqual([
      '1 Carton de 24',
      '5 Lot de 3',
      '2 Unité'
    ])
  })

  it('savon 29 → 27, motif vol : mouvement −2 et démarque de 300 F', () => {
    const db = baseAvecDemo()
    samedi(db)
    const inv = ouvrirInventaire(db, KOSSI, { type: 'partiel', categorieId: ENTRETIEN })
    const l = compterProduit(db, {
      inventaireId: inv.id,
      produitId: SAVON,
      comptage: [{ conditionnementId: cond(db, SAVON)['Unité'], nombre: 27 }],
      motif: 'vol',
      commentaire: '  vol   présumé '
    })
    expect(l.ecart).toBe(-2)
    expect(l.valeurEcart).toBe(-300)
    expect(l.commentaire).toBe('vol présumé')

    const rapport = validerInventaire(db, KOSSI, inv.id)
    expect(rapport.manquants).toBe(300)
    expect(rapport.surplus).toBe(0)
    expect(rapport.net).toBe(-300)
    expect(rapport.lignes).toEqual([
      expect.objectContaining({ produitId: SAVON, ecart: -2, cump: 150, valeur: -300, motif: 'vol' })
    ])
    expect(stockProduit(db, SAVON)).toBe(27)

    const mvts = toutes<{ quantite: number; documentType: string; motif: string }>(
      db,
      `SELECT quantite, document_type AS documentType, motif FROM mouvements_stock
       WHERE produit_id = ? AND type = 'ajustement_inventaire'`,
      SAVON
    )
    expect(mvts).toEqual([
      { quantite: -2, documentType: 'inventaire', motif: `Inventaire ${inv.numero} : Vol (vol présumé)` }
    ])
    // L'historique du produit montre le document.
    const h = historiqueProduit(db, SAVON, {})
    expect(h.mouvements.at(-1)!.document).toBe(`Inventaire ${inv.numero}`)
  })

  it('numéro INV donné à l’ouverture', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(inv.numero).toMatch(/^INV-\d{4}-000001$/)
    expect(inv.statut).toBe('en_cours')
    expect(inv.ouvertPar).toBe('Kossi')
  })
})

describe('Inventaires : comptage', () => {
  it('un écart sans motif est refusé', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(() => compterUnites(db, inv.id, SAVON, 27)).toThrow('choisissez-en le motif')
    expect(detailInventaire(db, inv.id).nbComptes).toBe(0)
  })

  it('une vente après le comptage reste dans le stock : 27 comptés, 1 vendue → 26', () => {
    const db = baseAvecDemo()
    samedi(db)
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, SAVON, 27, 'vol')
    vendre(db, SAVON, 1)
    validerInventaire(db, KOSSI, inv.id)
    expect(stockProduit(db, SAVON)).toBe(26)
  })

  it('un recomptage remplace le comptage et reprend le théorique', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, SAVON, 27, 'vol')
    vendre(db, SAVON, 1)
    const l = compterUnites(db, inv.id, SAVON, 29)
    expect(l.quantiteTheorique).toBe(29)
    expect(l.ecart).toBe(0)
    expect(l.motif).toBeNull()
    expect(detailInventaire(db, inv.id).nbComptes).toBe(1)
  })

  it('un comptage à 0 est un comptage (tout le stock manque)', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    const l = compterUnites(db, inv.id, SAVON, 0, 'casse')
    expect(l.ecart).toBe(-30)
  })

  it('refuse un nombre à virgule pour un produit à l’unité, et un conditionnement d’un autre produit', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(() => compterUnites(db, inv.id, SAVON, 2.5, 'vol')).toThrow('nombre entier')
    expect(() =>
      compterProduit(db, {
        inventaireId: inv.id,
        produitId: SAVON,
        comptage: [{ conditionnementId: cond(db, TOMATE)['Unité'], nombre: 1 }]
      })
    ).toThrow('Conditionnement introuvable')
  })

  it('inventaire d’un rayon : sous-rayons compris, produit d’un autre rayon refusé', () => {
    const db = baseAvecDemo()
    const sousRayon = executer(
      db,
      "INSERT INTO categories (nom, parent_id) VALUES ('Conserves', ?)",
      ALIMENTATION
    ).id
    executer(db, 'UPDATE produits SET categorie_id = ? WHERE id = ?', sousRayon, TOMATE)
    const inv = ouvrirInventaire(db, KOSSI, { type: 'partiel', categorieId: ALIMENTATION })
    expect(inv.rayon).toBe('Alimentation')
    const ids = inv.produits.map((p) => p.produitId)
    expect(ids).toContain(TOMATE)
    expect(ids).toContain(RIZ)
    expect(ids).not.toContain(SAVON)
    expect(() => compterUnites(db, inv.id, SAVON, 30)).toThrow('n’est pas du rayon Alimentation')
  })
})

describe('Inventaires : validation', () => {
  it('inventaire total : les produits non comptés ne bougent pas', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, SAVON, 28, 'casse')
    const avant = detailInventaire(db, inv.id)
    expect(avant.nbNonComptes).toBe(avant.produits.length - 1)
    validerInventaire(db, KOSSI, inv.id)
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(stockProduit(db, RIZ)).toBe(20)
    expect(stockProduit(db, SAVON)).toBe(28)
    const journal = une<{ v: string }>(
      db,
      "SELECT nouvelle_valeur AS v FROM journal_audit WHERE action = 'validation_inventaire'"
    )!
    expect(JSON.parse(journal.v)).toMatchObject({
      comptes: 1,
      nonComptes: avant.nbNonComptes,
      manquants: 300
    })
  })

  it('manquant de 5 sur les lots A (3, le plus ancien) puis B (10) ; le surplus entre sans lot', () => {
    const db = baseAvecDemo()
    // Riz : 20 sans lot + lot A (3, déjà périmé) + lot B (10). Stock 33.
    const lot = (numero: string, date: string, q: number) => {
      const id = executer(
        db,
        'INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire) VALUES (?, ?, ?, 3200)',
        RIZ,
        numero,
        date
      ).id
      enregistrerMouvement(db, {
        produitId: RIZ,
        lotId: id,
        type: 'reception',
        quantite: q,
        coutUnitaire: 3200,
        utilisateurId: KOSSI
      })
      return id
    }
    const b = lot('B', '2099-12-31', 10)
    const a = lot('A', '2020-01-01', 3)
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, RIZ, 28, 'vol')
    compterUnites(db, inv.id, SAVON, 31, 'casse')
    const rapport = validerInventaire(db, KOSSI, inv.id)

    const parLot = toutes<{ lotId: number | null; quantite: number }>(
      db,
      `SELECT lot_id AS lotId, quantite FROM mouvements_stock
       WHERE type = 'ajustement_inventaire' AND produit_id = ? ORDER BY id`,
      RIZ
    )
    expect(parLot).toEqual([
      { lotId: a, quantite: -3 },
      { lotId: b, quantite: -2 }
    ])
    const surplus = une<{ lotId: number | null; quantite: number }>(
      db,
      `SELECT lot_id AS lotId, quantite FROM mouvements_stock WHERE type = 'ajustement_inventaire' AND produit_id = ?`,
      SAVON
    )
    expect(surplus).toEqual({ lotId: null, quantite: 1 })
    expect(stockProduit(db, RIZ)).toBe(28)
    // 5 riz × 3 200 = 16 000 de manquants ; 1 savon × 150 de surplus.
    expect(rapport).toMatchObject({ manquants: 16000, surplus: 150, net: -15850 })
    expect(rapport.lignes[0].produitId).toBe(RIZ)
  })

  it('répartition pure : ce que les lots ne couvrent pas sort sans lot', () => {
    expect(
      repartirManquant(5, [
        { lotId: 1, restant: 3 },
        { lotId: 2, restant: 10 }
      ])
    ).toEqual([
      { lotId: 1, quantite: 3 },
      { lotId: 2, quantite: 2 }
    ])
    expect(repartirManquant(8, [{ lotId: 1, restant: 3 }])).toEqual([
      { lotId: 1, quantite: 3 },
      { lotId: null, quantite: 5 }
    ])
    expect(repartirManquant(1.5, [{ lotId: 1, restant: 0.2 }])).toEqual([
      { lotId: 1, quantite: 0.2 },
      { lotId: null, quantite: 1.3 }
    ])
  })

  it('valider sans aucun comptage est refusé', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(() => validerInventaire(db, KOSSI, inv.id)).toThrow('Aucun produit n’est compté')
  })

  it('un inventaire validé est figé : ni comptage, ni validation, ni annulation, ni modification en base', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, SAVON, 28, 'casse')
    validerInventaire(db, KOSSI, inv.id)
    expect(() => compterUnites(db, inv.id, RIZ, 20)).toThrow('est validé')
    expect(() => validerInventaire(db, KOSSI, inv.id)).toThrow('est validé')
    expect(() => annulerInventaire(db, KOSSI, inv.id, 'erreur')).toThrow('est validé')
    expect(() => executer(db, 'UPDATE lignes_inventaire SET quantite_comptee = 30')).toThrow('figé')
    expect(() => executer(db, 'DELETE FROM inventaires')).toThrow('ne se supprime pas')
    const d = detailInventaire(db, inv.id)
    expect(d.statut).toBe('valide')
    expect(d.validePar).toBe('Kossi')
    expect(d.produits.map((p) => p.produitId)).toEqual([SAVON])
    expect(d.rapport!.manquants).toBe(300)
    expect(listerInventaires(db)[0].demarque).toBe(300)
  })

  it('une panne en pleine validation annule tout', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, RIZ, 18, 'vol')
    compterUnites(db, inv.id, SAVON, 28, 'casse')
    // Panne simulée au 2ᵉ ajustement, après l'écriture du 1ᵉʳ.
    db.exec(`CREATE TRIGGER panne BEFORE INSERT ON mouvements_stock
             WHEN NEW.produit_id = ${SAVON} BEGIN SELECT RAISE(ABORT, 'panne'); END`)
    expect(() => validerInventaire(db, KOSSI, inv.id)).toThrow(/panne/)
    expect(stockProduit(db, RIZ)).toBe(20)
    expect(detailInventaire(db, inv.id).statut).toBe('en_cours')
  })
})

describe('Inventaires : ouverture et annulation', () => {
  it('un seul inventaire en cours à la fois', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(() => ouvrirInventaire(db, KOSSI, { type: 'partiel', categorieId: ENTRETIEN })).toThrow(
      `L’inventaire ${inv.numero} est en cours`
    )
    expect(() => ouvrirInventaire(db, KOSSI, { type: 'partiel', categorieId: 999 })).toThrow()
    expect(inventaireEnCours(db)!.id).toBe(inv.id)
  })

  it('un rayon est obligatoire pour un inventaire partiel', () => {
    const db = baseAvecDemo()
    expect(() => ouvrirInventaire(db, KOSSI, { type: 'partiel' })).toThrow('Choisissez le rayon')
  })

  it('annuler : motif obligatoire, journalisé, aucun mouvement ; on peut en rouvrir un autre', () => {
    const db = baseAvecDemo()
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterUnites(db, inv.id, SAVON, 28, 'casse')
    expect(() => annulerInventaire(db, KOSSI, inv.id, '  ')).toThrow('Indiquez pourquoi')
    annulerInventaire(db, KOSSI, inv.id, 'compté le mauvais rayon')
    expect(stockProduit(db, SAVON)).toBe(30)
    expect(inventaireEnCours(db)).toBeNull()
    const d = detailInventaire(db, inv.id)
    expect(d.statut).toBe('annule')
    expect(d.motifAnnulation).toBe('compté le mauvais rayon')
    expect(une(db, "SELECT 1 AS x FROM journal_audit WHERE action = 'annulation_inventaire'")).toBeDefined()
    expect(() => compterUnites(db, inv.id, RIZ, 20)).toThrow('est annulé')
    const autre = ouvrirInventaire(db, KOSSI, { type: 'total' })
    expect(autre.numero).toMatch(/000002$/)
  })
})
