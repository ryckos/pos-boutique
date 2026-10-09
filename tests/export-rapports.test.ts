import { describe, expect, it } from 'vitest'
import {
  EN_ATTENTE_VENTES,
  exportAchats,
  exportPertes,
  exportResultat,
  exportValeurStock
} from '../src/renderer/src/modules/rapports-gestion/exportRapports'
import { classeurExcel } from '../src/main/modules/exports/service'

describe('Export des rapports de gestion', () => {
  it('pertes : deux feuilles, total et surplus sous les causes, avoir sans quantité ni unité', () => {
    const d = exportPertes({
      du: '2026-10-01',
      au: '2026-10-09',
      causes: [
        { cause: 'casse', libelle: 'Casse', valeur: 500 },
        { cause: 'avoir_fournisseur', libelle: 'Avoirs fournisseur non obtenus', valeur: 500 }
      ],
      produits: [
        { cause: 'casse', produitId: 3, produit: 'Tomate', unite: 'boîte', quantite: 2, valeur: 500 },
        {
          cause: 'avoir_fournisseur',
          produitId: 3,
          produit: 'Tomate',
          unite: 'boîte',
          quantite: null,
          valeur: 500
        }
      ],
      total: 1000,
      surplusInventaire: 120
    })
    expect(d.nomFichier).toBe('Pertes_2026-10-01_2026-10-09')
    expect(d.titre).toBe('Pertes du 01/10/2026 au 09/10/2026')
    expect(d.feuilles.map((f) => f.nom)).toEqual(['Par cause', 'Par produit'])
    expect(d.feuilles[0].lignes.slice(-2)).toEqual([
      ['Total', 1000],
      ['Surplus d’inventaire (non déduits)', 120]
    ])
    expect(d.feuilles[1].lignes[1]).toEqual(['Avoirs fournisseur non obtenus', 'Tomate', null, null, 500])
    // La demande produit un vrai classeur.
    expect(() => classeurExcel(d, 'Kossi', 'x')).not.toThrow()
  })

  it('valeur du stock : au jour donné, ligne Total', () => {
    const d = exportValeurStock(
      {
        total: 30_000,
        rayons: [
          { rayon: 'Alimentation', nbProduits: 4, valeur: 25_500 },
          { rayon: 'Entretien', nbProduits: 1, valeur: 4_500 }
        ]
      },
      '2026-10-09'
    )
    expect(d.nomFichier).toBe('Valeur_stock_2026-10-09')
    expect(d.feuilles[0].lignes.at(-1)).toEqual(['Total', 5, 30_000])
  })

  it('achats : une seule journée, totaux, reste dû négatif gardé en nombre', () => {
    const d = exportAchats({
      du: '2026-10-09',
      au: '2026-10-09',
      fournisseurs: [
        {
          fournisseurId: 1,
          fournisseur: 'Grossiste',
          actif: true,
          nbReceptions: 2,
          livre: 31_200,
          avoirsRecus: 0,
          regle: 10_000,
          resteDu: 21_200
        },
        {
          fournisseurId: 2,
          fournisseur: 'Brasserie',
          actif: false,
          nbReceptions: 0,
          livre: 0,
          avoirsRecus: 500,
          regle: 0,
          resteDu: -500
        }
      ],
      totalLivre: 31_200,
      totalAvoirsRecus: 500,
      totalRegle: 10_000,
      totalResteDu: 20_700
    })
    expect(d.nomFichier).toBe('Achats_2026-10-09')
    expect(d.titre).toContain('le 09/10/2026')
    expect(d.feuilles[0].lignes[1]).toEqual(['Brasserie', 'Non', 0, 0, 500, 0, -500])
    expect(d.feuilles[0].lignes.at(-1)).toEqual(['Total', null, null, 31_200, 500, 10_000, 20_700])
  })

  it('résultat : marge en attente écrite en clair, dépenses en négatif', () => {
    const d = exportResultat({
      du: '2026-10-01',
      au: '2026-10-09',
      depenses: 16_000,
      pertes: 1_250,
      marge: null,
      resultat: null
    })
    expect(d.feuilles[0].lignes).toEqual([
      ['Marge brute des ventes', EN_ATTENTE_VENTES],
      ['Dépenses', -16_000],
      ['Résultat', EN_ATTENTE_VENTES],
      ['Pertes de la période (pour information)', 1_250]
    ])
  })
})
