/**
 * Export Excel des rapports de gestion (B15) : un rapport affiché → une demande d'export.
 * Propriétaire : Dev B. Logique pure, testée.
 */
import type { DemandeExport } from '@shared/ipc/exports'
import type {
  RapportAchats,
  RapportPertes,
  RapportResultat,
  RapportValeurStock
} from '@shared/ipc/rapports-gestion'
import { formaterDate } from '@shared/format'

function periode(r: { du: string; au: string }): { titre: string; suffixe: string } {
  return r.du === r.au
    ? { titre: `le ${formaterDate(r.du)}`, suffixe: r.du }
    : { titre: `du ${formaterDate(r.du)} au ${formaterDate(r.au)}`, suffixe: `${r.du}_${r.au}` }
}

export function exportPertes(r: RapportPertes): DemandeExport {
  const p = periode(r)
  const libelles = Object.fromEntries(r.causes.map((c) => [c.cause, c.libelle]))
  return {
    nomFichier: `Pertes_${p.suffixe}`,
    titre: `Pertes ${p.titre}`,
    feuilles: [
      {
        nom: 'Par cause',
        colonnes: [
          { titre: 'Cause', type: 'texte' },
          { titre: 'Valeur', type: 'montant' }
        ],
        lignes: [
          ...r.causes.map((c) => [c.libelle, c.valeur]),
          ['Total', r.total],
          ['Surplus d’inventaire (non déduits)', r.surplusInventaire]
        ]
      },
      {
        nom: 'Par produit',
        colonnes: [
          { titre: 'Cause', type: 'texte' },
          { titre: 'Produit', type: 'texte' },
          { titre: 'Quantité', type: 'nombre' },
          { titre: 'Unité', type: 'texte' },
          { titre: 'Valeur', type: 'montant' }
        ],
        lignes: r.produits.map((x) => [
          libelles[x.cause],
          x.produit,
          x.quantite,
          x.quantite === null ? null : x.unite,
          x.valeur
        ])
      }
    ]
  }
}

/** @param jour « AAAA-MM-JJ » du terminal : la valeur est celle d'aujourd'hui. */
export function exportValeurStock(r: RapportValeurStock, jour: string): DemandeExport {
  return {
    nomFichier: `Valeur_stock_${jour}`,
    titre: `Valeur du stock au ${formaterDate(jour)}, au coût moyen`,
    feuilles: [
      {
        nom: 'Par rayon',
        colonnes: [
          { titre: 'Rayon', type: 'texte' },
          { titre: 'Produits', type: 'nombre' },
          { titre: 'Valeur', type: 'montant' }
        ],
        lignes: [
          ...r.rayons.map((x) => [x.rayon, x.nbProduits, x.valeur]),
          ['Total', r.rayons.reduce((s, x) => s + x.nbProduits, 0), r.total]
        ]
      }
    ]
  }
}

export function exportAchats(r: RapportAchats): DemandeExport {
  const p = periode(r)
  return {
    nomFichier: `Achats_${p.suffixe}`,
    titre: `Achats par fournisseur ${p.titre} (reste dû à ce jour)`,
    feuilles: [
      {
        nom: 'Par fournisseur',
        colonnes: [
          { titre: 'Fournisseur', type: 'texte' },
          { titre: 'Actif', type: 'texte' },
          { titre: 'Réceptions', type: 'nombre' },
          { titre: 'Livré', type: 'montant' },
          { titre: 'Avoirs reçus', type: 'montant' },
          { titre: 'Réglé', type: 'montant' },
          // Négatif = avoir à valoir chez ce fournisseur.
          { titre: 'Reste dû (négatif = avoir à valoir)', type: 'montant' }
        ],
        lignes: [
          ...r.fournisseurs.map((f) => [
            f.fournisseur,
            f.actif ? 'Oui' : 'Non',
            f.nbReceptions,
            f.livre,
            f.avoirsRecus,
            f.regle,
            f.resteDu
          ]),
          ['Total', null, null, r.totalLivre, r.totalAvoirsRecus, r.totalRegle, r.totalResteDu]
        ]
      }
    ]
  }
}

export const EN_ATTENTE_VENTES = 'Disponible avec les rapports de ventes'

export function exportResultat(r: RapportResultat): DemandeExport {
  const p = periode(r)
  return {
    nomFichier: `Resultat_${p.suffixe}`,
    titre: `Résultat ${p.titre}`,
    feuilles: [
      {
        nom: 'Résultat',
        colonnes: [
          { titre: 'Poste', type: 'texte' },
          { titre: 'Montant', type: 'montant' }
        ],
        lignes: [
          ['Marge brute des ventes', r.marge ?? EN_ATTENTE_VENTES],
          ['Dépenses', -r.depenses],
          ['Résultat', r.resultat ?? EN_ATTENTE_VENTES],
          ['Pertes de la période (pour information)', r.pertes]
        ]
      }
    ]
  }
}
