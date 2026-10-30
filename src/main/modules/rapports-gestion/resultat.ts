/**
 * Résultat de la période (B14, REGLES_METIER § 11) : marge brute − dépenses. Propriétaire : Dev B.
 * La marge vient de `ventesPeriode` (Dev A, A14), sur la même période : la marge TTC, comme le dit
 * la règle (la marge HT reste une question pour la cliente, D-A6). Les pertes sont données pour
 * information, la règle ne les déduit pas.
 */
import type { PeriodeRapport, RapportResultat } from '@shared/ipc/rapports-gestion'
import type { Db } from '../../db/connexion'
import { ventesPeriode } from '../caisse/service-rapports'
import { totalDepenses } from '../depenses/service'
import { lirePeriode } from './periode'
import { rapportPertes } from './pertes'

export function rapportResultat(db: Db, periode?: PeriodeRapport | null): RapportResultat {
  const { du, au } = lirePeriode(db, periode)
  const depenses = totalDepenses(db, du, au)
  const ventes = ventesPeriode(db, { du, au })
  return {
    du,
    au,
    chiffreAffaires: ventes.chiffreAffaires,
    cout: ventes.cout,
    depenses,
    pertes: rapportPertes(db, { du, au }).total,
    marge: ventes.marge,
    resultat: ventes.marge - depenses
  }
}
