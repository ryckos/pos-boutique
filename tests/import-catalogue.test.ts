import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  analyserFichier,
  importerCatalogue,
  lireFichier,
  modeleImport,
  verifierImport
} from '../src/main/modules/catalogue/import'
import { ecrireParametres } from '../src/main/modules/parametres/service'
import type { Db } from '../src/main/db/connexion'
import { toutes, une } from '../src/main/db/requetes'
import { baseAvecDemo } from './aide'

type Cellule = string | number | null

const TITRES = [
  'Nom *',
  'Catégorie',
  'Code-barres',
  'Prix de vente *',
  "Prix d'achat",
  'TVA',
  "Seuil d'alerte"
]

/** Classeur Excel en mémoire : titres puis lignes. */
function classeur(lignes: Cellule[][], titres: Cellule[] = TITRES): Uint8Array {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([titres, ...lignes]), 'Produits')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

const admin = (db: Db): number =>
  une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id
const nbProduits = (db: Db): number => une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM produits')!.n

// Données de démo : Riz = 6181000000011, Baguette sans code-barres (PLU 101).
const CINQ_LIGNES: Cellule[][] = [
  ['Sucre en poudre 1 kg', 'Alimentation', '6181000000059', 900, 700, 18, 10],
  ['Eau minérale 1,5 L', 'Boissons', '6181000000066', 400, 250, 18, 12],
  ['Éponge', 'Entretien', null, 200, 120, null, null],
  ['Riz parfumé 5 kg', 'Alimentation', '6181000000011', 4500, 3200, 18, 5],
  ['Huile 1 L', 'Alimentation', '6181000000073', null, 1100, 18, 6]
]

describe('Import du catalogue — vérification', () => {
  it('rapporte 3 à créer, 1 ignorée (code déjà en base), 1 en erreur (prix manquant), sans rien écrire', () => {
    const db = baseAvecDemo()
    const avant = nbProduits(db)
    const r = verifierImport(db, classeur(CINQ_LIGNES), 'catalogue.xlsx')
    expect(r).toMatchObject({
      nomFichier: 'catalogue.xlsx',
      nbCrees: 3,
      nbIgnorees: 1,
      nbErreurs: 1,
      importe: false
    })
    expect(r.lignes.map((l) => [l.ligne, l.etat])).toEqual([
      [2, 'a_creer'],
      [3, 'a_creer'],
      [4, 'a_creer'],
      [5, 'ignoree'],
      [6, 'erreur']
    ])
    expect(r.lignes[3].motif).toContain('Riz parfumé 5 kg')
    expect(r.lignes[4].motif).toBe('Prix de vente manquant')
    expect(nbProduits(db)).toBe(avant)
  })

  it('refuse l’import tant qu’une ligne est en erreur : rien n’est créé', () => {
    const db = baseAvecDemo()
    const avant = nbProduits(db)
    expect(() => importerCatalogue(db, admin(db), classeur(CINQ_LIGNES), 'catalogue.xlsx')).toThrow(
      /1 ligne en erreur.*Rien n’a été importé/
    )
    expect(nbProduits(db)).toBe(avant)
  })

  it('met en erreur les deux lignes d’un même code répété dans le fichier', () => {
    const db = baseAvecDemo()
    const r = verifierImport(
      db,
      classeur([
        ['Sucre 1 kg', null, '6181000000059', 900, null, null, null],
        ['Sucre roux 1 kg', null, '6181000000059', 950, null, null, null],
        ['Sel 500 g', null, '6181000000080', 150, null, null, null]
      ]),
      'f.xlsx'
    )
    expect(r.lignes.map((l) => l.etat)).toEqual(['erreur', 'erreur', 'a_creer'])
    expect(r.lignes[0].motif).toBe('Code 6181000000059 présent deux fois dans le fichier (aussi ligne 3)')
  })

  it('lit les montants écrits en texte, refuse les virgules et les TVA inconnues', () => {
    const db = baseAvecDemo()
    const r = verifierImport(
      db,
      classeur([
        ['Sucre 1 kg', null, null, '1 500', '1 100', '18 %', '10'],
        ['Sel 500 g', null, null, '1500,5', null, null, null],
        ['Thé vert', null, null, 800, null, 5.5, null],
        ['Lait 1 L', null, '12AB', 700, null, null, null],
        [null, null, null, 300, null, null, null]
      ]),
      'f.xlsx'
    )
    expect(r.lignes.map((l) => l.etat)).toEqual(['a_creer', 'erreur', 'erreur', 'erreur', 'erreur'])
    expect(r.lignes[1].motif).toBe('Prix de vente : un montant en francs, sans virgule')
    expect(r.lignes[2].motif).toBe('TVA : 18 ou 0 (exonéré)')
    expect(r.lignes[3].motif).toBe('Code-barres : de 8 à 14 chiffres, sans lettre')
    expect(r.lignes[4].motif).toBe('Nom manquant')
  })

  it('reconnaît les titres sans accents ni majuscules, dans un autre ordre, et saute les lignes vides', () => {
    const db = baseAvecDemo()
    const contenu = classeur(
      [
        [1200, 'Biscuits', null],
        [null, null, null],
        [800, 'Chips', 'epicerie']
      ],
      ['PRIX DE VENTE', 'designation', 'categorie']
    )
    const lignes = lireFichier(contenu)
    expect(lignes.map((l) => [l.ligne, l.valeurs.nom, l.valeurs.prixVente])).toEqual([
      [2, 'Biscuits', 1200],
      [4, 'Chips', 800]
    ])
    expect(analyserFichier(db, lignes).aCreer).toHaveLength(2)
  })

  it('refuse un fichier sans colonne de prix, en le disant', () => {
    const db = baseAvecDemo()
    expect(() => verifierImport(db, classeur([['Sucre']], ['Nom']), 'f.xlsx')).toThrow(
      'Colonne « Prix de vente » introuvable : partez du modèle à télécharger'
    )
  })

  it('refuse un fichier qui n’est pas un classeur', () => {
    const db = baseAvecDemo()
    expect(() => verifierImport(db, new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9]), 'f.xlsx')).toThrow(
      /classeur Excel/
    )
  })
})

describe('Import du catalogue — enregistrement', () => {
  const corrige = CINQ_LIGNES.slice(0, 4)

  it('crée 3 produits avec leur « Unité » au prix du fichier et ignore le code existant', () => {
    const db = baseAvecDemo()
    const avant = nbProduits(db)
    const r = importerCatalogue(db, admin(db), classeur(corrige), 'catalogue.xlsx')
    expect(r).toMatchObject({ nbCrees: 3, nbIgnorees: 1, nbErreurs: 0, importe: true })
    expect(r.lignes.map((l) => l.etat)).toEqual(['cree', 'cree', 'cree', 'ignoree'])
    expect(nbProduits(db)).toBe(avant + 3)

    const sucre = une<Record<string, unknown>>(
      db,
      `SELECT p.taux_tva AS tva, p.seuil_alerte AS seuil, p.prix_achat_indicatif AS prixAchat,
              p.cout_moyen_pondere AS cump, cat.nom AS categorie,
              c.nom AS cond, c.quantite_base AS qte, c.prix_vente AS prix, c.code_barres AS code, c.est_defaut AS defaut
       FROM produits p JOIN conditionnements c ON c.produit_id = p.id
       LEFT JOIN categories cat ON cat.id = p.categorie_id
       WHERE p.nom = 'Sucre en poudre 1 kg'`
    )
    expect(sucre).toEqual({
      tva: 18,
      seuil: 10,
      prixAchat: 700,
      // Le prix d'achat ne touche jamais le CUMP : seuls la réception et le stock initial le font.
      cump: 0,
      categorie: 'Alimentation',
      cond: 'Unité',
      qte: 1,
      prix: 900,
      code: '6181000000059',
      defaut: 1
    })
    // Aucun mouvement de stock : l'import ne crée que des fiches.
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM mouvements_stock WHERE produit_id > 7')!.n).toBe(
      0
    )
  })

  it('prend la TVA par défaut des paramètres quand la case est vide', () => {
    const db = baseAvecDemo()
    ecrireParametres(db, { id: admin(db), nom: 'Patron', role: 'admin' }, { tvaDefaut: 0 })
    importerCatalogue(db, admin(db), classeur(corrige), 'f.xlsx')
    expect(une<{ tva: number }>(db, "SELECT taux_tva AS tva FROM produits WHERE nom = 'Éponge'")!.tva).toBe(0)
  })

  it('crée un rayon inconnu une seule fois, et le sous-rayon « Rayon / Sous-rayon »', () => {
    const db = baseAvecDemo()
    const r = importerCatalogue(
      db,
      admin(db),
      classeur([
        ['Yaourt nature', 'Frais / Laitages', null, 350, null, 18, null],
        ['Yaourt fraise', 'frais / laitages', null, 375, null, 18, null],
        ['Beurre 250 g', 'FRAIS', null, 1500, null, 18, null],
        ['Pâtes 500 g', 'alimentation', null, 600, null, 18, null]
      ]),
      'f.xlsx'
    )
    expect(r.nouvellesCategories).toEqual(['Frais', 'Frais › Laitages'])
    const cats = toutes<{ nom: string; parent: string | null }>(
      db,
      `SELECT c.nom, p.nom AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
       WHERE c.nom IN ('Frais', 'Laitages', 'alimentation', 'Alimentation') ORDER BY c.id`
    )
    expect(cats).toEqual([
      { nom: 'Alimentation', parent: null },
      { nom: 'Frais', parent: null },
      { nom: 'Laitages', parent: 'Frais' }
    ])
    const rangement = toutes<{ nom: string; categorie: string }>(
      db,
      `SELECT p.nom, c.nom AS categorie FROM produits p JOIN categories c ON c.id = p.categorie_id
       WHERE p.nom LIKE 'Yaourt%' OR p.nom LIKE 'Beurre%' ORDER BY p.id`
    )
    expect(rangement.map((p) => p.categorie)).toEqual(['Laitages', 'Laitages', 'Frais'])
  })

  it('réimporter le même fichier ne crée rien : toutes les lignes sont ignorées', () => {
    const db = baseAvecDemo()
    importerCatalogue(db, admin(db), classeur(corrige), 'f.xlsx')
    const r = verifierImport(db, classeur(corrige), 'f.xlsx')
    expect(r).toMatchObject({ nbCrees: 0, nbIgnorees: 4, nbErreurs: 0 })
    expect(r.lignes[2].motif).toBe('Produit sans code déjà au catalogue sous ce nom')
    expect(() => importerCatalogue(db, admin(db), classeur(corrige), 'f.xlsx')).toThrow(
      'Aucun nouveau produit dans ce fichier : rien à importer'
    )
  })

  it('écrit une seule ligne au journal', () => {
    const db = baseAvecDemo()
    importerCatalogue(db, admin(db), classeur(corrige), 'catalogue.xlsx')
    const journal = toutes<{ valeur: string }>(
      db,
      "SELECT nouvelle_valeur AS valeur FROM journal_audit WHERE action = 'import_catalogue'"
    )
    expect(journal).toHaveLength(1)
    expect(JSON.parse(journal[0].valeur)).toEqual({
      fichier: 'catalogue.xlsx',
      crees: 3,
      ignorees: 1,
      nouvellesCategories: []
    })
  })
})

describe('Modèle d’import', () => {
  it('se relit : titres reconnus, deux exemples, codes gardés en texte', () => {
    const db = baseAvecDemo()
    const lignes = lireFichier(modeleImport())
    expect(lignes).toHaveLength(2)
    expect(lignes[0].valeurs.codeBarres).toBe('6181000000011')
    // Riz est déjà en base (ignoré), la baguette sans code aussi (même nom).
    const a = analyserFichier(db, lignes)
    expect(a.rapport.map((l) => l.etat)).toEqual(['ignoree', 'ignoree'])
  })
})
