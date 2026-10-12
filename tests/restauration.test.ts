import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ouvrirBase, type Db } from '../src/main/db/connexion'
import { migrer } from '../src/main/db/migrations'
import { executer, une } from '../src/main/db/requetes'
import { semerDonneesDemo } from '../src/main/db/seed'
import { sauvegarder } from '../src/main/modules/sauvegardes/service'
import {
  abandonnerRestauration,
  appliquerRestauration,
  confirmerRestauration,
  journaliserRestauration,
  preparerRestauration,
  verifierRestaurable
} from '../src/main/modules/sauvegardes/restauration'
import { detailsAudit, lireJson } from '../src/shared/audit'

const LUNDI_12_OCT = new Date(2026, 9, 12, 18, 30, 5)

describe('Restauration d’une sauvegarde (REGLES_METIER § 14)', () => {
  let racine: string
  let dossier: string
  let cheminBase: string
  let db: Db

  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'pos-restauration-'))
    dossier = join(racine, 'sauvegardes')
    cheminBase = join(racine, 'boutique.db')
    db = ouvrirBase(cheminBase)
    migrer(db)
    semerDonneesDemo(db)
  })
  afterEach(() => {
    db.close()
    rmSync(racine, { recursive: true, force: true })
  })

  const categoriesApres = (d: Db): number =>
    une<{ n: number }>(d, "SELECT COUNT(*) AS n FROM categories WHERE nom = 'Écrite après'")!.n

  /** Ce que fait l'application : préparer, sauvegarder la base en place, confirmer, redémarrer. */
  async function restaurer(source: string, utilisateurId = 1): Promise<string> {
    const prete = preparerRestauration(cheminBase, source)
    const avant = await sauvegarder(db, { dossier, motif: 'avant_restauration', dossierExterne: null })
    confirmerRestauration(cheminBase, { ...prete, sauvegardeAvant: avant.sauvegarde.nom, utilisateurId })
    return avant.sauvegarde.nom
  }

  /** Redémarrage : base fermée, restauration appliquée, base rouverte et migrée. */
  function redemarrer(): ReturnType<typeof appliquerRestauration> {
    db.close()
    const fiche = appliquerRestauration(cheminBase)
    db = ouvrirBase(cheminBase)
    migrer(db)
    if (fiche) journaliserRestauration(db, cheminBase, fiche)
    return fiche
  }

  it('la base revient à l’état sauvegardé ; la base remplacée est gardée ; le journal est dans la base restaurée', async () => {
    const s = await sauvegarder(db, {
      dossier,
      motif: 'cloture',
      dossierExterne: null,
      maintenant: LUNDI_12_OCT
    })
    executer(db, "INSERT INTO categories (nom) VALUES ('Écrite après')")

    const avant = await restaurer(join(dossier, s.sauvegarde.nom))
    // Rien n'a encore changé avant le redémarrage.
    expect(categoriesApres(db)).toBe(1)

    const fiche = redemarrer()
    expect(fiche).toMatchObject({ fichier: s.sauvegarde.nom, dateSauvegarde: '2026-10-12 18:30:05' })
    expect(categoriesApres(db)).toBe(0)

    // La base remplacée, avec la catégorie écrite après, reste disponible.
    const remplacee = new DatabaseSync(join(dossier, avant), { readOnly: true })
    expect(
      (
        remplacee.prepare("SELECT COUNT(*) AS n FROM categories WHERE nom = 'Écrite après'").get() as {
          n: number
        }
      ).n
    ).toBe(1)
    remplacee.close()

    const j = une<{ utilisateurId: number; apres: string }>(
      db,
      "SELECT utilisateur_id AS utilisateurId, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'restauration_sauvegarde'"
    )!
    expect(j.utilisateurId).toBe(1)
    const details = detailsAudit(
      { action: 'restauration_sauvegarde', entite: null, avant: null, apres: lireJson(j.apres) },
      () => 'Patron'
    ).apres
    expect(details).toContainEqual({ libelle: 'Sauvegarde du', valeur: '12/10/2026 à 18 h 30' })
    expect(details).toContainEqual({ libelle: 'Base remplacée, copiée dans', valeur: avant })

    // Plus rien en attente : un second redémarrage ne restaure rien.
    expect(readdirSync(racine).filter((f) => f.includes('.restauration'))).toEqual([])
    expect(redemarrer()).toBeNull()
  })

  it('restaure un fichier renommé, choisi sur la clé (date inconnue)', async () => {
    const s = await sauvegarder(db, { dossier, motif: 'manuelle', dossierExterne: null })
    const surLaCle = join(racine, 'copie du lundi.db')
    copyFileSync(join(dossier, s.sauvegarde.nom), surLaCle)
    executer(db, "INSERT INTO categories (nom) VALUES ('Écrite après')")

    await restaurer(surLaCle)
    expect(redemarrer()).toMatchObject({ fichier: 'copie du lundi.db', dateSauvegarde: null })
    expect(categoriesApres(db)).toBe(0)
  })

  it('préparation interrompue (sans fiche) ou abandonnée : la base en place est gardée', async () => {
    const s = await sauvegarder(db, { dossier, motif: 'manuelle', dossierExterne: null })
    executer(db, "INSERT INTO categories (nom) VALUES ('Écrite après')")

    preparerRestauration(cheminBase, join(dossier, s.sauvegarde.nom)) // coupure avant la confirmation
    expect(redemarrer()).toBeNull()
    expect(categoriesApres(db)).toBe(1)
    expect(existsSync(`${cheminBase}.restauration`)).toBe(false)

    preparerRestauration(cheminBase, join(dossier, s.sauvegarde.nom))
    abandonnerRestauration(cheminBase) // la sauvegarde de la base en place a échoué
    expect(redemarrer()).toBeNull()
    expect(categoriesApres(db)).toBe(1)
  })

  it('l’utilisateur absent de la sauvegarde : journal au nom du premier administrateur', async () => {
    const s = await sauvegarder(db, { dossier, motif: 'manuelle', dossierExterne: null })
    await restaurer(join(dossier, s.sauvegarde.nom), 99)
    redemarrer()
    expect(
      une<{ id: number }>(
        db,
        "SELECT utilisateur_id AS id FROM journal_audit WHERE action = 'restauration_sauvegarde'"
      )!.id
    ).toBe(1)
  })

  it('refuse un fichier illisible, sans rien préparer', () => {
    const faux = join(racine, 'faux.db')
    writeFileSync(faux, 'pas une base')
    expect(() => preparerRestauration(cheminBase, faux)).toThrow('pas une sauvegarde lisible')
    expect(existsSync(`${cheminBase}.restauration`)).toBe(false)
  })

  it('refuse une sauvegarde d’une version plus récente de l’application', async () => {
    const s = await sauvegarder(db, { dossier, motif: 'manuelle', dossierExterne: null })
    const chemin = join(dossier, s.sauvegarde.nom)
    const copie = new DatabaseSync(chemin)
    copie.exec("INSERT INTO schema_migrations (nom) VALUES ('20991231_2359_future.sql')")
    copie.close()
    expect(() => verifierRestaurable(chemin)).toThrow('version plus récente')
    expect(() => preparerRestauration(cheminBase, chemin)).toThrow('version plus récente')
  })
})
