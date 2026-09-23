/**
 * Numéros de documents séquentiels et sans trou : T-2026-000001, RC-2026-000001…
 * ZONE PARTAGÉE. Préfixes réservés :
 *   T (ticket, Dev A) · F (facture, Dev A) · RC (réception, Dev B) · CA (commande achat, Dev B)
 *   INV (inventaire, Dev B) · DEP (dépense, Dev B)
 */
import type { Db } from '../db/connexion'
import { avecTransaction, executer, une } from '../db/requetes'

export function prochainNumero(db: Db, prefixe: string, date = new Date()): string {
  const cle = `${prefixe}-${date.getFullYear()}`
  return avecTransaction(db, () => {
    executer(
      db,
      `INSERT INTO sequences (prefixe, dernier) VALUES (?, 1)
       ON CONFLICT(prefixe) DO UPDATE SET dernier = dernier + 1`,
      cle
    )
    const { dernier } = une<{ dernier: number }>(db, 'SELECT dernier FROM sequences WHERE prefixe = ?', cle)!
    return `${cle}-${String(dernier).padStart(6, '0')}`
  })
}
