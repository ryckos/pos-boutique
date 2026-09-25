/**
 * Connexion SQLite (module node:sqlite intégré à Electron — aucune compilation native).
 * ZONE PARTAGÉE.
 */
import { DatabaseSync } from 'node:sqlite'
import { normaliserRecherche } from '@shared/texte'

export type Db = DatabaseSync

let instance: Db | null = null

/** Ouvre une base et applique les réglages OBLIGATOIRES (par connexion, pas par base). */
export function ouvrirBase(chemin: string): Db {
  const db = new DatabaseSync(chemin)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  if (chemin !== ':memory:') db.exec('PRAGMA journal_mode = WAL') // résistance aux coupures
  // Recherche insensible aux accents : une fonction calculée plutôt qu'une colonne normalisée,
  // qu'il faudrait tenir à jour à chaque écriture (le catalogue reste petit).
  db.function('sans_accents', { deterministic: true }, (t) =>
    t === null ? null : normaliserRecherche(String(t))
  )
  return db
}

export function initialiserBase(chemin: string): Db {
  instance = ouvrirBase(chemin)
  return instance
}

/** La base de l'application. Les services la reçoivent en paramètre (testabilité). */
export function base(): Db {
  if (!instance) throw new Error('Base de données non initialisée')
  return instance
}
