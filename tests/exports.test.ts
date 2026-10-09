import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { classeurExcel, horodatageExport, nomFichierExport } from '../src/main/modules/exports/service'
import type { DemandeExport } from '../src/shared/ipc/exports'

function relire(contenu: Uint8Array): XLSX.WorkBook {
  return XLSX.read(contenu, { type: 'buffer', cellNF: true })
}
function cellule(classeur: XLSX.WorkBook, feuille: string, adresse: string): XLSX.CellObject | undefined {
  return classeur.Sheets[feuille][adresse] as XLSX.CellObject | undefined
}

const PERTES: DemandeExport = {
  nomFichier: 'Pertes_2026-10-01_2026-10-09',
  titre: 'Pertes du 01/10/2026 au 09/10/2026',
  feuilles: [
    {
      nom: 'Par produit',
      colonnes: [
        { titre: 'Produit', type: 'texte' },
        { titre: 'Code-barres', type: 'texte' },
        { titre: 'Quantité', type: 'nombre' },
        { titre: 'Valeur', type: 'montant' },
        { titre: 'Date', type: 'date' },
        { titre: 'Saisi le', type: 'date' }
      ],
      lignes: [
        ['Tomate concentrée', '0061810000004', 2, 500, '2026-10-09', '2026-10-09 14:30:00'],
        ['=SOMME(A1)', null, 1.5, 1000, null, null]
      ]
    }
  ]
}

describe('Exports Excel', () => {
  it('ligne de titre avec l’auteur et l’heure, en-têtes en ligne 3, lignes ensuite', () => {
    const c = relire(classeurExcel(PERTES, 'Kossi', '09/10/2026 à 10 h 52'))
    expect(c.SheetNames).toEqual(['Par produit'])
    expect(cellule(c, 'Par produit', 'A1')!.v).toBe(
      'Pertes du 01/10/2026 au 09/10/2026 — exporté le 09/10/2026 à 10 h 52 par Kossi'
    )
    expect(cellule(c, 'Par produit', 'A2')).toBeUndefined()
    expect(cellule(c, 'Par produit', 'A3')!.v).toBe('Produit')
    expect(cellule(c, 'Par produit', 'F3')!.v).toBe('Saisi le')
    expect(cellule(c, 'Par produit', 'A4')!.v).toBe('Tomate concentrée')
  })

  it('montant = vrai nombre au format F ; quantité = nombre, décimales gardées', () => {
    const c = relire(classeurExcel(PERTES, 'Kossi', 'x'))
    expect(cellule(c, 'Par produit', 'D5')).toMatchObject({ t: 'n', v: 1000, z: '#,##0 "F"' })
    expect(cellule(c, 'Par produit', 'C5')).toMatchObject({ t: 'n', v: 1.5 })
  })

  it('date = vraie date Excel (avec l’heure si elle est donnée)', () => {
    const c = relire(classeurExcel(PERTES, 'Kossi', 'x'))
    // 09/10/2026 = jour 46 304 depuis le 30/12/1899.
    expect(cellule(c, 'Par produit', 'E4')).toMatchObject({ t: 'n', v: 46304, z: 'dd/mm/yyyy' })
    const h = cellule(c, 'Par produit', 'F4')!
    expect(h.z).toBe('dd/mm/yyyy hh:mm')
    expect(h.v as number).toBeCloseTo(46304 + 14.5 / 24, 6)
  })

  it('un code-barres garde son zéro ; « =… » reste du texte, jamais une formule ; null = vide', () => {
    const c = relire(classeurExcel(PERTES, 'Kossi', 'x'))
    expect(cellule(c, 'Par produit', 'B4')).toMatchObject({ t: 's', v: '0061810000004' })
    const formule = cellule(c, 'Par produit', 'A5')!
    expect(formule).toMatchObject({ t: 's', v: '=SOMME(A1)' })
    expect(formule.f).toBeUndefined()
    expect(cellule(c, 'Par produit', 'B5')).toBeUndefined()
  })

  it('plusieurs feuilles ; nom d’onglet nettoyé, raccourci à 31 caractères, jamais en double', () => {
    const feuille = PERTES.feuilles[0]
    const c = relire(
      classeurExcel(
        {
          ...PERTES,
          feuilles: [
            { ...feuille, nom: 'Par cause' },
            { ...feuille, nom: 'Pertes / casse ? et * vol [octobre 2026] du rayon' },
            { ...feuille, nom: 'par cause' }
          ]
        },
        'Kossi',
        'x'
      )
    )
    expect(c.SheetNames[0]).toBe('Par cause')
    expect(c.SheetNames[1]).toBe('Pertes casse et vol octobre 202')
    expect(c.SheetNames[1].length).toBeLessThanOrEqual(31)
    expect(c.SheetNames[2]).toBe('par cause (2)')
  })

  it('une feuille vide garde son titre et ses en-têtes', () => {
    const c = relire(
      classeurExcel({ ...PERTES, feuilles: [{ ...PERTES.feuilles[0], lignes: [] }] }, 'Kossi', 'x')
    )
    expect(cellule(c, 'Par produit', 'A3')!.v).toBe('Produit')
  })

  it('refuse une demande sans feuille ; une ligne de la mauvaise longueur est un bug', () => {
    expect(() => classeurExcel({ ...PERTES, feuilles: [] }, 'Kossi', 'x')).toThrow(/Rien à exporter/)
    expect(() =>
      classeurExcel(
        { ...PERTES, feuilles: [{ ...PERTES.feuilles[0], lignes: [['Tomate', 2]] }] },
        'Kossi',
        'x'
      )
    ).toThrow(/n’a pas 6 valeurs/)
  })

  it('nom de fichier : caractères interdits remplacés, « .xlsx » ajouté une seule fois', () => {
    expect(nomFichierExport('Pertes 01/10/2026: rayon*')).toBe('Pertes 01-10-2026- rayon-.xlsx')
    expect(nomFichierExport('Stock.xlsx')).toBe('Stock.xlsx')
    expect(nomFichierExport('  ')).toBe('Export.xlsx')
  })

  it('horodatage lisible, heure locale', () => {
    expect(horodatageExport(new Date(2026, 9, 9, 8, 5))).toBe('09/10/2026 à 08 h 05')
  })
})
