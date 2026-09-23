/**
 * Petits utilitaires d'accès aux données. ZONE PARTAGÉE.
 * Toujours des paramètres « ? » — jamais de concaténation de valeurs dans le SQL.
 */
import type { SQLInputValue } from 'node:sqlite'
import type { Db } from './connexion'

export type Param = SQLInputValue

export function une<T>(db: Db, sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined
}

export function toutes<T>(db: Db, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[]
}

export function executer(db: Db, sql: string, ...params: Param[]): { changements: number; id: number } {
  const r = db.prepare(sql).run(...params)
  return { changements: Number(r.changes), id: Number(r.lastInsertRowid) }
}

let compteurPointsDeSauvegarde = 0

/**
 * Exécute fn dans une transaction : tout est écrit, ou rien.
 * Imbrication autorisée (points de sauvegarde). fn doit être SYNCHRONE :
 * ne jamais imprimer, attendre un réseau ou un await à l'intérieur.
 */
export function avecTransaction<T>(db: Db, fn: () => T): T {
  const nom = `sp_${++compteurPointsDeSauvegarde}`
  db.exec(`SAVEPOINT ${nom}`)
  try {
    const resultat = fn()
    if (resultat instanceof Promise) {
      throw new Error('avecTransaction : la fonction doit être synchrone')
    }
    db.exec(`RELEASE ${nom}`)
    return resultat
  } catch (e) {
    db.exec(`ROLLBACK TO ${nom}`)
    db.exec(`RELEASE ${nom}`)
    throw e
  }
}
