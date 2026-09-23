/**
 * LE point d'entrée UNIQUE pour toute variation de stock. ZONE PARTAGÉE.
 *
 * Règle absolue : aucun module n'écrit « INSERT INTO mouvements_stock » lui-même.
 * Tout passe par enregistrerMouvement() ou contrePasser(), qui contrôlent le sens
 * des quantités. Les quantités sont TOUJOURS en unités de base (boîtes, kg…).
 */
import type { TypeMouvement } from '@shared/types'
import type { Db } from '../db/connexion'
import { executer, une } from '../db/requetes'
import { ErreurMetier } from './erreurs'

/** Sens imposé par type : une vente ne peut pas ajouter du stock, une réception ne peut pas en retirer. */
const SENS: Record<TypeMouvement, 'entree' | 'sortie' | 'libre'> = {
  reception: 'entree',
  retour_client: 'entree',
  vente: 'sortie',
  retour_fournisseur: 'sortie',
  perte_peremption: 'sortie',
  casse: 'sortie',
  vol: 'sortie',
  ajustement_inventaire: 'libre',
  contre_passation: 'libre'
}

export interface NouveauMouvement {
  produitId: number
  lotId?: number | null
  type: TypeMouvement
  /** Positive = entrée, négative = sortie. En unités de base. */
  quantite: number
  /** Coût par unité de base au moment du mouvement (CUMP). */
  coutUnitaire: number
  documentType?: string | null
  documentId?: number | null
  mouvementOrigineId?: number | null
  motif?: string | null
  utilisateurId: number
}

export function enregistrerMouvement(db: Db, m: NouveauMouvement): number {
  if (!Number.isFinite(m.quantite) || m.quantite === 0) {
    throw new ErreurMetier('Quantité de mouvement invalide')
  }
  const sens = SENS[m.type]
  if (sens === 'entree' && m.quantite < 0) throw new ErreurMetier(`Un mouvement « ${m.type} » doit être positif`)
  if (sens === 'sortie' && m.quantite > 0) throw new ErreurMetier(`Un mouvement « ${m.type} » doit être négatif`)
  if (m.type === 'contre_passation' && !m.mouvementOrigineId) {
    throw new ErreurMetier('Une contre-passation doit référencer le mouvement annulé')
  }

  return executer(
    db,
    `INSERT INTO mouvements_stock
       (produit_id, lot_id, type, quantite, cout_unitaire, document_type, document_id,
        mouvement_origine_id, motif, utilisateur_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    m.produitId,
    m.lotId ?? null,
    m.type,
    m.quantite,
    m.coutUnitaire,
    m.documentType ?? null,
    m.documentId ?? null,
    m.mouvementOrigineId ?? null,
    m.motif ?? null,
    m.utilisateurId
  ).id
}

/** Annule un mouvement en créant son exact inverse, lié à l'original. */
export function contrePasser(db: Db, mouvementId: number, motif: string, utilisateurId: number): number {
  const origine = une<{
    produit_id: number
    lot_id: number | null
    quantite: number
    cout_unitaire: number
    document_type: string | null
    document_id: number | null
  }>(db, 'SELECT * FROM mouvements_stock WHERE id = ?', mouvementId)
  if (!origine) throw new ErreurMetier(`Mouvement ${mouvementId} introuvable`)

  const deja = une(db, 'SELECT id FROM mouvements_stock WHERE mouvement_origine_id = ?', mouvementId)
  if (deja) throw new ErreurMetier('Ce mouvement a déjà été contre-passé')

  return enregistrerMouvement(db, {
    produitId: origine.produit_id,
    lotId: origine.lot_id,
    type: 'contre_passation',
    quantite: -origine.quantite,
    coutUnitaire: origine.cout_unitaire,
    documentType: origine.document_type,
    documentId: origine.document_id,
    mouvementOrigineId: mouvementId,
    motif,
    utilisateurId
  })
}

/** Stock actuel d'un produit, en unités de base (somme des mouvements). */
export function stockProduit(db: Db, produitId: number): number {
  return une<{ s: number }>(db, 'SELECT COALESCE(SUM(quantite), 0) AS s FROM mouvements_stock WHERE produit_id = ?', produitId)!.s
}
