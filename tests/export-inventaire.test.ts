import { describe, expect, it } from 'vitest'
import { exportInventaire } from '../src/renderer/src/modules/inventaires/exportInventaire'
import { classeurExcel } from '../src/main/modules/exports/service'
import type { InventaireDetail } from '../src/shared/ipc/inventaires'

// Samedi (SCENARIO_REFERENCE) : tomate 41 = juste ; savon 29 → 27, vol, 300 F de démarque.
const SAMEDI: InventaireDetail = {
  id: 7,
  numero: 'INV-2026-000007',
  type: 'partiel',
  rayon: 'Entretien',
  statut: 'valide',
  dateDebut: '2026-10-10 08:00:00',
  dateValidation: '2026-10-10 11:30:00',
  ouvertPar: 'Kossi',
  validePar: 'Kossi',
  nbComptes: 2,
  demarque: 300,
  motifAnnulation: null,
  nbNonComptes: 0,
  produits: [
    {
      produitId: 3,
      nom: 'Tomate concentrée',
      rayon: 'Alimentation',
      unite: 'boîte',
      stock: 41,
      cump: 250,
      conditionnements: [],
      ligne: {
        produitId: 3,
        quantiteTheorique: 41,
        quantiteComptee: 41,
        ecart: 0,
        detail: [
          { conditionnementId: 1, conditionnement: 'Carton de 24', nombre: 1 },
          { conditionnementId: 2, conditionnement: 'Lot de 3', nombre: 5 },
          { conditionnementId: 3, conditionnement: 'Unité', nombre: 2 }
        ],
        motif: null,
        commentaire: null,
        compteLe: '2026-10-10 09:15:00',
        valeurEcart: 0
      }
    },
    {
      produitId: 7,
      nom: 'Savon de ménage',
      rayon: 'Entretien',
      unite: 'unité',
      stock: 27,
      cump: 150,
      conditionnements: [],
      ligne: {
        produitId: 7,
        quantiteTheorique: 29,
        quantiteComptee: 27,
        ecart: -2,
        detail: [{ conditionnementId: 9, conditionnement: 'Unité', nombre: 27 }],
        motif: 'vol',
        commentaire: 'présumé',
        compteLe: '2026-10-10 09:40:00',
        valeurEcart: -300
      }
    }
  ],
  rapport: {
    lignes: [
      {
        produitId: 7,
        produit: 'Savon de ménage',
        unite: 'unité',
        ecart: -2,
        cump: 150,
        valeur: -300,
        motif: 'vol',
        commentaire: 'présumé'
      }
    ],
    manquants: 300,
    surplus: 0,
    net: -300
  }
}

describe('Export d’un inventaire', () => {
  it('inventaire validé : comptages convertis, démarque de 300 F et ses totaux', () => {
    const d = exportInventaire(SAMEDI)
    expect(d.nomFichier).toBe('Inventaire_INV-2026-000007')
    expect(d.titre).toBe('Inventaire INV-2026-000007, Entretien, ouvert le 10/10/2026 (validé le 10/10/2026)')
    expect(d.feuilles.map((f) => f.nom)).toEqual(['Comptages', 'Démarque'])
    expect(d.feuilles[0].lignes[0].slice(3, 7)).toEqual(['1 Carton de 24 + 5 Lot de 3 + 2 Unité', 41, 41, 0])
    expect(d.feuilles[0].lignes[1].slice(6, 8)).toEqual([-2, 'Vol'])
    expect(d.feuilles[1].lignes).toEqual([
      ['Savon de ménage', -2, 'unité', 'Vol', 150, -300],
      ['Manquants', null, null, null, null, -300],
      ['Surplus', null, null, null, null, 0],
      ['Net', null, null, null, null, -300]
    ])
    expect(() => classeurExcel(d, 'Kossi', 'x')).not.toThrow()
  })

  it('inventaire annulé : seulement les comptages, pas de démarque', () => {
    const d = exportInventaire({
      ...SAMEDI,
      statut: 'annule',
      dateValidation: null,
      rapport: null,
      motifAnnulation: 'mauvais rayon'
    })
    expect(d.feuilles.map((f) => f.nom)).toEqual(['Comptages'])
    expect(d.titre).toContain('(annulé)')
  })
})
