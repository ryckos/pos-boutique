/** Bases de test en mémoire : rapides, isolées, jetables. */
import { ouvrirBase, type Db } from '../src/main/db/connexion'
import { migrer } from '../src/main/db/migrations'
import { semerDonneesDemo } from '../src/main/db/seed'

/** Base vierge avec toutes les migrations appliquées. */
export function baseDeTest(): Db {
  const db = ouvrirBase(':memory:')
  migrer(db)
  return db
}

/** Base avec les données de démonstration (utilisateurs, catalogue, stock). */
export function baseAvecDemo(): Db {
  const db = baseDeTest()
  semerDonneesDemo(db)
  return db
}
