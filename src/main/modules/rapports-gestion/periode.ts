/** Période d'un rapport de gestion (B14). Propriétaire : Dev B. */
import type { PeriodeRapport } from '@shared/ipc/rapports-gestion'
import { debutDuMois } from '@shared/rapports-gestion'
import type { Db } from '../../db/connexion'
import { une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

function lireDate(valeur: string | null | undefined, nom: string): string | null {
  const v = valeur?.trim()
  if (!v) return null
  const valide = DATE_ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  if (!valide) throw new ErreurMetier(`La date de ${nom} est invalide : choisissez-la dans le calendrier`)
  return v
}

/** Mois en cours par défaut ; jamais de fin dans le futur, un rapport ne prévoit rien. */
export function lirePeriode(db: Db, p: PeriodeRapport | null | undefined): { du: string; au: string } {
  const jour = une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
  const au = lireDate(p?.au, 'fin') ?? jour
  const du = lireDate(p?.du, 'début') ?? debutDuMois(au)
  if (au > jour) throw new ErreurMetier('La fin de la période ne peut pas être dans le futur')
  if (du > au) throw new ErreurMetier('Le début de la période doit précéder sa fin')
  return { du, au }
}

/**
 * Condition SQL sur un horodatage « AAAA-MM-JJ HH:MM:SS » (ou une date seule) compris dans la période :
 * deux paramètres, `du` puis `au`.
 */
export function dansPeriode(colonne: string): string {
  return `${colonne} >= ? AND ${colonne} < date(?, '+1 day')`
}
