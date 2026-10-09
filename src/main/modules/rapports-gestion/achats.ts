/**
 * Achats par fournisseur sur une période (B14). Propriétaire : Dev B.
 * Livré = réceptions de la période ; avoirs reçus = datés de la période ; réglé = règlements non
 * annulés de la période ; reste dû = solde d'aujourd'hui (même calcul que la page Fournisseurs).
 */
import type { AchatsFournisseurPeriode, PeriodeRapport, RapportAchats } from '@shared/ipc/rapports-gestion'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'
import { SOLDE_DU } from '../fournisseurs/service'
import { dansPeriode, lirePeriode } from './periode'

const SQL = `
  SELECT * FROM (
    SELECT f.id AS fournisseurId, f.nom AS fournisseur, f.actif,
           (SELECT COUNT(*) FROM receptions r
             WHERE r.fournisseur_id = f.id AND ${dansPeriode('r.date_reception')}) AS nbReceptions,
           COALESCE((SELECT SUM(r.total) FROM receptions r
             WHERE r.fournisseur_id = f.id AND ${dansPeriode('r.date_reception')}), 0) AS livre,
           COALESCE((SELECT SUM(a.montant_recu) FROM retours_fournisseur a
             WHERE a.fournisseur_id = f.id AND a.statut = 'recu' AND ${dansPeriode('a.date_avoir')}), 0) AS avoirsRecus,
           COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
             WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL AND ${dansPeriode('g.date_reglement')}), 0) AS regle,
           ${SOLDE_DU} AS resteDu
    FROM fournisseurs f
  )
  WHERE nbReceptions > 0 OR avoirsRecus <> 0 OR regle <> 0 OR resteDu <> 0
  ORDER BY livre DESC, fournisseur COLLATE NOCASE`

export function rapportAchats(db: Db, periode?: PeriodeRapport | null): RapportAchats {
  const { du, au } = lirePeriode(db, periode)
  // Les huit paramètres : la période pour chacune des quatre sous-requêtes datées.
  const periode8 = [du, au, du, au, du, au, du, au]
  const fournisseurs: AchatsFournisseurPeriode[] = toutes<
    Omit<AchatsFournisseurPeriode, 'actif'> & { actif: number }
  >(db, SQL, ...periode8).map((f) => ({ ...f, actif: f.actif === 1 }))
  const somme = (cle: 'livre' | 'avoirsRecus' | 'regle' | 'resteDu'): number =>
    fournisseurs.reduce((s, f) => s + f[cle], 0)
  return {
    du,
    au,
    fournisseurs,
    totalLivre: somme('livre'),
    totalAvoirsRecus: somme('avoirsRecus'),
    totalRegle: somme('regle'),
    totalResteDu: somme('resteDu')
  }
}
