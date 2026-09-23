/**
 * Moteur de migrations. ZONE PARTAGÉE.
 *
 * RÈGLES (voir README) :
 *  1. Un changement de structure = un NOUVEAU fichier dans ./migrations/
 *  2. Nom : AAAAMMJJ_HHMM_description.sql (l'ordre alphabétique = l'ordre d'application)
 *  3. On ne modifie JAMAIS une migration déjà fusionnée dans main.
 *  4. Pas de PRAGMA dans une migration (chaque migration tourne dans une transaction).
 */
import type { Db } from './connexion'
import { avecTransaction, executer, toutes } from './requetes'

// Vite embarque le contenu des fichiers .sql dans le code au moment du build.
const fichiers = import.meta.glob('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Applique les migrations manquantes. Renvoie la liste de celles appliquées. */
export function migrer(db: Db): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nom TEXT PRIMARY KEY,
    appliquee_le TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`)

  const deja = new Set(toutes<{ nom: string }>(db, 'SELECT nom FROM schema_migrations').map((r) => r.nom))
  const appliquees: string[] = []

  for (const chemin of Object.keys(fichiers).sort()) {
    const nom = chemin.split('/').pop() as string
    if (deja.has(nom)) continue
    avecTransaction(db, () => {
      db.exec(fichiers[chemin])
      executer(db, 'INSERT INTO schema_migrations (nom) VALUES (?)', nom)
    })
    appliquees.push(nom)
  }
  return appliquees
}
