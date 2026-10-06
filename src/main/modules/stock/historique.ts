/**
 * Historique d'un produit (tâche B4) : « pourquoi il reste 41 boîtes ». Propriétaire : Dev B.
 * Règle (REGLES_METIER § 3.3) : sur une période, 30 derniers jours par défaut ; on part du stock au
 * début de la période, chaque mouvement du plus ancien au plus récent avec le stock après lui, et
 * on finit sur le stock de fin (le stock actuel si la période va jusqu'à aujourd'hui).
 */
import type { HistoriqueProduit, MouvementHistorique } from '@shared/ipc/stock'
import { repartirStock, type ConditionnementRepartition } from '@shared/stock'
import type { Db } from '../../db/connexion'
import { toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { stockProduit } from '../../core/mouvements'

export const JOURS_HISTORIQUE_PAR_DEFAUT = 30

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Document lisible de chaque mouvement. Une annulation garde le document du mouvement annulé
 * (`contrePasser` le recopie) : on voit ainsi quel ticket ou quel stock initial elle corrige.
 */
const SQL_MOUVEMENTS = `
  SELECT m.id, m.horodatage, m.type, m.quantite, m.motif, u.nom AS utilisateur,
         CASE m.document_type
           WHEN 'vente' THEN 'Ticket ' || v.numero_ticket
           WHEN 'reception' THEN 'Réception ' || r.numero
           WHEN 'inventaire' THEN 'Inventaire ' || i.numero
           WHEN 'stock_initial' THEN 'Stock initial'
           WHEN 'demo' THEN 'Stock de démonstration'
           WHEN 'sortie' THEN 'Sortie de stock'
           WHEN 'retour_fournisseur' THEN 'Retour à ' || f.nom
         END AS document,
         CASE WHEN l.id IS NOT NULL THEN COALESCE(
           l.numero_lot,
           'périme le ' || strftime('%d/%m/%Y', l.date_peremption)
         ) END AS lot
  FROM mouvements_stock m
  JOIN utilisateurs u ON u.id = m.utilisateur_id
  LEFT JOIN ventes v ON m.document_type = 'vente' AND v.id = m.document_id
  LEFT JOIN receptions r ON m.document_type = 'reception' AND r.id = m.document_id
  LEFT JOIN inventaires i ON m.document_type = 'inventaire' AND i.id = m.document_id
  LEFT JOIN retours_fournisseur rf ON m.document_type = 'retour_fournisseur' AND rf.id = m.document_id
  LEFT JOIN fournisseurs f ON f.id = rf.fournisseur_id
  LEFT JOIN lots l ON l.id = m.lot_id
  WHERE m.produit_id = ? AND m.horodatage >= ? AND m.horodatage < date(?, '+1 day')
  ORDER BY m.id`

export function lireDate(valeur: string | null | undefined, nom: string): string | null {
  const v = valeur?.trim()
  if (!v) return null
  if (!FORMAT_DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ErreurMetier(`La date de ${nom} est invalide : choisissez-la dans le calendrier`)
  }
  return v
}

export function historiqueProduit(
  db: Db,
  produitId: number,
  periode: { du?: string | null; au?: string | null } = {}
): HistoriqueProduit {
  const produit = une<{ id: number; nom: string }>(db, 'SELECT id, nom FROM produits WHERE id = ?', produitId)
  if (!produit) throw new ErreurMetier('Produit introuvable : rechargez la liste')

  const aujourdhui = une<{ d: string }>(db, "SELECT date('now','localtime') AS d")!.d
  const au = lireDate(periode.au, 'fin') ?? aujourdhui
  const du =
    lireDate(periode.du, 'début') ??
    une<{ d: string }>(db, 'SELECT date(?, ?) AS d', au, `-${JOURS_HISTORIQUE_PAR_DEFAUT} days`)!.d
  if (du > au) throw new ErreurMetier('La date de début doit précéder la date de fin')

  const stockDebut = une<{ s: number }>(
    db,
    'SELECT COALESCE(SUM(quantite), 0) AS s FROM mouvements_stock WHERE produit_id = ? AND horodatage < ?',
    produitId,
    du
  )!.s

  let stock = stockDebut
  const mouvements: MouvementHistorique[] = toutes<Omit<MouvementHistorique, 'stockApres'>>(
    db,
    SQL_MOUVEMENTS,
    produitId,
    du,
    au
  ).map((m) => {
    stock = arrondir(stock + m.quantite)
    return { ...m, stockApres: stock }
  })

  const stockActuel = stockProduit(db, produitId)
  const conditionnements = toutes<ConditionnementRepartition>(
    db,
    'SELECT nom, quantite_base AS quantiteBase FROM conditionnements WHERE produit_id = ? AND actif = 1 ORDER BY id',
    produitId
  )

  return {
    produitId,
    nom: produit.nom,
    stockActuel,
    repartition: repartirStock(stockActuel, conditionnements),
    du,
    au,
    stockDebut,
    mouvements,
    stockFin: stock
  }
}

/** Produits au poids : pas de 11,999999 dans la colonne du stock. */
const arrondir = (n: number): number => Math.round(n * 1000) / 1000
