/**
 * Catalogue de vente. Propriétaire : Dev B. Consommé par Dev A via les canaux catalogue:*.
 * S'appuie sur la vue v_catalogue_vente (un scan → un conditionnement).
 */
import type { ArticleCatalogue, ProduitStock } from '@shared/types'
import type { Db } from '../../db/connexion'
import { toutes, une } from '../../db/requetes'

const COLONNES = `
  v.conditionnement_id AS conditionnementId, v.produit_id AS produitId, v.designation,
  v.conditionnement, v.quantite_base AS quantiteBase, v.prix_vente AS prixVente,
  v.taux_tva AS tauxTva, v.suivi_peremption AS suiviPeremption,
  v.cout_conditionnement AS coutConditionnement, v.code_barres AS codeBarres, v.code_plu AS codePlu,
  COALESCE(rayon.nom, cat.nom) AS categorie`

/** Rayon de l'article : la catégorie du produit, ou son parent si c'est une sous-catégorie. */
const JOINTURE_RAYON = `
  JOIN produits pr ON pr.id = v.produit_id
  LEFT JOIN categories cat ON cat.id = pr.categorie_id
  LEFT JOIN categories rayon ON rayon.id = cat.parent_id`

type LigneArticle = Omit<ArticleCatalogue, 'suiviPeremption'> & { suiviPeremption: number }

const versArticle = (l: LigneArticle): ArticleCatalogue => ({ ...l, suiviPeremption: l.suiviPeremption === 1 })

/** Scan de la douchette ou saisie d'un code PLU. */
export function rechercherParCode(db: Db, code: string): ArticleCatalogue | null {
  const c = code.trim()
  if (!c) return null
  const l = une<LigneArticle>(
    db,
    `SELECT ${COLONNES} FROM v_catalogue_vente v ${JOINTURE_RAYON} WHERE v.code_barres = ? OR v.code_plu = ? LIMIT 1`,
    c,
    c
  )
  return l ? versArticle(l) : null
}

/**
 * Recherche par nom. TODO Dev B (B2.3) : rendre la recherche insensible aux accents
 * (« tomate » doit trouver « Tomaté », « pate » doit trouver « pâte »).
 */
export function rechercherTexte(db: Db, texte: string, limite = 20): ArticleCatalogue[] {
  const t = texte.trim()
  if (t.length < 2) return []
  return toutes<LigneArticle>(
    db,
    `SELECT ${COLONNES} FROM v_catalogue_vente v ${JOINTURE_RAYON} WHERE v.designation LIKE ? ORDER BY v.designation LIMIT ?`,
    `%${t}%`,
    limite
  ).map(versArticle)
}

/** Boutons tactiles de la caisse, dans l'ordre défini par le gérant. */
export function grille(db: Db): ArticleCatalogue[] {
  return toutes<LigneArticle>(
    db,
    `SELECT ${COLONNES} FROM v_catalogue_vente v ${JOINTURE_RAYON}
     JOIN conditionnements c ON c.id = v.conditionnement_id
     WHERE c.bouton_tactile = 1
     ORDER BY c.ordre_bouton, v.designation`
  ).map(versArticle)
}

/**
 * Conditionnements vendables d'un produit, pour « changer le conditionnement » d'une ligne de
 * caisse : l'Unité d'abord, puis du plus petit au plus grand. Vide si le produit est inconnu ou
 * désactivé (la vue ne garde que les produits et conditionnements actifs).
 */
export function conditionnementsProduit(db: Db, produitId: number): ArticleCatalogue[] {
  return toutes<LigneArticle>(
    db,
    `SELECT ${COLONNES} FROM v_catalogue_vente v ${JOINTURE_RAYON}
     JOIN conditionnements c ON c.id = v.conditionnement_id
     WHERE v.produit_id = ?
     ORDER BY c.est_defaut DESC, v.quantite_base, v.conditionnement_id`,
    produitId
  ).map(versArticle)
}

export function produitsAvecStock(db: Db): ProduitStock[] {
  return toutes<Omit<ProduitStock, 'enAlerte'>>(
    db,
    `SELECT id, nom, unite, stock_actuel AS stockActuel, seuil_alerte AS seuilAlerte,
            valeur_stock AS valeurStock
     FROM v_stock_produits ORDER BY nom`
  ).map((p) => ({ ...p, enAlerte: p.stockActuel <= p.seuilAlerte }))
}
