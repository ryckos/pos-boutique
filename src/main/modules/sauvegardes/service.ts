/**
 * Sauvegardes de la base (B16, REGLES_METIER § 14). Propriétaire : Dev B.
 * Les sauvegardes sont des fichiers dans un dossier à côté de la base : leur nom porte la date et le
 * motif, il n'y a rien à tenir à jour en base. Aucune dépendance à Electron (chemins reçus en paramètre).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import type { CopieExterne, MotifSauvegarde, ResultatSauvegarde, Sauvegarde } from '@shared/ipc/sauvegardes'
import type { Db } from '../../db/connexion'
import { ErreurMetier } from '../../core/erreurs'

const MOTIFS: MotifSauvegarde[] = ['cloture', 'mise_a_jour', 'demarrage', 'manuelle', 'avant_restauration']
const CONSERVER_DERNIERES = 30
const CONSERVER_SEMAINES = 52
/** Au-delà, l'écran signale une sauvegarde trop ancienne. */
export const RETARD_HEURES = 48

const MOTIF_NOM = /^boutique_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})_([a-z_]+)\.db$/

/** Le dossier `sauvegardes` à côté de la base (vaut aussi pour une base de développement POS_DB). */
export function dossierSauvegardes(cheminBase: string): string {
  return join(dirname(cheminBase), 'sauvegardes')
}

const deux = (n: number): string => String(n).padStart(2, '0')

function jourLocal(d: Date): string {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

export function nomSauvegarde(date: Date, motif: MotifSauvegarde): string {
  const heure = `${deux(date.getHours())}${deux(date.getMinutes())}${deux(date.getSeconds())}`
  return `boutique_${jourLocal(date)}_${heure}_${motif}.db`
}

/** Date (« AAAA-MM-JJ HH:MM:SS ») et motif lus dans le nom ; null si ce n'est pas une sauvegarde. */
export function lireNom(nom: string): { date: string; motif: MotifSauvegarde } | null {
  const m = MOTIF_NOM.exec(nom)
  if (!m || !MOTIFS.includes(m[5] as MotifSauvegarde)) return null
  return { date: `${m[1]} ${m[2]}:${m[3]}:${m[4]}`, motif: m[5] as MotifSauvegarde }
}

function enDate(dateLocale: string): Date {
  const [j, h] = dateLocale.split(' ')
  const [a, mo, d] = j.split('-').map(Number)
  const [hh, mi, ss] = h.split(':').map(Number)
  return new Date(a, mo - 1, d, hh, mi, ss)
}

/** Le lundi (« AAAA-MM-JJ ») de la semaine d'une date. */
function lundi(d: Date): string {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7))
  return jourLocal(l)
}

/**
 * Rotation : les 30 plus récentes, plus la plus récente de chaque semaine (lundi au dimanche) sur les
 * 52 dernières semaines. Les noms qui ne sont pas des sauvegardes ne sont jamais touchés.
 */
export function aConserver(noms: string[], maintenant: Date): Set<string> {
  const datees = noms
    .map((nom) => ({ nom, lu: lireNom(nom) }))
    .filter((s): s is { nom: string; lu: NonNullable<ReturnType<typeof lireNom>> } => s.lu !== null)
    // Le nom commence par la date : l'ordre alphabétique est l'ordre chronologique.
    .sort((a, b) => (a.nom < b.nom ? 1 : -1))

  const garder = new Set(datees.slice(0, CONSERVER_DERNIERES).map((s) => s.nom))
  const limite = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  limite.setDate(limite.getDate() - 7 * (CONSERVER_SEMAINES - 1))
  const premierLundi = lundi(limite)
  const semainesVues = new Set<string>()
  for (const s of datees) {
    const semaine = lundi(enDate(s.lu.date))
    if (semaine < premierLundi || semainesVues.has(semaine)) continue
    semainesVues.add(semaine)
    garder.add(s.nom)
  }
  return garder
}

/** Les sauvegardes d'un dossier, les plus récentes d'abord ; [] si le dossier n'existe pas. */
export function listeSauvegardes(dossier: string): Sauvegarde[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .map((nom) => ({ nom, lu: lireNom(nom) }))
    .filter((s) => s.lu !== null)
    .map(({ nom, lu }) => ({
      nom,
      date: lu!.date,
      motif: lu!.motif,
      taille: statSync(join(dossier, nom)).size
    }))
    .sort((a, b) => (a.nom < b.nom ? 1 : -1))
}

/**
 * Vérifie qu'un fichier est une base SQLite lisible et intègre. Lève une ErreurMetier sinon.
 * Ouverte en lecture seule, puis refermée : le fichier n'est jamais modifié.
 */
export function verifierFichier(chemin: string): void {
  let copie: DatabaseSync | null = null
  try {
    copie = new DatabaseSync(chemin, { readOnly: true })
    const r = copie.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined
    if (!r || Object.values(r)[0] !== 'ok') throw new Error('intégrité')
    // Une base de l'application a toujours sa table des migrations.
    if (!copie.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get())
      throw new Error('pas une base de la boutique')
  } catch {
    throw new ErreurMetier('Ce fichier n’est pas une sauvegarde lisible de la boutique')
  } finally {
    copie?.close()
  }
}

/** Un fichier de base et ses éventuels compagnons du mode WAL. */
function supprimerBase(chemin: string): void {
  for (const f of [chemin, `${chemin}-wal`, `${chemin}-shm`]) rmSync(f, { force: true })
}

/**
 * La copie hérite du mode WAL de la base : on la repasse en journal classique pour qu'elle tienne
 * en un seul fichier, qu'on peut copier sur une clé ou restaurer sans fichiers compagnons.
 */
function rendreAutonome(chemin: string): void {
  const copie = new DatabaseSync(chemin)
  try {
    copie.exec('PRAGMA journal_mode = DELETE')
  } finally {
    copie.close()
  }
}

function supprimerSurplus(dossier: string, maintenant: Date): void {
  const noms = readdirSync(dossier)
  const garder = aConserver(noms, maintenant)
  for (const nom of noms) {
    if (lireNom(nom) && !garder.has(nom)) rmSync(join(dossier, nom), { force: true })
  }
}

function copierSurCle(
  fichier: string,
  nom: string,
  dossierExterne: string | null,
  maintenant: Date
): CopieExterne {
  if (!dossierExterne) return 'non_reglee'
  if (!existsSync(dossierExterne)) return 'absente'
  try {
    // Même principe que la copie locale : nom provisoire puis renommage, contre une clé arrachée.
    const provisoire = join(dossierExterne, `${nom}.partiel`)
    copyFileSync(fichier, provisoire)
    renameSync(provisoire, join(dossierExterne, nom))
    supprimerSurplus(dossierExterne, maintenant)
    return 'faite'
  } catch {
    return 'echec'
  }
}

export interface OptionsSauvegarde {
  dossier: string
  motif: MotifSauvegarde
  dossierExterne: string | null
  maintenant?: Date
}

/**
 * Sauvegarde la base. Jamais à appeler dans une transaction (`backup` est asynchrone) : l'API de
 * SQLite copie une image cohérente, WAL compris, même si une vente s'écrit pendant la copie.
 * La copie est écrite sous un nom provisoire, vérifiée, puis renommée : une coupure de courant ne
 * laisse jamais un fichier à moitié écrit qui passerait pour une sauvegarde.
 */
export async function sauvegarder(db: Db, options: OptionsSauvegarde): Promise<ResultatSauvegarde> {
  const maintenant = options.maintenant ?? new Date()
  let nom = nomSauvegarde(maintenant, options.motif)
  let fichier = ''
  let provisoire = ''
  try {
    mkdirSync(options.dossier, { recursive: true })
    // Deux sauvegardes dans la même seconde (clôture puis bouton) : on ne remplace jamais la première.
    for (let i = 1; existsSync(join(options.dossier, nom)); i++) {
      nom = nomSauvegarde(new Date(maintenant.getTime() + i * 1000), options.motif)
    }
    fichier = join(options.dossier, nom)
    provisoire = `${fichier}.partiel`
    supprimerBase(provisoire)
    await backup(db, provisoire)
    rendreAutonome(provisoire)
    verifierFichier(provisoire)
    renameSync(provisoire, fichier)
  } catch (e) {
    if (provisoire) supprimerBase(provisoire)
    throw e instanceof ErreurMetier
      ? new ErreurMetier('La sauvegarde a échoué : la copie n’est pas lisible. Réessayez.')
      : new ErreurMetier('La sauvegarde a échoué : vérifiez la place libre sur le disque, puis réessayez.')
  }
  supprimerSurplus(options.dossier, maintenant)
  const lu = lireNom(nom)!
  return {
    sauvegarde: { nom, date: lu.date, motif: lu.motif, taille: statSync(fichier).size },
    copieExterne: copierSurCle(fichier, nom, options.dossierExterne, maintenant)
  }
}

/** Vrai si la dernière sauvegarde a plus de 48 heures, ou s'il n'y en a aucune. */
export function sauvegardeEnRetard(
  derniere: Sauvegarde | null,
  maintenant: Date,
  heures = RETARD_HEURES
): boolean {
  if (!derniere) return true
  return maintenant.getTime() - enDate(derniere.date).getTime() > heures * 3600 * 1000
}
