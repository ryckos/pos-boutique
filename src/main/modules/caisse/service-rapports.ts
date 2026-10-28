/**
 * Propriétaire : Dev A. Ventes d'une période (A14, REGLES_METIER § 11).
 *
 * Le chiffre d'affaires part de `ventes.total_ttc` et non de la somme des lignes : la remise sur le
 * ticket n'est pas dans `total_ligne` (elle l'est dans les lignes d'un retour, au prorata).
 * Un retour rend son coût : la boîte détruite est déjà une perte (casse) dans les rapports de Dev B,
 * la retirer aussi de la marge la compterait deux fois.
 *
 * Aucun contrôle de droit ici : `ipc.ts` exige le gérant, et Dev B appelle `ventesPeriode` depuis le
 * rapport de résultat (B14).
 */
import type { PeriodeRapport } from '@shared/ipc/rapports-gestion'
import type { VentesPeriode } from '@shared/ipc/caisse'
import type { Db } from '../../db/connexion'
import { une } from '../../db/requetes'
import { dansPeriode, lirePeriode } from '../rapports-gestion/periode'

export function ventesPeriode(db: Db, periode?: PeriodeRapport | null): VentesPeriode {
  const { du, au } = lirePeriode(db, periode)
  const totaux = une<{
    nbTickets: number
    nbRetours: number
    ventesTtc: number
    retoursTtc: number
    ht: number
    tva: number
  }>(
    db,
    `SELECT COALESCE(SUM(type = 'ticket'), 0) AS nbTickets,
            COALESCE(SUM(type = 'retour'), 0) AS nbRetours,
            COALESCE(SUM(CASE WHEN type = 'ticket' THEN total_ttc END), 0) AS ventesTtc,
            COALESCE(SUM(CASE WHEN type = 'retour' THEN total_ttc END), 0) AS retoursTtc,
            COALESCE(SUM(total_ht), 0) AS ht,
            COALESCE(SUM(total_tva), 0) AS tva
       FROM ventes
      WHERE statut = 'terminee' AND type IN ('ticket', 'retour') AND ${dansPeriode('horodatage')}`,
    du,
    au
  )!
  // Coût à virgule (CUMP) : un seul arrondi, sur le total.
  const { cout } = une<{ cout: number }>(
    db,
    `SELECT COALESCE(SUM(CASE WHEN v.type = 'retour' THEN -1 ELSE 1 END * l.quantite * l.cout_unitaire), 0) AS cout
       FROM lignes_vente l
       JOIN ventes v ON v.id = l.vente_id
      WHERE v.statut = 'terminee' AND v.type IN ('ticket', 'retour') AND ${dansPeriode('v.horodatage')}`,
    du,
    au
  )!
  const coutArrondi = Math.round(cout)
  const chiffreAffaires = totaux.ventesTtc + totaux.retoursTtc
  return {
    du,
    au,
    nbTickets: totaux.nbTickets,
    nbRetours: totaux.nbRetours,
    ventesTtc: totaux.ventesTtc,
    retoursTtc: totaux.retoursTtc,
    chiffreAffaires,
    chiffreAffairesHt: totaux.ht,
    tva: totaux.tva,
    cout: coutArrondi,
    marge: chiffreAffaires - coutArrondi,
    margeHt: totaux.ht - coutArrondi
  }
}
