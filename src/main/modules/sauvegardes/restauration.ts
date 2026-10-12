/**
 * Restauration d'une sauvegarde (B16, REGLES_METIER § 14). Propriétaire : Dev B.
 *
 * Windows ne laisse pas remplacer une base ouverte : la restauration se fait en deux temps.
 *  1. Application ouverte : `preparerRestauration` vérifie le fichier et le copie à côté de la base
 *     sous un nom d'attente ; l'appelant sauvegarde la base en place, puis `confirmerRestauration`
 *     écrit une fiche qui décrit la restauration. L'application redémarre.
 *  2. `appliquerRestauration` (au démarrage, base encore fermée) : remplace la base par la copie.
 *     Après les migrations, `journaliserRestauration` écrit le journal DANS la base restaurée.
 * La fiche est écrite en dernier : sans elle, une copie d'attente orpheline (coupure en pleine
 * préparation) est ignorée et effacée, et la base en place reste intacte.
 */
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Db } from '../../db/connexion'
import { une } from '../../db/requetes'
import { migrationsConnues } from '../../db/migrations'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { lireNom, verifierFichier } from './service'

export interface FicheRestauration {
  /** Nom du fichier restauré (sans dossier). */
  fichier: string
  /** « AAAA-MM-JJ HH:MM:SS » si le nom du fichier la porte ; null pour un fichier renommé. */
  dateSauvegarde: string | null
  /** Sauvegarde de la base remplacée (motif `avant_restauration`). */
  sauvegardeAvant: string
  utilisateurId: number
}

const enAttente = (cheminBase: string): string => `${cheminBase}.restauration`
const fiche = (cheminBase: string): string => `${cheminBase}.restauration.json`

function supprimerBase(chemin: string): void {
  for (const f of [chemin, `${chemin}-wal`, `${chemin}-shm`]) rmSync(f, { force: true })
}

/**
 * Lève une ErreurMetier si le fichier ne peut pas être restauré : illisible, pas une base de la
 * boutique, ou venant d'une version plus récente de l'application (une migration inconnue d'elle).
 */
export function verifierRestaurable(chemin: string): void {
  verifierFichier(chemin)
  const copie = new DatabaseSync(chemin, { readOnly: true })
  let noms: string[]
  try {
    noms = (copie.prepare('SELECT nom FROM schema_migrations').all() as { nom: string }[]).map((r) => r.nom)
  } finally {
    copie.close()
  }
  const connues = new Set(migrationsConnues())
  if (noms.some((n) => !connues.has(n))) {
    throw new ErreurMetier(
      'Cette sauvegarde vient d’une version plus récente de l’application : mettez d’abord l’application à jour'
    )
  }
}

/**
 * Étape 1 : vérifie `source` et la copie à côté de la base, sous un nom d'attente. Copiée d'abord,
 * avant la sauvegarde de la base en place, dont la rotation pourrait effacer le fichier choisi.
 * Renvoie la fiche à compléter, puis à confirmer.
 */
export function preparerRestauration(
  cheminBase: string,
  source: string
): Pick<FicheRestauration, 'fichier' | 'dateSauvegarde'> {
  verifierRestaurable(source)
  const attente = enAttente(cheminBase)
  rmSync(fiche(cheminBase), { force: true })
  supprimerBase(attente)
  try {
    copyFileSync(source, attente)
    // La copie elle-même est revérifiée : une clé USB peut lâcher pendant la lecture.
    verifierRestaurable(attente)
  } catch (e) {
    supprimerBase(attente)
    throw e instanceof ErreurMetier
      ? e
      : new ErreurMetier('La sauvegarde n’a pas pu être copiée : vérifiez la clé USB ou la place libre')
  }
  const fichier = basename(source)
  return { fichier, dateSauvegarde: lireNom(fichier)?.date ?? null }
}

/** Étape 2, une fois la base en place sauvegardée : la restauration se fera au redémarrage. */
export function confirmerRestauration(cheminBase: string, f: FicheRestauration): void {
  writeFileSync(fiche(cheminBase), JSON.stringify(f))
}

/** Si la sauvegarde de la base en place échoue : on ne restaure pas. */
export function abandonnerRestauration(cheminBase: string): void {
  rmSync(fiche(cheminBase), { force: true })
  supprimerBase(enAttente(cheminBase))
}

/**
 * Au démarrage, AVANT d'ouvrir la base : remplace la base par la copie en attente s'il y en a une.
 * Renvoie la fiche (à journaliser une fois la base ouverte et migrée), ou null.
 */
export function appliquerRestauration(cheminBase: string): FicheRestauration | null {
  const attente = enAttente(cheminBase)
  if (!existsSync(fiche(cheminBase))) {
    supprimerBase(attente) // préparation interrompue : on garde la base en place
    return null
  }
  let f: FicheRestauration
  try {
    f = JSON.parse(readFileSync(fiche(cheminBase), 'utf8')) as FicheRestauration
  } catch {
    rmSync(fiche(cheminBase), { force: true })
    supprimerBase(attente)
    return null
  }
  if (!existsSync(attente)) {
    rmSync(fiche(cheminBase), { force: true })
    return null
  }
  // Le journal WAL de l'ancienne base ne doit jamais s'appliquer à la nouvelle.
  rmSync(`${cheminBase}-wal`, { force: true })
  rmSync(`${cheminBase}-shm`, { force: true })
  renameSync(attente, cheminBase)
  return f
}

/**
 * Écrit `restauration_sauvegarde` dans la base restaurée, puis efface la fiche. La personne qui a
 * restauré peut ne pas exister dans une sauvegarde ancienne : le journal est alors au nom du premier
 * administrateur (seul l'admin peut restaurer).
 */
export function journaliserRestauration(db: Db, cheminBase: string, f: FicheRestauration): void {
  const existe = une(db, 'SELECT 1 FROM utilisateurs WHERE id = ?', f.utilisateurId)
  const admin = une<{ id: number }>(
    db,
    "SELECT id FROM utilisateurs WHERE role = 'admin' ORDER BY id LIMIT 1"
  )
  const auteur = existe ? f.utilisateurId : admin?.id
  if (auteur !== undefined) {
    journaliser(db, {
      utilisateurId: auteur,
      action: 'restauration_sauvegarde',
      apres: {
        fichier: f.fichier,
        dateSauvegarde: f.dateSauvegarde,
        sauvegardeAvant: f.sauvegardeAvant
      }
    })
  }
  rmSync(fiche(cheminBase), { force: true })
}
