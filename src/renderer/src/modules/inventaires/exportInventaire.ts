/**
 * Export Excel d'un inventaire (B15) : les comptages, et la démarque s'il est validé.
 * Propriétaire : Dev B. Logique pure, testée.
 */
import type { DemandeExport, FeuilleExport } from '@shared/ipc/exports'
import type { InventaireDetail } from '@shared/ipc/inventaires'
import { LIBELLES_MOTIF_ECART, LIBELLES_STATUT_INVENTAIRE } from '@shared/inventaires'
import { formaterDate, formaterQuantite } from '@shared/format'

export function exportInventaire(inv: InventaireDetail): DemandeExport {
  const comptes = inv.produits.filter((p) => p.ligne !== null)
  const feuilles: FeuilleExport[] = [
    {
      nom: 'Comptages',
      colonnes: [
        { titre: 'Produit', type: 'texte' },
        { titre: 'Rayon', type: 'texte' },
        { titre: 'Unité', type: 'texte' },
        { titre: 'Comptage', type: 'texte' },
        { titre: 'Théorique', type: 'nombre' },
        { titre: 'Compté', type: 'nombre' },
        { titre: 'Écart', type: 'nombre' },
        { titre: 'Motif', type: 'texte' },
        { titre: 'Commentaire', type: 'texte' },
        { titre: 'Compté le', type: 'date' }
      ],
      lignes: comptes.map((p) => {
        const l = p.ligne!
        return [
          p.nom,
          p.rayon ?? 'Non classé',
          p.unite,
          l.detail.map((d) => `${formaterQuantite(d.nombre)} ${d.conditionnement}`).join(' + ') ||
            'Rien en rayon',
          l.quantiteTheorique,
          l.quantiteComptee,
          l.ecart,
          l.motif ? LIBELLES_MOTIF_ECART[l.motif] : null,
          l.commentaire,
          l.compteLe
        ]
      })
    }
  ]
  if (inv.rapport) {
    const r = inv.rapport
    feuilles.push({
      nom: 'Démarque',
      colonnes: [
        { titre: 'Produit', type: 'texte' },
        { titre: 'Écart', type: 'nombre' },
        { titre: 'Unité', type: 'texte' },
        { titre: 'Motif', type: 'texte' },
        { titre: 'Coût moyen', type: 'nombre' },
        { titre: 'Valeur', type: 'montant' }
      ],
      lignes: [
        ...r.lignes.map((l) => [
          l.produit,
          l.ecart,
          l.unite,
          l.motif ? LIBELLES_MOTIF_ECART[l.motif] : null,
          Math.round(l.cump * 10) / 10,
          l.valeur
        ]),
        ['Manquants', null, null, null, null, -r.manquants],
        ['Surplus', null, null, null, null, r.surplus],
        ['Net', null, null, null, null, r.net]
      ]
    })
  }
  const etat = [
    LIBELLES_STATUT_INVENTAIRE[inv.statut].toLowerCase(),
    inv.dateValidation ? `le ${formaterDate(inv.dateValidation)}` : null
  ]
    .filter(Boolean)
    .join(' ')
  return {
    nomFichier: `Inventaire_${inv.numero}`,
    titre: `Inventaire ${inv.numero}, ${inv.rayon ?? 'tout le magasin'}, ouvert le ${formaterDate(inv.dateDebut)} (${etat})`,
    feuilles
  }
}
