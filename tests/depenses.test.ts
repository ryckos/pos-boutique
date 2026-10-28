import { describe, expect, it } from 'vitest'
import {
  annulerDepense,
  creerCategorie,
  desactiverCategorie,
  enregistrerDepense,
  listerCategories,
  listerDepenses,
  totalDepenses
} from '../src/main/modules/depenses/service'
import { executer, toutes, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { cloturerSession, rapportSession } from '../src/main/modules/caisse/service-cloture'
import { saisirMouvementAuTiroir } from '../src/main/modules/caisse/service-mouvements'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { baseAvecDemo, baseDeTest } from './aide'

// Démo : Kossi = 3 (gérant).
const KOSSI = 3
const GERANT = { id: KOSSI, nom: 'Kossi', role: 'gerant' as const }

function categorie(db: Db, nom: string): number {
  return une<{ id: number }>(db, 'SELECT id FROM categories_depense WHERE nom = ?', nom)!.id
}
function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}
function decaler(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10)
}
function taxi(db: Db, montant = 1000, date?: string): ReturnType<typeof enregistrerDepense> {
  return enregistrerDepense(db, GERANT, {
    categorieId: categorie(db, 'Transport'),
    libelle: 'Taxi-moto',
    montant,
    source: 'fonds_propres',
    date
  })
}

describe('Catégories de dépenses', () => {
  it('neuf catégories de départ, même dans une base de production, « Autre » en dernier', () => {
    const noms = listerCategories(baseDeTest()).map((c) => c.nom)
    expect(noms).toHaveLength(9)
    expect(noms[0]).toBe('Eau')
    expect(noms.at(-1)).toBe('Autre')
  })

  it('crée une catégorie, refuse un nom déjà pris (majuscules et espaces ignorés)', () => {
    const db = baseAvecDemo()
    expect(creerCategorie(db, '  Gardiennage ').nom).toBe('Gardiennage')
    expect(() => creerCategorie(db, 'loyer')).toThrow(/« Loyer » existe déjà/)
    expect(() => creerCategorie(db, ' ')).toThrow(/nom de la catégorie/)
  })

  it('une catégorie désactivée disparaît du choix, garde ses dépenses et son nom', () => {
    const db = baseAvecDemo()
    const d = taxi(db)
    desactiverCategorie(db, categorie(db, 'Transport'))
    expect(listerCategories(db).map((c) => c.nom)).not.toContain('Transport')
    expect(listerCategories(db, true).at(-1)).toMatchObject({ nom: 'Transport', actif: false })
    expect(listerDepenses(db).depenses[0]).toMatchObject({ id: d.id, categorie: 'Transport' })
    expect(() => taxi(db)).toThrow(/« Transport » est désactivée/)
    expect(() => creerCategorie(db, 'TRANSPORT')).toThrow(/désactivée : choisissez un autre nom/)
    expect(() => desactiverCategorie(db, categorie(db, 'Transport'))).toThrow(/déjà désactivée/)
  })

  it('garde au moins une catégorie active ; aucune ne se supprime', () => {
    const db = baseAvecDemo()
    const ids = listerCategories(db).map((c) => c.id)
    for (const id of ids.slice(1)) desactiverCategorie(db, id)
    expect(() => desactiverCategorie(db, ids[0])).toThrow(/au moins une catégorie/)
    expect(() => executer(db, 'DELETE FROM categories_depense WHERE id = ?', ids[0])).toThrow(
      /ne se supprime pas/
    )
  })
})

describe('Enregistrer une dépense (REGLES_METIER § 10)', () => {
  it('taxi-moto de 1 000 F en fonds propres : numéro DEP, date du jour, sans effet sur la caisse', () => {
    const db = baseAvecDemo()
    const annee = new Date().getFullYear()
    const d = taxi(db)
    expect(d).toMatchObject({
      numero: `DEP-${annee}-000001`,
      date: aujourdhui(db),
      categorie: 'Transport',
      libelle: 'Taxi-moto',
      montant: 1000,
      source: 'fonds_propres',
      reference: null,
      utilisateur: 'Kossi',
      annuleLe: null
    })
    expect(taxi(db).numero).toBe(`DEP-${annee}-000002`)
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM mouvements_caisse')!.n).toBe(0)
  })

  it('garde la référence du reçu et accepte une date passée', () => {
    const db = baseAvecDemo()
    const hier = decaler(aujourdhui(db), -1)
    const d = enregistrerDepense(db, GERANT, {
      categorieId: categorie(db, 'Électricité'),
      libelle: ' Facture  CEET ',
      montant: 23_500,
      source: 'fonds_propres',
      date: hier,
      reference: ' Reçu 4512 '
    })
    expect(d).toMatchObject({ libelle: 'Facture CEET', date: hier, reference: 'Reçu 4512' })
  })

  it('refuse un montant nul, négatif ou à virgule, un libellé vide, une date future ou invalide', () => {
    const db = baseAvecDemo()
    for (const montant of [0, -500, 1000.5]) expect(() => taxi(db, montant)).toThrow(/sans virgule/)
    expect(() => taxi(db, 1000, decaler(aujourdhui(db), 1))).toThrow(/dans le futur/)
    expect(() => taxi(db, 1000, '2026-02-30')).toThrow(/date de la dépense/)
    expect(() =>
      enregistrerDepense(db, GERANT, {
        categorieId: categorie(db, 'Transport'),
        libelle: '  ',
        montant: 1000,
        source: 'fonds_propres'
      })
    ).toThrow(/à quoi correspond/)
    expect(() =>
      enregistrerDepense(db, GERANT, {
        categorieId: 999,
        libelle: 'X',
        montant: 1000,
        source: 'fonds_propres'
      })
    ).toThrow(/Choisissez la catégorie/)
    // Aucun numéro consommé par les refus : la prochaine dépense est la première.
    expect(taxi(db).numero).toMatch(/-000001$/)
  })
})

describe('Dépense payée au tiroir (source « caisse »)', () => {
  const AFI = { id: 2, nom: 'Afi', role: 'caissier' as const }
  const PATRON = { id: 1, nom: 'Patron', role: 'admin' as const }
  const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

  /** Vendredi soir : fond 10 000 + espèces 46 200 + 3 500 encaissés = 59 700 dans le tiroir d'Afi. */
  function caisseAfi(): { db: Db; sessionId: number } {
    const db = baseAvecDemo()
    const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
    enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, '16181000000049'), quantite: 6 }],
      paiements: [{ mode: 'especes', montant: 45000 }]
    })
    enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, '101'), quantite: 4 }],
      paiements: [{ mode: 'especes', montant: 1200 }]
    })
    // L'encaissement de créance de Mme Abra (3 500) arrive avec A12 : un apport le remplace.
    saisirMouvementAuTiroir(db, GERANT, { motif: 'apport', montant: 3500, commentaire: 'créance Mme Abra' })
    return { db, sessionId }
  }
  const auTiroir = (db: Db, u: typeof AFI | typeof GERANT, montant = 1000, sessionId?: number) =>
    enregistrerDepense(db, u, {
      categorieId: categorie(db, 'Transport'),
      libelle: 'Taxi-moto',
      montant,
      source: 'caisse',
      sessionId
    })

  it('taxi-moto 1 000 F payé par Afi : espèces théoriques 58 700, « Dépense (Taxi-moto) » sur le X', () => {
    const { db, sessionId } = caisseAfi()
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(59_700)
    const d = auTiroir(db, AFI)
    expect(d).toMatchObject({
      source: 'caisse',
      date: aujourdhui(db),
      sessionId,
      caissier: 'Afi',
      sessionCloturee: false,
      utilisateur: 'Afi'
    })
    const r = rapportSession(db, sessionId)
    expect(r.especesTheoriques).toBe(58_700)
    expect(r.mouvements.at(-1)).toEqual({ sens: 'sortie', libelle: 'Dépense (Taxi-moto)', montant: 1000 })
    expect(
      une(db, "SELECT document_type AS t, document_id AS d FROM mouvements_caisse WHERE motif = 'depense'")
    ).toEqual({ t: 'depense', d: d.id })
    // Compte aussi dans les totaux de la boutique.
    expect(totalDepenses(db, aujourdhui(db), aujourdhui(db))).toBe(1000)
  })

  it('jamais plus que le tiroir : 60 000 refusés, ni dépense ni numéro consommé', () => {
    const { db } = caisseAfi()
    expect(() => auTiroir(db, AFI, 60_000)).toThrow(/Il n’y a que 59\s700\sF en caisse/)
    expect(toutes(db, 'SELECT id FROM depenses')).toHaveLength(0)
    expect(auTiroir(db, AFI).numero).toMatch(/-000001$/)
  })

  it('une dépense au tiroir est toujours datée du jour', () => {
    const { db } = caisseAfi()
    const d = enregistrerDepense(db, AFI, {
      categorieId: categorie(db, 'Transport'),
      libelle: 'Taxi-moto',
      montant: 1000,
      source: 'caisse',
      date: decaler(aujourdhui(db), -3)
    })
    expect(d.date).toBe(aujourdhui(db))
  })

  it('caissière : sa caisse ouverte seulement, jamais les fonds propres', () => {
    const db = baseAvecDemo()
    expect(() => auTiroir(db, AFI)).toThrow(/Ouvrez votre caisse/)
    const { id: sessionPatron } = ouvrirSession(db, PATRON.id, 5000)
    ouvrirSession(db, AFI.id, 5000)
    expect(() => auTiroir(db, AFI, 1000, sessionPatron)).toThrow(/votre propre caisse/)
    expect(() =>
      enregistrerDepense(db, AFI, {
        categorieId: categorie(db, 'Loyer'),
        libelle: 'Loyer',
        montant: 1000,
        source: 'fonds_propres'
      })
    ).toThrow(/payée au tiroir de votre caisse/)
  })

  it('gérant : la seule caisse ouverte (celle d’Afi), sinon il choisit', () => {
    const db = baseAvecDemo()
    expect(() => auTiroir(db, GERANT)).toThrow(/Aucune caisse n’est ouverte/)
    const { id: caisseAfi } = ouvrirSession(db, AFI.id, 5000)
    expect(auTiroir(db, GERANT)).toMatchObject({
      sessionId: caisseAfi,
      caissier: 'Afi',
      utilisateur: 'Kossi'
    })
    const { id: caissePatron } = ouvrirSession(db, PATRON.id, 5000)
    expect(() => auTiroir(db, GERANT)).toThrow(/Plusieurs caisses sont ouvertes/)
    expect(auTiroir(db, GERANT, 1000, caissePatron).sessionId).toBe(caissePatron)
    // Sa propre caisse passe avant les autres.
    const { id: caisseKossi } = ouvrirSession(db, GERANT.id, 5000)
    expect(auTiroir(db, GERANT).sessionId).toBe(caisseKossi)
  })

  it('la caissière ne voit que les dépenses de sa caisse ouverte', () => {
    const { db, sessionId } = caisseAfi()
    taxi(db)
    const d = auTiroir(db, AFI)
    expect(listerDepenses(db, {}, AFI.id).depenses.map((x) => x.id)).toEqual([d.id])
    expect(listerDepenses(db).depenses).toHaveLength(2)
    cloturerSession(db, AFI, { montantCompte: 58_700, commentaire: '' })
    expect(listerDepenses(db, {}, AFI.id).depenses).toEqual([])
    expect(listerDepenses(db).depenses.find((x) => x.id === d.id)).toMatchObject({
      sessionId,
      sessionCloturee: true
    })
  })

  it('annulation : les 1 000 F reviennent au tiroir (59 700) ; refusée une fois la caisse clôturée', () => {
    const { db, sessionId } = caisseAfi()
    const d = auTiroir(db, AFI)
    annulerDepense(db, KOSSI, d.id, 'saisie en double')
    const r = rapportSession(db, sessionId)
    expect(r.especesTheoriques).toBe(59_700)
    expect(r.mouvements.at(-1)!.sens).toBe('entree')
    expect(totalDepenses(db, aujourdhui(db), aujourdhui(db))).toBe(0)

    const e = auTiroir(db, AFI)
    cloturerSession(db, AFI, { montantCompte: 58_700, commentaire: '' })
    expect(() => annulerDepense(db, KOSSI, e.id, 'erreur')).toThrow(/clôturée : la dépense ne s’annule plus/)
    expect(listerDepenses(db).depenses.find((x) => x.id === e.id)!.annuleLe).toBeNull()
  })

  it('si la dépense échoue après la sortie, rien n’est écrit (même transaction)', () => {
    const { db, sessionId } = caisseAfi()
    executer(
      db,
      `CREATE TRIGGER panne AFTER INSERT ON mouvements_caisse WHEN NEW.motif = 'depense'
       BEGIN SELECT RAISE(ABORT, 'coupure'); END`
    )
    expect(() => auTiroir(db, AFI)).toThrow(/coupure/)
    expect(toutes(db, 'SELECT id FROM depenses')).toHaveLength(0)
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(59_700)
  })
})

describe('Liste, totaux et annulation', () => {
  it('1 000 + loyer 15 000 = 16 000 ; après annulation du loyer, 1 000', () => {
    const db = baseAvecDemo()
    taxi(db)
    const loyer = enregistrerDepense(db, GERANT, {
      categorieId: categorie(db, 'Loyer'),
      libelle: 'Loyer d’octobre',
      montant: 15_000,
      source: 'fonds_propres'
    })
    let liste = listerDepenses(db)
    expect(liste.total).toBe(16_000)
    expect(liste.parCategorie).toEqual([
      { categorieId: categorie(db, 'Loyer'), categorie: 'Loyer', total: 15_000 },
      { categorieId: categorie(db, 'Transport'), categorie: 'Transport', total: 1000 }
    ])
    expect(totalDepenses(db, aujourdhui(db), aujourdhui(db))).toBe(16_000)

    annulerDepense(db, KOSSI, loyer.id, '  saisi deux fois ')
    liste = listerDepenses(db)
    expect(liste.total).toBe(1000)
    expect(liste.parCategorie.map((c) => c.categorie)).toEqual(['Transport'])
    expect(totalDepenses(db, aujourdhui(db), aujourdhui(db))).toBe(1000)
    // L'annulée reste visible.
    expect(liste.depenses.find((d) => d.id === loyer.id)).toMatchObject({
      annulePar: 'Kossi',
      motifAnnulation: 'saisi deux fois'
    })
    expect(liste.depenses.find((d) => d.id === loyer.id)!.annuleLe).not.toBeNull()

    const journal = une<{ ancienne: string; nouvelle: string }>(
      db,
      `SELECT ancienne_valeur AS ancienne, nouvelle_valeur AS nouvelle FROM journal_audit
       WHERE action = 'annulation_depense' AND entite_id = ?`,
      loyer.id
    )!
    expect(JSON.parse(journal.ancienne)).toMatchObject({
      numero: loyer.numero,
      montant: 15_000,
      categorie: 'Loyer'
    })
    expect(JSON.parse(journal.nouvelle)).toEqual({ motif: 'saisi deux fois' })
  })

  it('annulation : motif obligatoire, une seule fois ; une dépense ne se supprime ni ne se modifie annulée', () => {
    const db = baseAvecDemo()
    const d = taxi(db)
    expect(() => annulerDepense(db, KOSSI, d.id, ' ')).toThrow(/motif/)
    annulerDepense(db, KOSSI, d.id, 'erreur')
    expect(() => annulerDepense(db, KOSSI, d.id, 'encore')).toThrow(/déjà annulée/)
    expect(() => executer(db, 'DELETE FROM depenses WHERE id = ?', d.id)).toThrow(/ne se supprime pas/)
    expect(() => executer(db, 'UPDATE depenses SET montant = 1 WHERE id = ?', d.id)).toThrow(
      /ne se modifie plus/
    )
  })

  it('filtre par période (30 jours par défaut) et par catégorie', () => {
    const db = baseAvecDemo()
    const jour = aujourdhui(db)
    taxi(db, 1000)
    taxi(db, 2000, decaler(jour, -29))
    taxi(db, 4000, decaler(jour, -30))
    enregistrerDepense(db, GERANT, {
      categorieId: categorie(db, 'Eau'),
      libelle: 'Facture TdE',
      montant: 8000,
      source: 'fonds_propres'
    })
    expect(listerDepenses(db)).toMatchObject({ du: decaler(jour, -29), au: jour, total: 11_000 })
    expect(listerDepenses(db, { du: decaler(jour, -30), au: decaler(jour, -1) }).total).toBe(6000)
    expect(listerDepenses(db, { categorieId: categorie(db, 'Eau') }).total).toBe(8000)
    expect(() => listerDepenses(db, { du: jour, au: decaler(jour, -1) })).toThrow(/précéder/)
  })
})
