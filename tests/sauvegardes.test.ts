import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ouvrirBase, type Db } from '../src/main/db/connexion'
import { migrationsConnues, migrationsEnAttente, migrer } from '../src/main/db/migrations'
import { executer, une } from '../src/main/db/requetes'
import { semerDonneesDemo } from '../src/main/db/seed'
import { ErreurMetier } from '../src/main/core/erreurs'
import {
  aConserver,
  lireNom,
  listeSauvegardes,
  nomSauvegarde,
  sauvegarder,
  sauvegardeEnRetard,
  verifierFichier
} from '../src/main/modules/sauvegardes/service'
import {
  configurerSauvegardes,
  dernierEchecSauvegarde,
  sauvegarderEnFile
} from '../src/main/modules/sauvegardes/automatique'

const LUNDI_12_OCT = new Date(2026, 9, 12, 18, 30, 5)

/** Une sauvegarde par jour à 18 h 30, `n` jours jusqu'à `fin` comprise. */
function quotidiennes(n: number, fin: Date): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(fin)
    d.setDate(d.getDate() - i)
    return nomSauvegarde(d, 'cloture')
  })
}

describe('Nom des sauvegardes', () => {
  it('porte la date et le motif, et se relit', () => {
    const nom = nomSauvegarde(LUNDI_12_OCT, 'cloture')
    expect(nom).toBe('boutique_2026-10-12_183005_cloture.db')
    expect(lireNom(nom)).toEqual({ date: '2026-10-12 18:30:05', motif: 'cloture' })
  })

  it('ignore tout autre fichier', () => {
    expect(lireNom('notes.txt')).toBeNull()
    expect(lireNom('boutique_2026-10-12_183005_cloture.db.partiel')).toBeNull()
    expect(lireNom('boutique_2026-10-12_183005_inconnu.db')).toBeNull()
  })
})

describe('Rotation (REGLES_METIER § 14)', () => {
  it('40 sauvegardes quotidiennes : les 30 dernières + la plus récente de la semaine plus ancienne', () => {
    // Du jeudi 3/09 au lundi 12/10. Les 30 dernières vont du 13/09 au 12/10. La semaine du 7 au 13/09
    // est déjà représentée par le 13 ; celle du 31/08 au 6/09 garde le dimanche 6.
    const garder = aConserver(quotidiennes(40, LUNDI_12_OCT), LUNDI_12_OCT)
    expect(garder.size).toBe(31)
    expect(garder.has('boutique_2026-09-13_183005_cloture.db')).toBe(true)
    expect(garder.has('boutique_2026-09-12_183005_cloture.db')).toBe(false)
    expect(garder.has('boutique_2026-09-06_183005_cloture.db')).toBe(true)
    expect(garder.has('boutique_2026-09-05_183005_cloture.db')).toBe(false)
  })

  it('une par semaine sur 52 semaines : au-delà, effacée', () => {
    const recentes = quotidiennes(30, LUNDI_12_OCT)
    const debutDeLaFenetre = 'boutique_2025-10-20_090000_cloture.db' // lundi, 51 semaines plus tôt
    const tropVieille = 'boutique_2025-10-19_090000_cloture.db' // la veille : 53e semaine
    const garder = aConserver([...recentes, debutDeLaFenetre, tropVieille], LUNDI_12_OCT)
    expect(garder.has(debutDeLaFenetre)).toBe(true)
    expect(garder.has(tropVieille)).toBe(false)
  })

  it('moins de 30 sauvegardes : tout est gardé', () => {
    expect(aConserver(quotidiennes(12, LUNDI_12_OCT), LUNDI_12_OCT).size).toBe(12)
  })
})

describe('Retard de sauvegarde', () => {
  const derniere = { nom: 'x', date: '2026-10-10 18:00:00', motif: 'cloture' as const, taille: 1 }
  it('signalé au-delà de 48 heures, ou sans aucune sauvegarde', () => {
    expect(sauvegardeEnRetard(derniere, new Date(2026, 9, 12, 17, 0))).toBe(false)
    expect(sauvegardeEnRetard(derniere, new Date(2026, 9, 12, 19, 0))).toBe(true)
    expect(sauvegardeEnRetard(null, LUNDI_12_OCT)).toBe(true)
  })
})

describe('Migrations en attente', () => {
  it('toutes sur une base neuve, aucune une fois appliquées', () => {
    const db = ouvrirBase(':memory:')
    expect(migrationsEnAttente(db)).toEqual(migrationsConnues())
    migrer(db)
    expect(migrationsEnAttente(db)).toEqual([])
  })
})

describe('Sauvegarde d’une base réelle (fichier, mode WAL)', () => {
  let racine: string
  let dossier: string
  let db: Db

  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'pos-sauvegardes-'))
    dossier = join(racine, 'sauvegardes')
    db = ouvrirBase(join(racine, 'boutique.db'))
    migrer(db)
    semerDonneesDemo(db)
  })
  afterEach(() => {
    db.close()
    rmSync(racine, { recursive: true, force: true })
  })

  function relire<T>(fichier: string, sql: string): T {
    const copie = new DatabaseSync(join(dossier, fichier), { readOnly: true })
    try {
      return copie.prepare(sql).get() as T
    } finally {
      copie.close()
    }
  }

  it('copie toute la base ; ce qui est écrit ensuite n’y est pas', async () => {
    const r = await sauvegarder(db, {
      dossier,
      motif: 'manuelle',
      dossierExterne: null,
      maintenant: LUNDI_12_OCT
    })
    executer(db, "INSERT INTO categories (nom) VALUES ('Écrite après la sauvegarde')")

    expect(r.sauvegarde.nom).toBe('boutique_2026-10-12_183005_manuelle.db')
    expect(r.sauvegarde.taille).toBeGreaterThan(0)
    expect(r.copieExterne).toBe('non_reglee')
    const produits = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM produits')!.n
    expect(relire<{ n: number }>(r.sauvegarde.nom, 'SELECT COUNT(*) AS n FROM produits').n).toBe(produits)
    expect(
      relire<{ n: number }>(r.sauvegarde.nom, "SELECT COUNT(*) AS n FROM categories WHERE nom LIKE 'Écrite%'")
        .n
    ).toBe(0)
    // Aucun fichier provisoire laissé derrière.
    expect(readdirSync(dossier)).toEqual([r.sauvegarde.nom])
    expect(() => verifierFichier(join(dossier, r.sauvegarde.nom))).not.toThrow()
  })

  it('deux sauvegardes dans la même seconde : deux fichiers, la première n’est pas écrasée', async () => {
    const a = await sauvegarder(db, {
      dossier,
      motif: 'cloture',
      dossierExterne: null,
      maintenant: LUNDI_12_OCT
    })
    const b = await sauvegarder(db, {
      dossier,
      motif: 'cloture',
      dossierExterne: null,
      maintenant: LUNDI_12_OCT
    })
    expect(a.sauvegarde.nom).not.toBe(b.sauvegarde.nom)
    expect(listeSauvegardes(dossier).map((s) => s.nom)).toEqual([b.sauvegarde.nom, a.sauvegarde.nom])
  })

  it('applique la rotation sur le disque, sans toucher aux autres fichiers', async () => {
    mkdirSync(dossier)
    // 40 anciennes (fichiers factices : la rotation ne lit que les noms), dont la plus récente la veille.
    const veille = new Date(2026, 9, 11, 18, 30, 5)
    for (const nom of quotidiennes(40, veille)) writeFileSync(join(dossier, nom), 'x')
    writeFileSync(join(dossier, 'notes.txt'), 'à garder')

    await sauvegarder(db, { dossier, motif: 'cloture', dossierExterne: null, maintenant: LUNDI_12_OCT })

    const restants = readdirSync(dossier)
    expect(restants).toContain('notes.txt')
    expect(restants).toContain('boutique_2026-10-12_183005_cloture.db')
    expect(listeSauvegardes(dossier).length).toBe(aConserver(restants, LUNDI_12_OCT).size)
    expect(listeSauvegardes(dossier).length).toBe(31) // 30 dernières + dimanche 6/09
  })

  it('clé USB : copiée si présente, signalée absente sinon, sans empêcher la sauvegarde locale', async () => {
    const cle = join(racine, 'cle')
    const absente = await sauvegarder(db, {
      dossier,
      motif: 'cloture',
      dossierExterne: cle,
      maintenant: LUNDI_12_OCT
    })
    expect(absente.copieExterne).toBe('absente')
    expect(existsSync(join(dossier, absente.sauvegarde.nom))).toBe(true)

    mkdirSync(cle)
    const faite = await sauvegarder(db, {
      dossier,
      motif: 'manuelle',
      dossierExterne: cle,
      maintenant: LUNDI_12_OCT
    })
    expect(faite.copieExterne).toBe('faite')
    expect(readdirSync(cle)).toEqual([faite.sauvegarde.nom])
    expect(() => verifierFichier(join(cle, faite.sauvegarde.nom))).not.toThrow()
  })

  it('file d’attente : deux demandes simultanées aboutissent toutes les deux ; un échec est noté puis effacé', async () => {
    configurerSauvegardes(join(racine, 'boutique.db'))
    const [a, b] = await Promise.all([sauvegarderEnFile(db, 'cloture'), sauvegarderEnFile(db, 'manuelle')])
    expect(a.sauvegarde.nom).not.toBe(b.sauvegarde.nom)
    expect(listeSauvegardes(dossier)).toHaveLength(2)

    // Le dossier des sauvegardes est remplacé par un fichier : la sauvegarde ne peut pas s'écrire.
    const autre = join(racine, 'autre')
    mkdirSync(autre)
    writeFileSync(join(autre, 'sauvegardes'), 'pas un dossier')
    configurerSauvegardes(join(autre, 'boutique.db'))
    await expect(sauvegarderEnFile(db, 'cloture')).rejects.toBeInstanceOf(ErreurMetier)
    expect(dernierEchecSauvegarde()).toMatch(/La sauvegarde a échoué/)

    configurerSauvegardes(join(racine, 'boutique.db'))
    await sauvegarderEnFile(db, 'manuelle')
    expect(dernierEchecSauvegarde()).toBeNull()
  })
})

describe('Vérification d’un fichier de sauvegarde', () => {
  let racine: string
  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'pos-verif-'))
  })
  afterEach(() => rmSync(racine, { recursive: true, force: true }))

  it('refuse un fichier qui n’est pas une base', () => {
    const f = join(racine, 'faux.db')
    writeFileSync(f, 'ceci n’est pas une base SQLite, même si le nom le prétend')
    expect(() => verifierFichier(f)).toThrow('Ce fichier n’est pas une sauvegarde lisible de la boutique')
  })

  it('refuse une base SQLite qui n’est pas celle de la boutique', () => {
    const f = join(racine, 'autre.db')
    const autre = new DatabaseSync(f)
    autre.exec('CREATE TABLE t (x)')
    autre.close()
    expect(() => verifierFichier(f)).toThrow(ErreurMetier)
  })
})
