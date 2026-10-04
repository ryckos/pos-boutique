/**
 * Tableau des péremptions et retrait d'un lot (tâche B9). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 5.1) : lots en stock qui périment sous `peremption_seuil_jours` jours,
 * périmés compris ; rouge à 3 jours ou moins ; valeur en jeu = restant × prix d'achat du lot.
 * Retirer = mouvement `perte_peremption` sur le lot, chiffré au CUMP comme tout mouvement.
 */
import type { LotPerimable, TableauPeremptions } from '@shared/ipc/stock'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import type { Db } from '../../db/connexion'
import { avecTransaction, toutes, une } from '../../db/requetes'
import { enregistrerMouvement } from '../../core/mouvements'
import { ErreurMetier } from '../../core/erreurs'
import { lireParametres } from '../parametres/service'

/** À 3 jours ou moins, la ligne passe au rouge (UI_UX § 5.8). */
const JOURS_URGENTS = 3

/** En deçà, un reste au poids n'est qu'une erreur d'arrondi des nombres à virgule. */
const EPSILON = 1e-9

export function tableauPeremptions(db: Db): TableauPeremptions {
  const horizonJours = lireParametres(db).peremptionSeuilJours
  // v_peremptions ne garde que les lots en stock datés ; on n'y lit que l'horizon voulu.
  const lots = toutes<Omit<LotPerimable, 'urgent'>>(
    db,
    `SELECT v.id AS lotId, v.produit_id AS produitId, v.produit, v.numero_lot AS numeroLot,
            v.date_peremption AS datePeremption, v.jours_restants AS joursRestants,
            v.quantite_restante AS restant, p.unite, v.prix_achat_unitaire AS prixAchat,
            v.valeur_en_jeu AS valeur
     FROM v_peremptions v
     JOIN produits p ON p.id = v.produit_id
     WHERE v.jours_restants <= ?
     ORDER BY v.date_peremption, v.id`,
    horizonJours
  ).map((l) => ({ ...l, urgent: l.joursRestants <= JOURS_URGENTS }))

  return { horizonJours, lots, valeurTotale: lots.reduce((s, l) => s + l.valeur, 0) }
}

export function retirerLot(
  db: Db,
  utilisateurId: number,
  requete: { lotId: number; quantite: number; commentaire?: string | null }
): { restant: number } {
  const { lotId, quantite } = requete
  return avecTransaction(db, () => {
    // Le restant et le CUMP sont relus en base : l'écran a pu afficher un état dépassé.
    const lot = une<{ produitId: number; restant: number; unite: string; cump: number; produit: string }>(
      db,
      `SELECT v.produit_id AS produitId, v.quantite_restante AS restant, p.unite,
              p.cout_moyen_pondere AS cump, p.nom AS produit
       FROM v_stock_lots v
       JOIN produits p ON p.id = v.produit_id
       WHERE v.id = ?`,
      lotId
    )
    if (!lot) throw new ErreurMetier('Ce lot n’existe pas')
    if (lot.restant <= EPSILON) throw new ErreurMetier(`Ce lot de « ${lot.produit} » n’a plus de stock`)
    if (!Number.isFinite(quantite) || quantite <= 0) {
      throw new ErreurMetier('Indiquez la quantité à retirer')
    }
    if (!UNITES_FRACTIONNAIRES.includes(lot.unite) && !Number.isInteger(quantite)) {
      throw new ErreurMetier('La quantité à retirer doit être un nombre entier')
    }
    if (quantite > lot.restant + EPSILON) {
      throw new ErreurMetier(`Il ne reste que ${lot.restant} dans ce lot : retirez au plus cette quantité`)
    }

    const commentaire = requete.commentaire?.trim()
    enregistrerMouvement(db, {
      produitId: lot.produitId,
      lotId,
      type: 'perte_peremption',
      quantite: -quantite,
      coutUnitaire: lot.cump,
      motif: commentaire ? `Périmé : ${commentaire}` : 'Périmé',
      utilisateurId
    })
    const restant = lot.restant - quantite
    return { restant: Math.abs(restant) <= EPSILON ? 0 : restant }
  })
}
