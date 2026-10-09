/**
 * Résultat de la période (B14, REGLES_METIER § 11) : marge brute − dépenses. Propriétaire : Dev B.
 * La marge viendra de `caisse:ventesPeriode` (Dev A, A14, fin S16) : d'ici là elle vaut null et
 * l'écran l'annonce. Les pertes sont données pour information, la règle ne les déduit pas.
 */
import type { PeriodeRapport, RapportResultat } from '@shared/ipc/rapports-gestion'
import type { Db } from '../../db/connexion'
import { totalDepenses } from '../depenses/service'
import { lirePeriode } from './periode'
import { rapportPertes } from './pertes'

export function rapportResultat(db: Db, periode?: PeriodeRapport | null): RapportResultat {
  const { du, au } = lirePeriode(db, periode)
  const depenses = totalDepenses(db, du, au)
  const marge: number | null = null
  return {
    du,
    au,
    depenses,
    pertes: rapportPertes(db, { du, au }).total,
    marge,
    resultat: marge === null ? null : marge - depenses
  }
}
