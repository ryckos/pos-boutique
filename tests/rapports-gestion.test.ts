import { describe, expect, it } from 'vitest'
import { rapportPertes } from '../src/main/modules/rapports-gestion/pertes'
import { rapportValeurStock } from '../src/main/modules/rapports-gestion/valeur'
import { rapportAchats } from '../src/main/modules/rapports-gestion/achats'
import { rapportResultat } from '../src/main/modules/rapports-gestion/resultat'
import { lirePeriode } from '../src/main/modules/rapports-gestion/periode'
import { annulerSortie, enregistrerSortie } from '../src/main/modules/stock/sorties'
import { noterAvoirRecu, refuserAvoir } from '../src/main/modules/fournisseurs/avoirs'
import { enregistrerReglement } from '../src/main/modules/fournisseurs/reglements'
import { creerFournisseur } from '../src/main/modules/fournisseurs/service'
import { validerReception } from '../src/main/modules/achats/receptions'
import { compterProduit, ouvrirInventaire, validerInventaire } from '../src/main/modules/inventaires/service'
import { enregistrerDepense, annulerDepense } from '../src/main/modules/depenses/service'
import { etatStock } from '../src/main/modules/stock/etat'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import { executer, toutes, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { manqueAvoir } from '../src/shared/rapports-gestion'
import type { CausePerte } from '../src/shared/ipc/rapports-gestion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1 ; riz = 1 (20, sans lot),
// tomate = 3 (72, CUMP 250), savon = 7 (30, CUMP 150, rayon Entretien).
const KOSSI = 3
const GROSSISTE = 1
const RIZ = 1
const TOMATE = 3
const SAVON = 7
const CARTON_TOMATE = '16181000000049'

function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}
function decaler(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10)
}
function valeur(r: ReturnType<typeof rapportPertes>, cause: CausePerte): number {
  return r.causes.find((c) => c.cause === cause)!.valeur
}
function sortie(
  db: Db,
  produitId: number,
  quantite: number,
  motif: 'casse' | 'perime' | 'vol' | 'don',
  commentaire?: string
) {
  return enregistrerSortie(db, KOSSI, { produitId, quantite, motif, commentaire })
}
function recevoirTomate(db: Db, cartons: number, prix: number): number {
  const carton = une<{ id: number }>(
    db,
    'SELECT id FROM conditionnements WHERE code_barres = ?',
    CARTON_TOMATE
  )!.id
  return validerReception(db, KOSSI, {
    fournisseurId: GROSSISTE,
    lignes: [{ conditionnementId: carton, quantite: cartons, prix }]
  }).id
}
/** Mercredi : 3 cartons à 6 000, puis 2 boîtes bombées renvoyées au grossiste (avoir attendu 500 F). */
function retourMercredi(db: Db) {
  recevoirTomate(db, 3, 6000)
  return enregistrerSortie(db, KOSSI, {
    produitId: TOMATE,
    quantite: 2,
    motif: 'casse',
    retour: { fournisseurId: GROSSISTE }
  })
}
function uniteDe(db: Db, produitId: number): number {
  return une<{ id: number }>(
    db,
    "SELECT id FROM conditionnements WHERE produit_id = ? AND nom = 'Unité'",
    produitId
  )!.id
}

describe('Rapports : période', () => {
  it('mois en cours par défaut, jusqu’à aujourd’hui', () => {
    const db = baseAvecDemo()
    const jour = aujourdhui(db)
    expect(lirePeriode(db, {})).toEqual({ du: `${jour.slice(0, 8)}01`, au: jour })
  })
  it('refuse une fin dans le futur, un début après la fin, une date mal formée', () => {
    const db = baseAvecDemo()
    const jour = aujourdhui(db)
    expect(() => lirePeriode(db, { au: decaler(jour, 1) })).toThrow(/futur/)
    expect(() => lirePeriode(db, { du: jour, au: decaler(jour, -1) })).toThrow(/précéder/)
    expect(() => lirePeriode(db, { du: '2026-02-30' })).toThrow(/invalide/)
  })
})

describe('Rapports : pertes par cause', () => {
  it('base de démo : aucune perte, toutes les causes listées à 0 (le stock de démo n’en est pas une)', () => {
    const r = rapportPertes(baseAvecDemo())
    expect(r.total).toBe(0)
    expect(r.causes.map((c) => c.cause)).toEqual([
      'peremption',
      'casse',
      'don',
      'vol',
      'demarque_inventaire',
      'avoir_fournisseur'
    ])
    expect(r.produits).toEqual([])
  })

  it('casse 2 × 250 = 500, péremption 250, vol 150, don 2 × 150 = 300 sur sa propre ligne', () => {
    const db = baseAvecDemo()
    sortie(db, TOMATE, 2, 'casse')
    sortie(db, TOMATE, 1, 'perime')
    sortie(db, SAVON, 1, 'vol')
    sortie(db, SAVON, 2, 'don', 'voisine malade')
    const r = rapportPertes(db)
    expect(valeur(r, 'casse')).toBe(500)
    expect(valeur(r, 'peremption')).toBe(250)
    expect(valeur(r, 'vol')).toBe(150)
    expect(valeur(r, 'don')).toBe(300)
    expect(r.total).toBe(1200)
    expect(r.produits.find((p) => p.cause === 'don')).toMatchObject({
      produit: expect.any(String),
      quantite: 2,
      valeur: 300
    })
  })

  it('une sortie annulée ne compte pas', () => {
    const db = baseAvecDemo()
    sortie(db, TOMATE, 2, 'casse')
    const id = toutes<{ id: number }>(db, "SELECT id FROM mouvements_stock WHERE type = 'casse'")[0].id
    annulerSortie(db, KOSSI, id, 'erreur de produit')
    const r = rapportPertes(db)
    expect(r.total).toBe(0)
    expect(r.produits).toEqual([])
  })

  it('inventaire du samedi : savon 29 → 27 = démarque 300 F ; un surplus est rendu à part', () => {
    const db = baseAvecDemo()
    enregistrerMouvement(db, {
      produitId: SAVON,
      type: 'vente',
      quantite: -1,
      coutUnitaire: 0,
      utilisateurId: KOSSI
    })
    const inv = ouvrirInventaire(db, KOSSI, { type: 'total' })
    compterProduit(db, {
      inventaireId: inv.id,
      produitId: SAVON,
      comptage: [{ conditionnementId: uniteDe(db, SAVON), nombre: 27 }],
      motif: 'vol'
    })
    compterProduit(db, {
      inventaireId: inv.id,
      produitId: RIZ,
      comptage: [{ conditionnementId: uniteDe(db, RIZ), nombre: 22 }],
      motif: 'autre'
    })
    validerInventaire(db, KOSSI, inv.id)
    const cumpRiz = une<{ c: number }>(
      db,
      'SELECT cout_moyen_pondere AS c FROM produits WHERE id = ?',
      RIZ
    )!.c
    const r = rapportPertes(db)
    expect(valeur(r, 'demarque_inventaire')).toBe(300)
    expect(r.total).toBe(300)
    expect(r.surplusInventaire).toBe(Math.round(2 * cumpRiz))
  })

  it('le stock initial n’est pas une perte, même compté en dessous d’un stock antérieur', () => {
    const db = baseAvecDemo()
    enregistrerMouvement(db, {
      produitId: SAVON,
      type: 'ajustement_inventaire',
      quantite: -3,
      coutUnitaire: 150,
      documentType: 'stock_initial',
      utilisateurId: KOSSI
    })
    expect(rapportPertes(db).total).toBe(0)
  })

  it('retour fournisseur : avoir attendu = pas encore une perte ; refusé = 500 F', () => {
    const db = baseAvecDemo()
    const r = retourMercredi(db)
    expect(rapportPertes(db).total).toBe(0)
    refuserAvoir(db, KOSSI, r.retourId!, 'boîtes jetées sans photo')
    const p = rapportPertes(db)
    expect(valeur(p, 'avoir_fournisseur')).toBe(500)
    expect(p.produits[0]).toMatchObject({ cause: 'avoir_fournisseur', quantite: null, valeur: 500 })
  })

  it('avoir reçu 400 F sur 500 attendus : 100 F de perte ; reçu en entier : aucune', () => {
    const db = baseAvecDemo()
    const r = retourMercredi(db)
    noterAvoirRecu(db, KOSSI, { id: r.retourId!, montant: 400 })
    expect(valeur(rapportPertes(db), 'avoir_fournisseur')).toBe(100)

    const db2 = baseAvecDemo()
    const r2 = retourMercredi(db2)
    noterAvoirRecu(db2, KOSSI, { id: r2.retourId!, montant: 500 })
    expect(rapportPertes(db2).total).toBe(0)
  })

  it('une perte d’aujourd’hui n’apparaît pas sur la période d’hier', () => {
    const db = baseAvecDemo()
    sortie(db, TOMATE, 2, 'casse')
    const hier = decaler(aujourdhui(db), -1)
    expect(rapportPertes(db, { du: hier, au: hier }).total).toBe(0)
  })

  it('manque d’un avoir (règle pure)', () => {
    expect(manqueAvoir('refuse', 500, null)).toBe(500)
    expect(manqueAvoir('recu', 500, 400)).toBe(100)
    expect(manqueAvoir('recu', 500, 600)).toBe(0)
  })
})

describe('Rapports : valeur du stock', () => {
  it('même total que l’écran Stock, par rayon, de la plus grosse valeur à la plus petite', () => {
    const db = baseAvecDemo()
    const r = rapportValeurStock(db)
    expect(r.total).toBe(etatStock(db).valeurTotale)
    expect(r.rayons.reduce((s, x) => s + x.nbProduits, 0)).toBe(etatStock(db).lignes.length)
    const valeurs = r.rayons.map((x) => x.valeur)
    expect(valeurs).toEqual([...valeurs].sort((a, b) => b - a))
    expect(r.rayons.find((x) => x.rayon === 'Entretien')!.valeur).toBeGreaterThanOrEqual(30 * 150)
  })

  it('un sous-rayon compte dans son rayon', () => {
    const db = baseAvecDemo()
    const entretien = une<{ id: number }>(db, "SELECT id FROM categories WHERE nom = 'Entretien'")!.id
    const sous = executer(
      db,
      'INSERT INTO categories (nom, parent_id) VALUES (?, ?)',
      'Lessive',
      entretien
    ).id
    const avant = rapportValeurStock(db).rayons.find((x) => x.rayon === 'Entretien')!.valeur
    const totalAvant = rapportValeurStock(db).total
    executer(db, 'UPDATE produits SET categorie_id = ? WHERE id = ?', sous, SAVON)
    const apres = rapportValeurStock(db)
    expect(apres.rayons.find((x) => x.rayon === 'Entretien')!.valeur).toBe(avant)
    expect(apres.rayons.some((x) => x.rayon === 'Lessive')).toBe(false)
    expect(apres.total).toBe(totalAvant)
  })
})

describe('Rapports : achats par fournisseur', () => {
  it('18 000 + 13 200 = 31 200 livrés, 10 000 réglés, reste dû 21 200', () => {
    const db = baseAvecDemo()
    recevoirTomate(db, 3, 6000)
    recevoirTomate(db, 2, 6600)
    enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 10000, mode: 'especes' })
    creerFournisseur(db, { nom: 'Brasserie du Bénin', delaiPaiementJours: 0 })
    const r = rapportAchats(db)
    expect(r.fournisseurs).toHaveLength(1)
    expect(r.fournisseurs[0]).toMatchObject({
      fournisseurId: GROSSISTE,
      nbReceptions: 2,
      livre: 31200,
      regle: 10000,
      avoirsRecus: 0,
      resteDu: 21200,
      actif: true
    })
    expect(r.totalLivre).toBe(31200)
    expect(r.totalResteDu).toBe(21200)
  })

  it('l’avoir reçu compte dans la période et réduit le reste dû', () => {
    const db = baseAvecDemo()
    const r = retourMercredi(db)
    noterAvoirRecu(db, KOSSI, { id: r.retourId!, montant: 500 })
    expect(rapportAchats(db).fournisseurs[0]).toMatchObject({
      livre: 18000,
      avoirsRecus: 500,
      resteDu: 17500
    })
  })

  it('une dette ancienne reste visible même sans opération dans la période', () => {
    const db = baseAvecDemo()
    recevoirTomate(db, 3, 6000)
    const hier = decaler(aujourdhui(db), -1)
    const f = rapportAchats(db, { du: hier, au: hier }).fournisseurs
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ nbReceptions: 0, livre: 0, resteDu: 18000 })
  })
})

describe('Rapports : résultat de la période', () => {
  it('dépenses 1 000 + 15 000 = 16 000 (une annulée ne compte pas) ; marge en attente des ventes', () => {
    const db = baseAvecDemo()
    const categorie = (nom: string) =>
      une<{ id: number }>(db, 'SELECT id FROM categories_depense WHERE nom = ?', nom)!.id
    const depense = (nom: string, montant: number) =>
      enregistrerDepense(db, KOSSI, {
        categorieId: categorie(nom),
        libelle: nom,
        montant,
        source: 'fonds_propres'
      })
    depense('Transport', 1000)
    depense('Loyer', 15000)
    annulerDepense(db, KOSSI, depense('Eau', 2000).id, 'doublon')
    sortie(db, TOMATE, 2, 'casse')
    expect(rapportResultat(db)).toMatchObject({ depenses: 16000, pertes: 500, marge: null, resultat: null })
  })
})
