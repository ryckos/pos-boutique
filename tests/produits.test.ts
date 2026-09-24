import { describe, expect, it } from 'vitest'
import { alertesPrix, cleEan13, codeInterne } from '../src/shared/catalogue'
import type { FicheProduit, SaisieProduit } from '../src/shared/ipc/catalogue'
import {
  creerProduit,
  desactiverProduit,
  ficheProduit,
  genererCodeInterne,
  listeProduits,
  modifierProduit
} from '../src/main/modules/catalogue/produits'
import { conditionnementsProduit, grille, rechercherParCode } from '../src/main/modules/catalogue/service'
import { creerCategorie, desactiverCategorie } from '../src/main/modules/catalogue/categories'
import type { Db } from '../src/main/db/connexion'
import { toutes, une } from '../src/main/db/requetes'
import { baseAvecDemo, baseDeTest } from './aide'

// Données de démo : Tomate = produit 3 (Unité 350, Lot de 3 1 000, Carton de 24 7 500), 72 en stock.
const TOMATE = 3
const ALIMENTATION = 1
const CODE_JUS = '6034000012345'

const admin = (db: Db): number =>
  une<{ id: number }>(db, "SELECT id FROM utilisateurs WHERE role = 'admin'")!.id

/** Le jus d'ananas du scénario de référence (lundi 8 h, ligne 3). */
function jusAnanas(categorieId: number | null, prixPack = 3300): SaisieProduit {
  return {
    nom: "Jus d'ananas Fruity 1L",
    categorieId,
    unite: 'piece',
    tauxTva: 18,
    suiviPeremption: true,
    seuilAlerte: 6,
    uniteVente: { prixVente: 600, codeBarres: CODE_JUS, codePlu: null, boutonTactile: false, ordreBouton: 0 },
    conditionnements: [
      {
        nom: 'Pack de 6',
        quantiteBase: 6,
        prixVente: prixPack,
        codeBarres: null,
        codePlu: null,
        boutonTactile: true,
        ordreBouton: 5,
        actif: true
      }
    ]
  }
}

/** La fiche telle que l'écran la renverrait sans rien changer. */
function saisieDe(f: FicheProduit): SaisieProduit {
  return {
    nom: f.nom,
    categorieId: f.categorieId,
    unite: f.unite,
    tauxTva: f.tauxTva,
    suiviPeremption: f.suiviPeremption,
    seuilAlerte: f.seuilAlerte,
    uniteVente: { ...f.uniteVente },
    conditionnements: f.conditionnements.map((c) => ({ ...c }))
  }
}

const journal = (db: Db, action: string): Array<{ entiteId: number; avant: string; apres: string }> =>
  toutes(
    db,
    `SELECT entite_id AS entiteId, ancienne_valeur AS avant, nouvelle_valeur AS apres
     FROM journal_audit WHERE action = ? ORDER BY id`,
    action
  )

describe('Codes internes EAN-13 à préfixe 20 (REGLES_METIER § 2.3)', () => {
  it('calcule la clé de contrôle EAN-13', () => {
    expect(cleEan13('200000000001')).toBe(5)
    expect(cleEan13('400638133393')).toBe(1) // 4006381333931, code fabricant connu
    expect(codeInterne(1)).toBe('2000000000015')
    expect(codeInterne(2)).toBe('2000000000022')
  })

  it('génère les codes à la suite sur une base neuve', () => {
    const db = baseDeTest()
    expect(genererCodeInterne(db)).toBe('2000000000015')
    expect(genererCodeInterne(db)).toBe('2000000000022')
  })

  it('saute un code déjà utilisé (le lot de 3 de tomate porte 2000000000015)', () => {
    const db = baseAvecDemo()
    expect(genererCodeInterne(db)).toBe('2000000000022')
    expect(genererCodeInterne(db)).toBe('2000000000039')
  })
})

describe('Garde-fou prix (REGLES_METIER § 2.2)', () => {
  const pack = (prix: number): Array<{ nom: string; quantiteBase: number; prixVente: number }> => [
    { nom: 'Pack de 6', quantiteBase: 6, prixVente: prix }
  ]

  it('se tait quand le pack est moins cher ou au même prix que 6 unités', () => {
    expect(alertesPrix(600, pack(3300))).toEqual([])
    expect(alertesPrix(600, pack(3600))).toEqual([])
  })

  it('alerte quand le pack coûte plus que 6 unités à 600 F', () => {
    expect(alertesPrix(600, pack(3700))).toEqual([
      { conditionnement: 'Pack de 6', prixVente: 3700, prixALUnite: 3600 }
    ])
  })
})

describe('Création d’un produit — le jus d’ananas du scénario', () => {
  it('se vend aussitôt : scan de l’unité à 600 F, bouton « Pack de 6 » à 3 300 F', () => {
    const db = baseDeTest()
    const boissons = creerCategorie(db, 'Boissons')
    const { id, alertesPrix } = creerProduit(db, jusAnanas(boissons))
    expect(alertesPrix).toEqual([])

    expect(rechercherParCode(db, CODE_JUS)).toMatchObject({
      produitId: id,
      designation: "Jus d'ananas Fruity 1L",
      quantiteBase: 1,
      prixVente: 600,
      suiviPeremption: true,
      categorie: 'Boissons'
    })
    expect(grille(db)).toEqual([
      expect.objectContaining({
        designation: "Jus d'ananas Fruity 1L — Pack de 6",
        quantiteBase: 6,
        prixVente: 3300
      })
    ])
    expect(conditionnementsProduit(db, id).map((a) => a.conditionnement)).toEqual(['Unité', 'Pack de 6'])
  })

  it('enregistre malgré une alerte de prix, et la renvoie', () => {
    const db = baseDeTest()
    const r = creerProduit(db, jusAnanas(null, 3700))
    expect(r.alertesPrix).toEqual([{ conditionnement: 'Pack de 6', prixVente: 3700, prixALUnite: 3600 }])
    expect(grille(db)[0].prixVente).toBe(3700)
  })

  it('nomme toujours « Unité » le conditionnement de base, et l’enregistre par défaut', () => {
    const db = baseDeTest()
    const { id } = creerProduit(db, jusAnanas(null))
    expect(
      une(
        db,
        'SELECT nom, quantite_base AS q, est_defaut AS d FROM conditionnements WHERE produit_id = ? AND est_defaut = 1',
        id
      )
    ).toEqual({ nom: 'Unité', q: 1, d: 1 })
  })

  it('refuse un code déjà utilisé, en nommant l’article qui le porte', () => {
    const db = baseAvecDemo()
    const s = jusAnanas(null)
    s.uniteVente.codeBarres = '6181000000042'
    expect(() => creerProduit(db, s)).toThrow(
      'Le code 6181000000042 est déjà celui de « Tomate concentrée 70 g — Unité »'
    )

    const plu = jusAnanas(null)
    plu.uniteVente = { ...plu.uniteVente, codeBarres: '6034000099999', codePlu: '101' }
    expect(() => creerProduit(db, plu)).toThrow('« Baguette — Unité »')
  })

  it('refuse un code saisi deux fois dans la même fiche', () => {
    const db = baseDeTest()
    const s = jusAnanas(null)
    s.conditionnements[0].codeBarres = CODE_JUS
    expect(() => creerProduit(db, s)).toThrow('saisi deux fois')
  })

  it('refuse une saisie incorrecte sans rien enregistrer', () => {
    const db = baseDeTest()
    const cas: Array<[(s: SaisieProduit) => void, string]> = [
      [(s) => (s.nom = '   '), 'Le nom du produit est obligatoire'],
      [(s) => (s.uniteVente.prixVente = 600.5), 'sans virgule'],
      [(s) => (s.conditionnements[0].prixVente = -1), 'sans virgule'],
      [(s) => (s.conditionnements[0].quantiteBase = 0), 'supérieure à zéro'],
      [(s) => (s.conditionnements[0].nom = 'unité'), 'réservé au conditionnement de base'],
      [(s) => (s.tauxTva = 5.5), '18 % ou 0 %'],
      [(s) => (s.uniteVente.codeBarres = '60340ABC'), 'de 8 à 14 chiffres'],
      [(s) => (s.uniteVente.codePlu = '123456'), 'de 1 à 5 chiffres'],
      [(s) => (s.seuilAlerte = -1), 'seuil']
    ]
    for (const [abimer, message] of cas) {
      const s = jusAnanas(null)
      abimer(s)
      expect(() => creerProduit(db, s)).toThrow(message)
    }
    expect(listeProduits(db)).toEqual([])
  })

  it('refuse une catégorie désactivée ou inconnue', () => {
    const db = baseDeTest()
    expect(() => creerProduit(db, jusAnanas(99))).toThrow('Catégorie introuvable')
    const vieux = creerCategorie(db, 'Ancien rayon')
    desactiverCategorie(db, vieux)
    expect(() => creerProduit(db, jusAnanas(vieux))).toThrow('« Ancien rayon » est désactivée')
  })
})

describe('Modification d’un produit', () => {
  it('lit la fiche de la tomate : unité, conditionnements, stock', () => {
    const f = ficheProduit(baseAvecDemo(), TOMATE)
    expect(f).toMatchObject({ nom: 'Tomate concentrée 70 g', tauxTva: 18, actif: true, stockActuel: 72 })
    expect(f.uniteVente).toMatchObject({ prixVente: 350, codeBarres: '6181000000042' })
    expect(f.conditionnements.map((c) => [c.nom, c.quantiteBase, c.prixVente])).toEqual([
      ['Lot de 3', 3, 1000],
      ['Carton de 24', 24, 7500]
    ])
  })

  it('journalise le changement de prix de l’unité : 350 → 375', () => {
    const db = baseAvecDemo()
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.uniteVente.prixVente = 375
    modifierProduit(db, admin(db), TOMATE, s)

    expect(rechercherParCode(db, '6181000000042')?.prixVente).toBe(375)
    const [entree, ...autres] = journal(db, 'modification_prix')
    expect(autres).toEqual([])
    expect(JSON.parse(entree.avant)).toEqual({
      produit: 'Tomate concentrée 70 g',
      conditionnement: 'Unité',
      prixVente: 350
    })
    expect(JSON.parse(entree.apres)).toEqual({ prixVente: 375 })
  })

  it('ne journalise rien quand aucun prix ne change', () => {
    const db = baseAvecDemo()
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.seuilAlerte = 30
    modifierProduit(db, admin(db), TOMATE, s)
    expect(journal(db, 'modification_prix')).toEqual([])
    expect(ficheProduit(db, TOMATE).seuilAlerte).toBe(30)
  })

  it('refuse de changer la quantité d’un conditionnement existant', () => {
    const db = baseAvecDemo()
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.conditionnements[1].quantiteBase = 12
    expect(() => modifierProduit(db, admin(db), TOMATE, s)).toThrow(
      'La quantité de « Carton de 24 » ne se modifie pas : désactivez-le et créez-en un nouveau'
    )
  })

  it('désactive un conditionnement et en ajoute un autre, sans rien supprimer', () => {
    const db = baseAvecDemo()
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.conditionnements[1].actif = false
    s.conditionnements.push({
      nom: 'Carton de 12',
      quantiteBase: 12,
      prixVente: 3900,
      codeBarres: null,
      codePlu: null,
      boutonTactile: false,
      ordreBouton: 0,
      actif: true
    })
    modifierProduit(db, admin(db), TOMATE, s)

    expect(conditionnementsProduit(db, TOMATE).map((a) => a.conditionnement)).toEqual([
      'Unité',
      'Lot de 3',
      'Carton de 12'
    ])
    expect(rechercherParCode(db, '16181000000049')).toBeNull()
    expect(ficheProduit(db, TOMATE).conditionnements).toHaveLength(3)
  })

  it('garde le code d’un conditionnement désactivé : il ne se réutilise pas', () => {
    const db = baseAvecDemo()
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.conditionnements[1].actif = false
    modifierProduit(db, admin(db), TOMATE, s)
    const jus = jusAnanas(null)
    jus.uniteVente.codeBarres = '16181000000049'
    expect(() => creerProduit(db, jus)).toThrow('« Tomate concentrée 70 g — Carton de 24 » (désactivé)')
  })

  it('range le produit dans un sous-rayon : la liste montre « rayon › sous-rayon »', () => {
    const db = baseAvecDemo()
    const conserves = creerCategorie(db, 'Conserves', ALIMENTATION)
    const s = saisieDe(ficheProduit(db, TOMATE))
    s.categorieId = conserves
    modifierProduit(db, admin(db), TOMATE, s)
    expect(listeProduits(db).find((p) => p.id === TOMATE)).toMatchObject({
      categorie: 'Alimentation › Conserves',
      prixUnite: 350,
      nbConditionnements: 3,
      stockActuel: 72,
      actif: true
    })
    // La caisse reçoit toujours le rayon.
    expect(rechercherParCode(db, '6181000000042')?.categorie).toBe('Alimentation')
  })
})

describe('Désactivation d’un produit (jamais de suppression)', () => {
  it('exige un motif', () => {
    const db = baseAvecDemo()
    expect(() => desactiverProduit(db, admin(db), TOMATE, '  ')).toThrow('Indiquez le motif')
  })

  it('retire le produit de la vente, journalise motif et stock restant, et le fige', () => {
    const db = baseAvecDemo()
    desactiverProduit(db, admin(db), TOMATE, 'Plus fabriqué')

    expect(rechercherParCode(db, '6181000000042')).toBeNull()
    expect(conditionnementsProduit(db, TOMATE)).toEqual([])
    const [entree] = journal(db, 'desactivation_produit')
    expect(entree.entiteId).toBe(TOMATE)
    expect(JSON.parse(entree.apres)).toEqual({ motif: 'Plus fabriqué', stockRestant: 72 })

    const liste = listeProduits(db)
    expect(liste[liste.length - 1]).toMatchObject({ id: TOMATE, actif: false })
    expect(() => modifierProduit(db, admin(db), TOMATE, saisieDe(ficheProduit(db, TOMATE)))).toThrow(
      'est désactivé'
    )
    expect(() => desactiverProduit(db, admin(db), TOMATE, 'encore')).toThrow('déjà désactivé')
  })
})
