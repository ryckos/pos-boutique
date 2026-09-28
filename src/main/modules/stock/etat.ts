/**
 * Écran stock (tâche B4) : stock, valeur, alertes et produits dormants. Propriétaire : Dev B.
 * Règles (REGLES_METIER § 3.3) : rupture si stock ≤ 0, stock bas si stock ≤ seuil ; dormant si le
 * produit a du stock et aucune vente terminée depuis `dormant_jours` jours — à défaut de vente, on
 * compte depuis sa première entrée en stock.
 */
import type { EtatStock, LigneStock, NiveauStock } from '@shared/ipc/stock'
import { repartirStock, type ConditionnementRepartition } from '@shared/stock'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'
import { lireParametres } from '../parametres/service'

interface ProduitLu {
  produitId: number
  nom: string
  rayon: string | null
  unite: string
  stock: number
  seuil: number
  cump: number
  valeur: number
  derniereVente: string | null
  dormant: number
}

/**
 * Une seule requête pour toute la liste (le terminal n'a que 4 Go) : le stock vient de
 * `v_stock_produits`, la dernière vente et la première entrée de sous-requêtes indexées par produit.
 * Les retours et proformas ne sont pas des ventes ; une vente annulée non plus.
 */
const SQL_PRODUITS = `
  WITH base AS (
    SELECT s.id AS produitId, s.nom, COALESCE(parent.nom, c.nom) AS rayon, s.unite,
           s.stock_actuel AS stock, s.seuil_alerte AS seuil, s.cout_moyen_pondere AS cump,
           s.valeur_stock AS valeur, p.cree_le AS creeLe,
           (SELECT MAX(v.horodatage) FROM lignes_vente l JOIN ventes v ON v.id = l.vente_id
             WHERE l.produit_id = s.id AND v.statut = 'terminee' AND v.type IN ('ticket', 'facture'))
             AS derniereVente,
           (SELECT MIN(m.horodatage) FROM mouvements_stock m WHERE m.produit_id = s.id AND m.quantite > 0)
             AS premiereEntree
    FROM v_stock_produits s
    JOIN produits p ON p.id = s.id
    LEFT JOIN categories c ON c.id = p.categorie_id
    LEFT JOIN categories parent ON parent.id = c.parent_id
  )
  SELECT produitId, nom, rayon, unite, stock, seuil, cump, valeur, derniereVente,
         stock > 0 AND COALESCE(derniereVente, premiereEntree, creeLe) < datetime(?, ?) AS dormant
  FROM base
  ORDER BY nom COLLATE NOCASE`

function niveauDe(stock: number, seuil: number): NiveauStock {
  if (stock <= 0) return 'rupture'
  return stock <= seuil ? 'stock_bas' : 'normal'
}

/**
 * @param maintenant date locale « AAAA-MM-JJ HH:MM:SS » du calcul des dormants (les tests la fixent).
 */
export function etatStock(db: Db, maintenant?: string): EtatStock {
  const { dormantJours } = lireParametres(db)
  const produits = toutes<ProduitLu>(
    db,
    SQL_PRODUITS,
    maintenant ?? toutes<{ n: string }>(db, "SELECT datetime('now','localtime') AS n")[0].n,
    `-${dormantJours} days`
  )

  const conditionnements = new Map<number, ConditionnementRepartition[]>()
  for (const c of toutes<ConditionnementRepartition & { produitId: number }>(
    db,
    `SELECT produit_id AS produitId, nom, quantite_base AS quantiteBase
     FROM conditionnements WHERE actif = 1 ORDER BY id`
  )) {
    const liste = conditionnements.get(c.produitId) ?? []
    liste.push({ nom: c.nom, quantiteBase: c.quantiteBase })
    conditionnements.set(c.produitId, liste)
  }

  const lignes: LigneStock[] = produits.map((p) => ({
    ...p,
    niveau: niveauDe(p.stock, p.seuil),
    repartition: repartirStock(p.stock, conditionnements.get(p.produitId) ?? []),
    dormant: p.dormant === 1
  }))

  return {
    lignes,
    valeurTotale: lignes.reduce((s, l) => s + l.valeur, 0),
    nbRuptures: lignes.filter((l) => l.niveau === 'rupture').length,
    nbStockBas: lignes.filter((l) => l.niveau === 'stock_bas').length,
    nbDormants: lignes.filter((l) => l.dormant).length,
    dormantJours
  }
}
