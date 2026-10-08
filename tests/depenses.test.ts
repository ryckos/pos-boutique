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
import { baseAvecDemo, baseDeTest } from './aide'

// Démo : Kossi = 3 (gérant).
const KOSSI = 3

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
  return enregistrerDepense(db, KOSSI, {
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
    expect(() => executer(db, 'DELETE FROM categories_depense WHERE id = ?', ids[0])).toThrow(/ne se supprime pas/)
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
    const d = enregistrerDepense(db, KOSSI, {
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
      enregistrerDepense(db, KOSSI, {
        categorieId: categorie(db, 'Transport'),
        libelle: '  ',
        montant: 1000,
        source: 'fonds_propres'
      })
    ).toThrow(/à quoi correspond/)
    expect(() =>
      enregistrerDepense(db, KOSSI, { categorieId: 999, libelle: 'X', montant: 1000, source: 'fonds_propres' })
    ).toThrow(/Choisissez la catégorie/)
    // Aucun numéro consommé par les refus : la prochaine dépense est la première.
    expect(taxi(db).numero).toMatch(/-000001$/)
  })

  it('refuse la source « caisse » tant que les mouvements de caisse (A8) ne sont pas livrés', () => {
    const db = baseAvecDemo()
    expect(() =>
      enregistrerDepense(db, KOSSI, {
        categorieId: categorie(db, 'Transport'),
        libelle: 'Taxi-moto',
        montant: 1000,
        source: 'caisse'
      })
    ).toThrow(/choisissez « Fonds propres »/)
    expect(toutes(db, 'SELECT id FROM depenses')).toHaveLength(0)
  })
})

describe('Liste, totaux et annulation', () => {
  it('1 000 + loyer 15 000 = 16 000 ; après annulation du loyer, 1 000', () => {
    const db = baseAvecDemo()
    taxi(db)
    const loyer = enregistrerDepense(db, KOSSI, {
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
    expect(JSON.parse(journal.ancienne)).toMatchObject({ numero: loyer.numero, montant: 15_000, categorie: 'Loyer' })
    expect(JSON.parse(journal.nouvelle)).toEqual({ motif: 'saisi deux fois' })
  })

  it('annulation : motif obligatoire, une seule fois ; une dépense ne se supprime ni ne se modifie annulée', () => {
    const db = baseAvecDemo()
    const d = taxi(db)
    expect(() => annulerDepense(db, KOSSI, d.id, ' ')).toThrow(/motif/)
    annulerDepense(db, KOSSI, d.id, 'erreur')
    expect(() => annulerDepense(db, KOSSI, d.id, 'encore')).toThrow(/déjà annulée/)
    expect(() => executer(db, 'DELETE FROM depenses WHERE id = ?', d.id)).toThrow(/ne se supprime pas/)
    expect(() => executer(db, 'UPDATE depenses SET montant = 1 WHERE id = ?', d.id)).toThrow(/ne se modifie plus/)
  })

  it('filtre par période (30 jours par défaut) et par catégorie', () => {
    const db = baseAvecDemo()
    const jour = aujourdhui(db)
    taxi(db, 1000)
    taxi(db, 2000, decaler(jour, -29))
    taxi(db, 4000, decaler(jour, -30))
    enregistrerDepense(db, KOSSI, {
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
