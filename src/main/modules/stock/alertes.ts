/**
 * Alertes de l'écran d'accueil (rendez-vous A15 de Dev A). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 3.3 et § 5.1) : rupture si stock ≤ 0, stock bas si stock ≤ seuil ;
 * péremptions = le tableau des péremptions résumé, pour que l'accueil et la page disent la même chose.
 * Lecture légère : ni répartition en conditionnements ni dormants, contrairement à l'écran stock.
 */
import { NB_ALERTES_ACCUEIL, type AlertesAccueil, type ProduitEnAlerte } from '@shared/ipc/stock'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'
import { tableauPeremptions } from './peremptions'

export function alertesAccueil(db: Db): AlertesAccueil {
  // v_alertes_stock ne garde que les produits actifs sous leur seuil (rupture comprise).
  const enAlerte = toutes<ProduitEnAlerte>(
    db,
    `SELECT a.id AS produitId, a.nom, a.unite, a.stock_actuel AS stock, a.seuil_alerte AS seuil,
            a.niveau
     FROM v_alertes_stock a
     ORDER BY a.niveau = 'rupture' DESC, a.stock_actuel, a.nom, a.id`
  )
  const nbRuptures = enAlerte.filter((p) => p.niveau === 'rupture').length

  const t = tableauPeremptions(db)
  return {
    stock: {
      nbRuptures,
      nbStockBas: enAlerte.length - nbRuptures,
      produits: enAlerte.slice(0, NB_ALERTES_ACCUEIL)
    },
    peremptions: {
      horizonJours: t.horizonJours,
      nbPerimes: t.lots.filter((l) => l.joursRestants < 0).length,
      nbUrgents: t.lots.filter((l) => l.urgent && l.joursRestants >= 0).length,
      nbProches: t.lots.filter((l) => !l.urgent).length,
      valeurEnJeu: t.valeurTotale,
      lots: t.lots.slice(0, NB_ALERTES_ACCUEIL)
    }
  }
}
