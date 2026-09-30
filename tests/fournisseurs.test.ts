import { describe, expect, it } from 'vitest'
import {
  creerFournisseur,
  desactiverFournisseur,
  listerFournisseurs,
  modifierFournisseur
} from '../src/main/modules/fournisseurs/service'
import { achatsFournisseur } from '../src/main/modules/fournisseurs/achats'
import { validerReception } from '../src/main/modules/achats/receptions'
import { executer, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Données de démo : Patron = 1 (admin), Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1.
const KOSSI = 3
const GROSSISTE = 1

/** Réception et règlement écrits directement : leurs services arrivent avec B8 et B10. */
function recevoir(db: Db, fournisseurId: number, total: number): void {
  const n = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM receptions')!.n
  executer(
    db,
    'INSERT INTO receptions (numero, fournisseur_id, total, utilisateur_id) VALUES (?, ?, ?, ?)',
    `RC-TEST-${n + 1}`, fournisseurId, total, KOSSI
  )
}
function regler(db: Db, fournisseurId: number, montant: number): void {
  executer(
    db,
    `INSERT INTO reglements_fournisseurs (fournisseur_id, montant, mode, utilisateur_id) VALUES (?, ?, 'especes', ?)`,
    fournisseurId, montant, KOSSI
  )
}

describe('Fournisseurs : fiches (REGLES_METIER § 4.6)', () => {
  it('la démo contient le grossiste du scénario, 15 jours de délai, sans dette', () => {
    expect(listerFournisseurs(baseAvecDemo())).toEqual([
      {
        id: GROSSISTE,
        nom: 'Grossiste Hédzranawoé',
        contact: 'M. Amouzou',
        telephone: '90 00 00 00',
        adresse: 'Marché de Hédzranawoé, Lomé',
        delaiPaiementJours: 15,
        actif: true,
        soldeDu: 0,
        derniereReception: null
      }
    ])
  })

  it('crée un fournisseur : espaces superflus retirés, champs vides = null, comptant', () => {
    const db = baseAvecDemo()
    const id = creerFournisseur(db, { nom: '  Boulangerie   du Port ', telephone: '  ', delaiPaiementJours: 0 })
    const f = listerFournisseurs(db).find((x) => x.id === id)!
    expect(f).toMatchObject({ nom: 'Boulangerie du Port', contact: null, telephone: null, adresse: null })
    expect(f.delaiPaiementJours).toBe(0)
  })

  it('refuse un nom vide', () => {
    expect(() => creerFournisseur(baseAvecDemo(), { nom: '   ', delaiPaiementJours: 0 })).toThrow(/obligatoire/)
  })

  it('refuse un doublon parmi les actifs, casse et espaces ignorés', () => {
    const db = baseAvecDemo()
    expect(() => creerFournisseur(db, { nom: 'grossiste  hédzranawoé', delaiPaiementJours: 0 })).toThrow(
      /existe déjà/
    )
  })

  it('accepte le nom d’un fournisseur désactivé', () => {
    const db = baseAvecDemo()
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(() => creerFournisseur(db, { nom: 'Grossiste Hédzranawoé', delaiPaiementJours: 30 })).not.toThrow()
  })

  it.each([-1, 2.5, 366, Number.NaN])('refuse un délai de paiement de %s jours', (delai) => {
    expect(() => creerFournisseur(baseAvecDemo(), { nom: 'Sodigaz', delaiPaiementJours: delai })).toThrow(
      /entre 0 \(comptant\) et 365/
    )
  })

  it('modifie la fiche, en gardant son propre nom sans se croire en doublon', () => {
    const db = baseAvecDemo()
    modifierFournisseur(db, GROSSISTE, {
      nom: 'Grossiste Hédzranawoé',
      telephone: '91 11 11 11',
      delaiPaiementJours: 30
    })
    expect(listerFournisseurs(db)[0]).toMatchObject({ telephone: '91 11 11 11', contact: null, delaiPaiementJours: 30 })
  })

  it('refuse de renommer vers le nom d’un autre fournisseur actif', () => {
    const db = baseAvecDemo()
    const id = creerFournisseur(db, { nom: 'Sodigaz', delaiPaiementJours: 0 })
    expect(() => modifierFournisseur(db, id, { nom: 'GROSSISTE HÉDZRANAWOÉ', delaiPaiementJours: 0 })).toThrow(
      /existe déjà/
    )
  })

  it('calcule le solde dû : réceptions − règlements, et la date de la dernière réception', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    recevoir(db, GROSSISTE, 25200)
    regler(db, GROSSISTE, 10000)
    const f = listerFournisseurs(db)[0]
    expect(f.soldeDu).toBe(33200)
    expect(f.derniereReception).not.toBeNull()
  })

  it('liste les actifs puis les désactivés, chacun par ordre alphabétique', () => {
    const db = baseAvecDemo()
    const z = creerFournisseur(db, { nom: 'Zénith Distribution', delaiPaiementJours: 0 })
    creerFournisseur(db, { nom: 'Agrotogo', delaiPaiementJours: 7 })
    desactiverFournisseur(db, KOSSI, z, 'Faillite')
    expect(listerFournisseurs(db).map((f) => [f.nom, f.actif])).toEqual([
      ['Agrotogo', true],
      ['Grossiste Hédzranawoé', true],
      ['Zénith Distribution', false]
    ])
  })
})

describe('Fournisseurs : désactivation', () => {
  it('exige un motif', () => {
    expect(() => desactiverFournisseur(baseAvecDemo(), KOSSI, GROSSISTE, '  ')).toThrow(/motif/)
  })

  it('refuse tant qu’il reste une dette (18 000 F reçus, rien réglé)', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')).toThrow(
      /Vous devez encore 18.000 F à « Grossiste Hédzranawoé »/
    )
    expect(listerFournisseurs(db)[0].actif).toBe(true)
  })

  it('accepte une fois la dette réglée, et journalise le motif', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    regler(db, GROSSISTE, 18000)
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(listerFournisseurs(db)[0]).toMatchObject({ actif: false, soldeDu: 0 })
    const j = une<{ utilisateurId: number; entiteId: number; apres: string }>(
      db,
      `SELECT utilisateur_id AS utilisateurId, entite_id AS entiteId, nouvelle_valeur AS apres
       FROM journal_audit WHERE action = 'desactivation_fournisseur'`
    )!
    expect(j).toMatchObject({ utilisateurId: KOSSI, entiteId: GROSSISTE })
    expect(JSON.parse(j.apres)).toEqual({ motif: 'Ne livre plus' })
  })

  it('un fournisseur désactivé ne se modifie ni ne se désactive à nouveau', () => {
    const db = baseAvecDemo()
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(() => modifierFournisseur(db, GROSSISTE, { nom: 'X', delaiPaiementJours: 0 })).toThrow(/désactivé/)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Encore')).toThrow(/déjà désactivé/)
  })

  it('refuse un fournisseur inconnu', () => {
    expect(() => desactiverFournisseur(baseAvecDemo(), KOSSI, 999, 'Motif')).toThrow(/introuvable/)
  })
})

describe('Fournisseurs : historique des achats et des prix (B7 partie 2, REGLES_METIER § 4.6)', () => {
  const carton = (db: Db): number =>
    une<{ id: number }>(db, "SELECT id FROM conditionnements WHERE code_barres = '16181000000049'")!.id
  const lait = (db: Db): number =>
    une<{ id: number }>(db, "SELECT id FROM conditionnements WHERE code_barres = '6181000000028'")!.id
  const LOIN = '2099-11-15'

  function lundi(db: Db): void {
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [
        { conditionnementId: carton(db), quantite: 3, prix: 6000 },
        { conditionnementId: lait(db), quantite: 12, prix: 2100, numeroLot: 'LOT-B03', datePeremption: LOIN }
      ]
    })
  }

  it('sans réception : listes vides, période des 90 derniers jours', () => {
    const db = baseAvecDemo()
    const a = achatsFournisseur(db, GROSSISTE)
    const jours = une<{ du: string; au: string }>(
      db,
      "SELECT date('now','localtime','-90 days') AS du, date('now','localtime') AS au"
    )!
    expect(a).toEqual({
      fournisseurId: GROSSISTE,
      nom: 'Grossiste Hédzranawoé',
      ...jours,
      receptions: [],
      totalPeriode: 0,
      prix: []
    })
  })

  it('livraison du lundi : une réception de 43 200, deux prix d’achat', () => {
    const db = baseAvecDemo()
    lundi(db)
    const a = achatsFournisseur(db, GROSSISTE)
    expect(a.totalPeriode).toBe(43200)
    expect(a.receptions).toHaveLength(1)
    expect(a.receptions[0]).toMatchObject({ total: 43200, nbLignes: 2, utilisateur: 'Kossi' })
    expect(a.prix.map((p) => [p.produit, p.conditionnement, p.dernierPrix, p.prixPrecedent])).toEqual([
      ['Lait en poudre 400 g', 'Unité', 2100, null],
      ['Tomate concentrée 70 g', 'Carton de 24', 6000, null]
    ])
  })

  it('carton à 6 000 puis 6 600 : écart +600 (+10 %), 275 F l’unité', () => {
    const db = baseAvecDemo()
    lundi(db)
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: carton(db), quantite: 2, prix: 6600 }]
    })
    const tomate = achatsFournisseur(db, GROSSISTE).prix.find((p) => p.conditionnement === 'Carton de 24')!
    expect(tomate).toMatchObject({
      dernierPrix: 6600,
      prixPrecedent: 6000,
      ecart: 600,
      ecartPourcent: 10,
      coutBase: 275,
      nbReceptions: 2
    })
  })

  it('deux lots de la même livraison : le prix précédent vient d’une réception antérieure', () => {
    const db = baseAvecDemo()
    validerReception(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [
        { conditionnementId: lait(db), quantite: 6, prix: 2000, numeroLot: 'A', datePeremption: LOIN },
        { conditionnementId: lait(db), quantite: 6, prix: 2100, numeroLot: 'B', datePeremption: LOIN }
      ]
    })
    const p = achatsFournisseur(db, GROSSISTE).prix[0]
    expect(p).toMatchObject({ dernierPrix: 2100, prixPrecedent: null, ecart: null, nbReceptions: 1 })
  })

  it('filtre les livraisons par période ; les prix gardent toute l’histoire', () => {
    const db = baseAvecDemo()
    lundi(db)
    const a = achatsFournisseur(db, GROSSISTE, { du: '2020-01-01', au: '2020-12-31' })
    expect(a.receptions).toEqual([])
    expect(a.totalPeriode).toBe(0)
    expect(a.prix).toHaveLength(2)
  })

  it('n’affiche pas les achats d’un autre fournisseur', () => {
    const db = baseAvecDemo()
    lundi(db)
    const autre = creerFournisseur(db, { nom: 'Sodigaz', delaiPaiementJours: 0 })
    expect(achatsFournisseur(db, autre)).toMatchObject({ receptions: [], prix: [], totalPeriode: 0 })
  })

  it('refuse une période à l’envers ou une date illisible', () => {
    const db = baseAvecDemo()
    expect(() => achatsFournisseur(db, GROSSISTE, { du: '2026-09-30', au: '2026-09-01' })).toThrow(/précéder/)
    expect(() => achatsFournisseur(db, GROSSISTE, { du: '30/09/2026' })).toThrow(/invalide/)
    expect(() => achatsFournisseur(db, 99)).toThrow(/introuvable/)
  })
})
