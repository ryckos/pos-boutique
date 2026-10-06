import { describe, expect, it } from 'vitest'
import {
  annulerSortie,
  enregistrerSortie,
  ficheSortie,
  listerSorties
} from '../src/main/modules/stock/sorties'
import { noterAvoirRecu, refuserAvoir } from '../src/main/modules/fournisseurs/avoirs'
import { dettesFournisseur, enregistrerReglement } from '../src/main/modules/fournisseurs/reglements'
import {
  creerFournisseur,
  desactiverFournisseur,
  listerFournisseurs
} from '../src/main/modules/fournisseurs/service'
import { validerReception } from '../src/main/modules/achats/receptions'
import { retirerLot } from '../src/main/modules/stock/peremptions'
import { historiqueProduit } from '../src/main/modules/stock/historique'
import { stockProduit } from '../src/main/core/mouvements'
import { avoirAttendu, coutRetour } from '../src/shared/stock'
import { toutes, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1 ; tomate = produit 3
// (72 boîtes, CUMP 250, sans lot) ; lait = produit 2 (12 boîtes dans le lot DEMO-01, sans réception).
const KOSSI = 3
const GROSSISTE = 1
const TOMATE = 3
const LAIT = 2
const CARTON_TOMATE = '16181000000049'

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
function fournisseur(db: Db) {
  return listerFournisseurs(db).find((f) => f.id === GROSSISTE)!
}
/** Lundi 8 h puis mercredi : 3 cartons à 6 000, puis 2 boîtes bombées renvoyées au grossiste. */
function scenarioMercredi(db: Db) {
  recevoirTomate(db, 3, 6000)
  return enregistrerSortie(db, KOSSI, {
    produitId: TOMATE,
    quantite: 2,
    motif: 'casse',
    commentaire: 'boîtes bombées',
    retour: { fournisseurId: GROSSISTE }
  })
}

describe('Sorties : coût d’un retour (règle pure)', () => {
  const prix = [{ fournisseurId: 1, coutUnitaire: 275 }]
  it('prend le prix du lot s’il vient de ce fournisseur, sinon son dernier prix, sinon le CUMP', () => {
    expect(
      coutRetour(1, { lot: { fournisseurId: 1, prixAchat: 250 }, prixFournisseurs: prix, cump: 262.8 })
    ).toBe(250)
    expect(
      coutRetour(1, { lot: { fournisseurId: 2, prixAchat: 240 }, prixFournisseurs: prix, cump: 262.8 })
    ).toBe(275)
    expect(coutRetour(1, { lot: null, prixFournisseurs: prix, cump: 262.8 })).toBe(275)
    expect(coutRetour(9, { lot: null, prixFournisseurs: prix, cump: 262.8 })).toBe(262.8)
  })
  it('avoir attendu = quantité × coût, arrondi au franc', () => {
    expect(avoirAttendu(2, 250)).toBe(500)
    expect(avoirAttendu(3, 262.8)).toBe(788)
  })
})

describe('Sorties : retour fournisseur (SCENARIO_REFERENCE, mercredi)', () => {
  it('mouvement retour_fournisseur de −2 et avoir attendu de 500 F', () => {
    const db = baseAvecDemo()
    const r = scenarioMercredi(db)
    expect(r.montantAttendu).toBe(500)

    const m = une<{
      type: string
      quantite: number
      cout: number
      doc: string
      docId: number
      motif: string
    }>(
      db,
      `SELECT type, quantite, cout_unitaire AS cout, document_type AS doc, document_id AS docId, motif
       FROM mouvements_stock WHERE id = ?`,
      r.mouvementId
    )!
    expect(m).toEqual({
      type: 'retour_fournisseur',
      quantite: -2,
      cout: 250,
      doc: 'retour_fournisseur',
      docId: r.retourId,
      motif: 'Défectueux ou casse : boîtes bombées'
    })
    expect(stockProduit(db, TOMATE)).toBe(142)

    // L'avoir attendu ne touche pas encore la dette.
    expect(fournisseur(db).soldeDu).toBe(18000)
    expect(fournisseur(db).avoirsAttendus).toBe(500)
    const d = dettesFournisseur(db, GROSSISTE)
    expect(d.avoirsAttendus).toBe(500)
    expect(d.avoirs[0]).toMatchObject({
      produit: 'Tomate concentrée 70 g',
      quantite: 2,
      montantAttendu: 500,
      statut: 'attendu'
    })
  })

  it('avoir reçu : déduit de la dette comme un règlement global', () => {
    const db = baseAvecDemo()
    const { retourId } = scenarioMercredi(db)
    noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 500, reference: 'AV-12' })

    expect(fournisseur(db).soldeDu).toBe(17500)
    expect(fournisseur(db).avoirsAttendus).toBe(0)
    const vue = une<{ solde: number; avoirs: number }>(
      db,
      'SELECT solde_du AS solde, total_avoirs AS avoirs FROM v_dettes_fournisseurs WHERE id = ?',
      GROSSISTE
    )!
    expect(vue).toEqual({ solde: 17500, avoirs: 500 })
    const d = dettesFournisseur(db, GROSSISTE)
    expect(d.soldeDu).toBe(17500)
    expect(d.echeances[0]).toMatchObject({ total: 18000, regle: 500, reste: 17500 })
    expect(d.avoirs[0]).toMatchObject({ statut: 'recu', montantRecu: 500, reference: 'AV-12' })
    expect(() => noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 500 })).toThrow(/plus attendu/)
  })

  it('le montant reçu peut différer de l’attendu ; jamais à virgule, jamais daté dans le futur', () => {
    const db = baseAvecDemo()
    const { retourId } = scenarioMercredi(db)
    expect(() => noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 450.5 })).toThrow(/sans virgule/)
    expect(() => noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 450, date: '2999-01-01' })).toThrow(
      /futur/
    )
    noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 450 })
    expect(fournisseur(db).soldeDu).toBe(17550)
  })

  it('avoir plus grand que la dette : l’excédent reste à valoir sur la livraison suivante', () => {
    const db = baseAvecDemo()
    const { retourId } = scenarioMercredi(db)
    enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 18000, mode: 'especes' })
    noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 500 })
    expect(fournisseur(db).soldeDu).toBe(-500)
    expect(dettesFournisseur(db, GROSSISTE).soldeDu).toBe(-500)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Plus de livraison')).toThrow(/avoir de 500/)
    expect(() =>
      enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 100, mode: 'especes' })
    ).toThrow(/ne devez rien/)

    recevoirTomate(db, 2, 6600)
    expect(fournisseur(db).soldeDu).toBe(12700)
    const d = dettesFournisseur(db, GROSSISTE)
    expect(d.echeances[0]).toMatchObject({ total: 13200, regle: 500, reste: 12700 })
  })

  it('avoir refusé : motif obligatoire, journalisé, rien déduit', () => {
    const db = baseAvecDemo()
    const { retourId } = scenarioMercredi(db)
    expect(() => refuserAvoir(db, KOSSI, retourId!, '  ')).toThrow(/motif/)
    refuserAvoir(db, KOSSI, retourId!, 'Boîtes abîmées en rayon, pas à la livraison')
    expect(fournisseur(db).soldeDu).toBe(18000)
    expect(fournisseur(db).avoirsAttendus).toBe(0)
    const j = une<{ action: string; apres: string }>(
      db,
      "SELECT action, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'refus_avoir_fournisseur'"
    )!
    expect(JSON.parse(j.apres)).toEqual({ motif: 'Boîtes abîmées en rayon, pas à la livraison' })
    expect(() => refuserAvoir(db, KOSSI, retourId!, 'encore')).toThrow(/plus attendu/)
  })

  it('désactivation refusée tant qu’un avoir est attendu', () => {
    const db = baseAvecDemo()
    scenarioMercredi(db)
    enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 18000, mode: 'especes' })
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Plus de livraison')).toThrow(
      /attendez un avoir/
    )
  })

  it('retour refusé vers un fournisseur désactivé, ou pour un vol ou un don', () => {
    const db = baseAvecDemo()
    const autre = creerFournisseur(db, { nom: 'Ancien grossiste', delaiPaiementJours: 0 })
    desactiverFournisseur(db, KOSSI, autre, 'Fermé')
    expect(() =>
      enregistrerSortie(db, KOSSI, {
        produitId: TOMATE,
        quantite: 1,
        motif: 'casse',
        retour: { fournisseurId: autre }
      })
    ).toThrow(/désactivé/)
    expect(() =>
      enregistrerSortie(db, KOSSI, {
        produitId: TOMATE,
        quantite: 1,
        motif: 'vol',
        retour: { fournisseurId: GROSSISTE }
      })
    ).toThrow(/défectueux ou périmé/)
    expect(stockProduit(db, TOMATE)).toBe(72)
  })

  it('sans réception chez ce fournisseur, l’avoir se calcule au CUMP ; il peut être corrigé', () => {
    const db = baseAvecDemo()
    const a = enregistrerSortie(db, KOSSI, {
      produitId: TOMATE,
      quantite: 2,
      motif: 'casse',
      retour: { fournisseurId: GROSSISTE }
    })
    expect(a.montantAttendu).toBe(500)
    const b = enregistrerSortie(db, KOSSI, {
      produitId: TOMATE,
      quantite: 2,
      motif: 'casse',
      retour: { fournisseurId: GROSSISTE, montantAttendu: 480 }
    })
    expect(b.montantAttendu).toBe(480)
    expect(() =>
      enregistrerSortie(db, KOSSI, {
        produitId: TOMATE,
        quantite: 2,
        motif: 'casse',
        retour: { fournisseurId: GROSSISTE, montantAttendu: 0 }
      })
    ).toThrow(/avoir attendu/)
  })
})

describe('Sorties : sortie simple (REGLES_METIER § 8)', () => {
  it('le don passe en casse avec le motif « Don » ; le vol en vol ; chiffrés au CUMP', () => {
    const db = baseAvecDemo()
    const don = enregistrerSortie(db, KOSSI, {
      produitId: TOMATE,
      quantite: 3,
      motif: 'don',
      commentaire: 'Orphelinat'
    })
    const vol = enregistrerSortie(db, KOSSI, { produitId: 7, quantite: 2, motif: 'vol' })
    expect(don.retourId).toBeNull()
    const ms = toutes<{ type: string; motif: string; doc: string }>(
      db,
      'SELECT type, motif, document_type AS doc FROM mouvements_stock WHERE id IN (?, ?) ORDER BY id',
      don.mouvementId,
      vol.mouvementId
    )
    expect(ms).toEqual([
      { type: 'casse', motif: 'Don : Orphelinat', doc: 'sortie' },
      { type: 'vol', motif: 'Vol constaté', doc: 'sortie' }
    ])
    const liste = listerSorties(db)
    expect(liste.map((s) => s.valeur)).toEqual([300, 750])
    expect(liste[1]).toMatchObject({
      produit: 'Tomate concentrée 70 g',
      quantite: 3,
      retour: null,
      motifAnnulation: null
    })
  })

  it('refuse une quantité nulle, à virgule ou plus grande que le stock', () => {
    const db = baseAvecDemo()
    const sortir = (quantite: number) =>
      enregistrerSortie(db, KOSSI, { produitId: TOMATE, quantite, motif: 'casse' })
    expect(() => sortir(0)).toThrow(/quantité/)
    expect(() => sortir(1.5)).toThrow(/entier/)
    expect(() => sortir(73)).toThrow(/au plus/)
    expect(stockProduit(db, TOMATE)).toBe(72)
  })

  it('sortie d’un lot : au plus son restant ; la fiche propose le lot le plus proche', () => {
    const db = baseAvecDemo()
    const fiche = ficheSortie(db, LAIT)
    expect(fiche.suiviPeremption).toBe(true)
    expect(fiche.lots).toHaveLength(1)
    expect(fiche.lots[0]).toMatchObject({
      numeroLot: 'DEMO-01',
      restant: 12,
      prixAchat: 2100,
      fournisseurId: null
    })
    const lotId = fiche.lots[0].lotId
    expect(() =>
      enregistrerSortie(db, KOSSI, { produitId: LAIT, lotId, quantite: 13, motif: 'perime' })
    ).toThrow(/reste que 12/)
    enregistrerSortie(db, KOSSI, { produitId: LAIT, lotId, quantite: 2, motif: 'perime' })
    expect(ficheSortie(db, LAIT).lots[0].restant).toBe(10)
    expect(
      une<{ type: string }>(db, 'SELECT type FROM mouvements_stock ORDER BY id DESC LIMIT 1')!.type
    ).toBe('perte_peremption')
  })

  it('la fiche propose le fournisseur qui a livré, avec son dernier coût', () => {
    const db = baseAvecDemo()
    recevoirTomate(db, 3, 6000)
    recevoirTomate(db, 2, 6600)
    const fiche = ficheSortie(db, TOMATE)
    expect(fiche.fournisseurPropose).toBe(GROSSISTE)
    expect(fiche.prixFournisseurs).toEqual([
      expect.objectContaining({ fournisseurId: GROSSISTE, coutUnitaire: 275 })
    ])
  })
})

describe('Sorties : liste et annulation', () => {
  it('liste aussi les retraits du tableau des péremptions, jamais les ventes', () => {
    const db = baseAvecDemo()
    const lotId = ficheSortie(db, LAIT).lots[0].lotId
    retirerLot(db, KOSSI, { lotId, quantite: 1 })
    const liste = listerSorties(db)
    expect(liste).toHaveLength(1)
    expect(liste[0]).toMatchObject({
      type: 'perte_peremption',
      motif: 'Périmé',
      lot: 'DEMO-01',
      valeur: 2100
    })
  })

  it('annuler un retour : stock rendu, avoir annulé, journalisé ; une seule fois', () => {
    const db = baseAvecDemo()
    const { mouvementId } = scenarioMercredi(db)
    expect(() => annulerSortie(db, KOSSI, mouvementId, '')).toThrow(/motif/)
    annulerSortie(db, KOSSI, mouvementId, 'Erreur : boîtes saines')

    expect(stockProduit(db, TOMATE)).toBe(144)
    expect(dettesFournisseur(db, GROSSISTE).avoirs[0]).toMatchObject({
      statut: 'annule',
      motifCloture: 'Erreur : boîtes saines'
    })
    expect(fournisseur(db).avoirsAttendus).toBe(0)
    expect(listerSorties(db)[0]).toMatchObject({
      motifAnnulation: 'Erreur : boîtes saines',
      retour: { statut: 'annule' }
    })
    const j = une<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM journal_audit WHERE action = 'annulation_sortie_stock'"
    )!
    expect(j.n).toBe(1)
    expect(() => annulerSortie(db, KOSSI, mouvementId, 'encore')).toThrow(/clos|déjà annulée/)
  })

  it('une sortie dont l’avoir est reçu ne s’annule plus', () => {
    const db = baseAvecDemo()
    const { mouvementId, retourId } = scenarioMercredi(db)
    noterAvoirRecu(db, KOSSI, { id: retourId!, montant: 500 })
    expect(() => annulerSortie(db, KOSSI, mouvementId, 'Erreur')).toThrow(/déjà reçu/)
    expect(stockProduit(db, TOMATE)).toBe(142)
  })

  it('l’historique du produit montre le retour au fournisseur', () => {
    const db = baseAvecDemo()
    scenarioMercredi(db)
    const h = historiqueProduit(db, TOMATE)
    expect(h.mouvements.at(-1)).toMatchObject({
      type: 'retour_fournisseur',
      quantite: -2,
      document: 'Retour à Grossiste Hédzranawoé',
      stockApres: 142
    })
  })
})
