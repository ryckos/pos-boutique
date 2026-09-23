/** Journal d'audit des actions sensibles (immuable, protégé par triggers). ZONE PARTAGÉE. */
import type { Db } from '../db/connexion'
import { executer } from '../db/requetes'

export interface EntreeAudit {
  utilisateurId: number
  /** Ex : 'connexion', 'modification_prix', 'remise', 'annulation_ticket', 'ouverture_tiroir' */
  action: string
  entite?: string
  entiteId?: number
  avant?: unknown
  apres?: unknown
}

export function journaliser(db: Db, e: EntreeAudit): void {
  executer(
    db,
    `INSERT INTO journal_audit (utilisateur_id, action, entite, entite_id, ancienne_valeur, nouvelle_valeur)
     VALUES (?, ?, ?, ?, ?, ?)`,
    e.utilisateurId,
    e.action,
    e.entite ?? null,
    e.entiteId ?? null,
    e.avant === undefined ? null : JSON.stringify(e.avant),
    e.apres === undefined ? null : JSON.stringify(e.apres)
  )
}
