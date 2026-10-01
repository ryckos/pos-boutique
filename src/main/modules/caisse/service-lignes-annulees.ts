/**
 * Propriétaire : Dev A.
 *
 * Journal des lignes retirées du ticket avant encaissement (règle 6.6, A5). L'écran client montre
 * le ticket en permanence : une ligne supprimée ou un ticket abandonné l'a donc été sous les yeux
 * du client, c'est une annulation à tracer. Le panier ne vit que dans l'écran ; désignation et prix
 * sont relus en base, jamais pris à l'écran.
 */
import type { LigneAnnulee } from '@shared/ipc/caisse'
import type { Db } from '../../db/connexion'
import { avecTransaction, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'

export function journaliserLignesAnnulees(
  db: Db,
  utilisateurId: number,
  lignes: LigneAnnulee[],
  abandon: boolean
): void {
  if (!Array.isArray(lignes) || lignes.length === 0) return
  avecTransaction(db, () => {
    for (const { conditionnementId, quantite } of lignes) {
      if (!Number.isInteger(quantite) || quantite < 1) throw new ErreurMetier('Quantité de ligne invalide.')
      // Sans filtre « actif » : un article désactivé entre-temps doit quand même être tracé.
      const c = une<{ designation: string; prixVente: number }>(
        db,
        `SELECT p.nom || CASE WHEN c.quantite_base > 1 THEN ' — ' || c.nom ELSE '' END AS designation,
                c.prix_vente AS prixVente
         FROM conditionnements c JOIN produits p ON p.id = c.produit_id
         WHERE c.id = ?`,
        conditionnementId
      )
      if (!c) throw new ErreurMetier('Article introuvable dans le catalogue.')
      journaliser(db, {
        utilisateurId,
        action: 'annulation_ligne',
        entite: 'conditionnements',
        entiteId: conditionnementId,
        apres: { designation: c.designation, quantite, montant: quantite * c.prixVente, abandon }
      })
    }
  })
}
