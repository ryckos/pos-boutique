import { describe, expect, it } from 'vitest'
import {
  annulerCommande,
  cloturerCommande,
  commandesOuvertes,
  creerCommande,
  envoyerCommande,
  lireCommande,
  listerCommandes,
  modifierCommande,
  produitsEnAlerte
} from '../src/main/modules/achats/commandes'
import { lireReception, validerReception } from '../src/main/modules/achats/receptions'
import { creerFournisseur, desactiverFournisseur, listerFournisseurs } from '../src/main/modules/fournisseurs/service'
import { enregistrerMouvement } from '../src/main/core/mouvements'
import { une, toutes } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1 ;
// Riz = 1 (20, seuil 5) ; Tomate = 3 (72, seuil 24 ; Unité, Lot de 3, Carton de 24) ; Savon = 7 (30, seuil 12).
const KOSSI = 3
const GROSSISTE = 1
const RIZ = 1
const TOMATE = 3
const SAVON = 7

function conditionnement(db: Db, code: string): number {
  return une<{ id: number }>(
    db,
    'SELECT id FROM conditionnements WHERE code_barres = ? OR code_plu = ?',
    code,
    code
  )!.id
}
const CARTON_TOMATE = '16181000000049'
const UNITE_TOMATE = '6181000000042'
const UNITE_RIZ = '6181000000011'

/** Commande envoyée : 3 cartons de tomate à 6 000, 10 riz sans prix. */
function commandeEnvoyee(db: Db): number {
  const { id } = creerCommande(db, KOSSI, {
    fournisseurId: GROSSISTE,
    lignes: [
      { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 },
      { conditionnementId: conditionnement(db, UNITE_RIZ), quantite: 10, prix: null }
    ]
  })
  envoyerCommande(db, id)
  return id
}

function recevoir(db: Db, commandeId: number | null, lignes: { code: string; quantite: number; prix: number }[]) {
  return validerReception(db, KOSSI, {
    fournisseurId: GROSSISTE,
    commandeId,
    lignes: lignes.map((l) => ({ conditionnementId: conditionnement(db, l.code), quantite: l.quantite, prix: l.prix }))
  })
}

function vendre(db: Db, produitId: number, quantite: number): void {
  enregistrerMouvement(db, { produitId, type: 'vente', quantite: -quantite, coutUnitaire: 0, utilisateurId: 2 })
}

describe('Commande : création et brouillon (REGLES_METIER § 4.7)', () => {
  it('crée un brouillon numéroté CA, dans le conditionnement, avec le total prévu', () => {
    const db = baseAvecDemo()
    const { id, numero } = creerCommande(db, KOSSI, {
      fournisseurId: GROSSISTE,
      commentaire: '  livrer lundi ',
      lignes: [
        { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 },
        { conditionnementId: conditionnement(db, UNITE_RIZ), quantite: 10, prix: null }
      ]
    })
    expect(numero).toMatch(/^CA-\d{4}-000001$/)
    const c = lireCommande(db, id)
    expect(c).toMatchObject({ numero, statut: 'brouillon', fournisseur: 'Grossiste Hédzranawoé', commentaire: 'livrer lundi', totalPrevu: 18000, receptions: [] })
    expect(c.lignes[0]).toMatchObject({
      produitId: TOMATE,
      conditionnement: 'Carton de 24',
      quantite: 3,
      prix: 6000,
      total: 18000,
      commandeBase: 72,
      recuBase: 0,
      resteBase: 72
    })
    expect(c.lignes[1]).toMatchObject({ produitId: RIZ, prix: null, total: null, resteBase: 10 })
    expect(listerCommandes(db)[0]).toMatchObject({ id, statut: 'brouillon', nbLignes: 2, totalPrevu: 18000 })
  })

  it('refuse une commande vide, un fournisseur désactivé, une quantité non entière, un prix à virgule', () => {
    const db = baseAvecDemo()
    const carton = conditionnement(db, CARTON_TOMATE)
    expect(() => creerCommande(db, KOSSI, { fournisseurId: GROSSISTE, lignes: [] })).toThrow(/au moins un article/)
    expect(() =>
      creerCommande(db, KOSSI, { fournisseurId: GROSSISTE, lignes: [{ conditionnementId: carton, quantite: 1.5, prix: null }] })
    ).toThrow(/entière/)
    expect(() =>
      creerCommande(db, KOSSI, { fournisseurId: GROSSISTE, lignes: [{ conditionnementId: carton, quantite: 1, prix: 99.5 }] })
    ).toThrow(/sans virgule/)
    const autre = creerFournisseur(db, { nom: 'Marché Assigamé', delaiPaiementJours: 0 })
    desactiverFournisseur(db, KOSSI, autre, 'fermé')
    expect(() =>
      creerCommande(db, KOSSI, { fournisseurId: autre, lignes: [{ conditionnementId: carton, quantite: 1, prix: null }] })
    ).toThrow(/désactivé/)
    // Rien n'a été écrit : la numérotation n'a pas avancé.
    expect(listerCommandes(db)).toHaveLength(0)
  })

  it('refuse deux lignes du même produit, même en conditionnements différents', () => {
    const db = baseAvecDemo()
    expect(() =>
      creerCommande(db, KOSSI, {
        fournisseurId: GROSSISTE,
        lignes: [
          { conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 1, prix: null },
          { conditionnementId: conditionnement(db, UNITE_TOMATE), quantite: 5, prix: null }
        ]
      })
    ).toThrow(/déjà dans la commande/)
  })

  it('le brouillon se modifie (lignes remplacées), plus après l’envoi', () => {
    const db = baseAvecDemo()
    const { id } = creerCommande(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 3, prix: 6000 }]
    })
    modifierCommande(db, id, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 4, prix: 6000 }]
    })
    expect(lireCommande(db, id).lignes).toHaveLength(1)
    expect(lireCommande(db, id).lignes[0].quantite).toBe(4)

    envoyerCommande(db, id)
    expect(lireCommande(db, id).statut).toBe('envoyee')
    expect(() => envoyerCommande(db, id)).toThrow(/déjà envoyée/)
    expect(() =>
      modifierCommande(db, id, {
        fournisseurId: GROSSISTE,
        lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 5, prix: 6000 }]
      })
    ).toThrow(/annulez-la et faites-en une autre/)
  })
})

describe('Commande : réceptions liées', () => {
  it('3 cartons commandés, 2 reçus → reçue en partie, reste 24 boîtes ; le dernier → reçue', () => {
    const db = baseAvecDemo()
    const id = commandeEnvoyee(db)
    expect(commandesOuvertes(db, GROSSISTE).map((c) => c.id)).toEqual([id])

    const r1 = recevoir(db, id, [
      { code: CARTON_TOMATE, quantite: 2, prix: 6000 },
      { code: UNITE_RIZ, quantite: 10, prix: 3200 }
    ])
    let c = lireCommande(db, id)
    expect(c.statut).toBe('recue_partiel')
    expect(c.lignes[0]).toMatchObject({ recuBase: 48, resteBase: 24 })
    expect(c.lignes[1]).toMatchObject({ recuBase: 10, resteBase: 0 })
    expect(lireReception(db, r1.id).commande).toBe(c.numero)

    // Le reste arrive en boîtes : la comparaison se fait en unités de base.
    recevoir(db, id, [{ code: UNITE_TOMATE, quantite: 24, prix: 250 }])
    c = lireCommande(db, id)
    expect(c.statut).toBe('recue')
    expect(c.lignes[0].resteBase).toBe(0)
    expect(c.receptions).toHaveLength(2)
    expect(commandesOuvertes(db, GROSSISTE)).toEqual([])
  })

  it('le prix payé fait la dette ; un article non commandé est accepté ; trop reçu = reste 0', () => {
    const db = baseAvecDemo()
    const id = commandeEnvoyee(db)
    const r = recevoir(db, id, [
      { code: CARTON_TOMATE, quantite: 4, prix: 6600 },
      { code: UNITE_RIZ, quantite: 10, prix: 3200 },
      { code: '6181000000035', quantite: 12, prix: 150 }
    ])
    expect(r.total).toBe(4 * 6600 + 10 * 3200 + 12 * 150)
    expect(listerFournisseurs(db).find((f) => f.id === GROSSISTE)!.soldeDu).toBe(r.total)
    const c = lireCommande(db, id)
    expect(c.statut).toBe('recue')
    expect(c.lignes[0]).toMatchObject({ recuBase: 96, resteBase: 0 })
  })

  it('une réception sans commande ne touche aucune commande', () => {
    const db = baseAvecDemo()
    const id = commandeEnvoyee(db)
    recevoir(db, null, [{ code: CARTON_TOMATE, quantite: 3, prix: 6000 }])
    expect(lireCommande(db, id)).toMatchObject({ statut: 'envoyee', receptions: [] })
  })

  it('refuse de lier un brouillon, une commande annulée ou reçue, ou d’un autre fournisseur, sans rien écrire', () => {
    const db = baseAvecDemo()
    const brouillon = creerCommande(db, KOSSI, {
      fournisseurId: GROSSISTE,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 1, prix: null }]
    }).id
    const ligne = [{ code: CARTON_TOMATE, quantite: 1, prix: 6000 }]
    expect(() => recevoir(db, brouillon, ligne)).toThrow(/n’a pas été envoyée/)

    annulerCommande(db, KOSSI, brouillon, 'erreur')
    expect(() => recevoir(db, brouillon, ligne)).toThrow(/annulée/)

    const autre = creerFournisseur(db, { nom: 'Marché Assigamé', delaiPaiementJours: 0 })
    const cmdAutre = creerCommande(db, KOSSI, {
      fournisseurId: autre,
      lignes: [{ conditionnementId: conditionnement(db, CARTON_TOMATE), quantite: 1, prix: null }]
    }).id
    envoyerCommande(db, cmdAutre)
    expect(() => recevoir(db, cmdAutre, ligne)).toThrow(/autre fournisseur/)

    const id = commandeEnvoyee(db)
    recevoir(db, id, [
      { code: CARTON_TOMATE, quantite: 3, prix: 6000 },
      { code: UNITE_RIZ, quantite: 10, prix: 3200 }
    ])
    expect(() => recevoir(db, id, ligne)).toThrow(/déjà reçue/)
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM receptions')!.n).toBe(1)
  })
})

describe('Commande : annulation et clôture (journalisées)', () => {
  it('annule une commande envoyée non livrée, motif journalisé', () => {
    const db = baseAvecDemo()
    const id = commandeEnvoyee(db)
    expect(() => annulerCommande(db, KOSSI, id, '  ')).toThrow(/motif/)
    annulerCommande(db, KOSSI, id, 'le grossiste ferme')
    expect(lireCommande(db, id).statut).toBe('annulee')
    const j = une<{ action: string; nouvelle_valeur: string }>(
      db,
      "SELECT action, nouvelle_valeur FROM journal_audit WHERE action = 'annulation_commande'"
    )!
    expect(JSON.parse(j.nouvelle_valeur)).toEqual({ motif: 'le grossiste ferme' })
    expect(() => annulerCommande(db, KOSSI, id, 'encore')).toThrow(/déjà annulée/)
  })

  it('refuse d’annuler une commande déjà livrée en partie ; on la clôture, avec le reste au journal', () => {
    const db = baseAvecDemo()
    const id = commandeEnvoyee(db)
    expect(() => cloturerCommande(db, KOSSI, id, 'rien')).toThrow(/annulez la commande/)
    recevoir(db, id, [{ code: CARTON_TOMATE, quantite: 2, prix: 6000 }])
    expect(() => annulerCommande(db, KOSSI, id, 'trop tard')).toThrow(/clôturez-la/)

    cloturerCommande(db, KOSSI, id, 'plus de tomate chez le grossiste')
    expect(lireCommande(db, id).statut).toBe('recue')
    const j = une<{ ancienne_valeur: string; nouvelle_valeur: string }>(
      db,
      "SELECT ancienne_valeur, nouvelle_valeur FROM journal_audit WHERE action = 'cloture_commande'"
    )!
    expect(JSON.parse(j.ancienne_valeur).reste).toEqual([
      { produit: 'Tomate concentrée 70 g', resteBase: 24 },
      { produit: 'Riz parfumé 5 kg', resteBase: 10 }
    ])
    expect(() => cloturerCommande(db, KOSSI, id, 'encore')).toThrow(/déjà entièrement reçue/)
  })
})

describe('Commande : produits en alerte', () => {
  it('liste ruptures puis stocks bas, avec le conditionnement de la dernière réception, sans quantité', () => {
    const db = baseAvecDemo()
    expect(produitsEnAlerte(db)).toEqual([])
    vendre(db, SAVON, 30) // rupture
    recevoir(db, null, [{ code: CARTON_TOMATE, quantite: 1, prix: 6000 }])
    vendre(db, TOMATE, 80) // 72 + 24 − 80 = 16 ≤ 24 : stock bas
    const alertes = produitsEnAlerte(db)
    expect(alertes.map((a) => [a.produit, a.niveau, a.stock])).toEqual([
      ['Savon de ménage', 'rupture', 0],
      ['Tomate concentrée 70 g', 'stock_bas', 16]
    ])
    expect(alertes[0].conditionnementId).toBe(conditionnement(db, '6181000000035'))
    expect(alertes[1].conditionnementId).toBe(conditionnement(db, CARTON_TOMATE))
    expect(Object.keys(alertes[0])).not.toContain('quantite')
    expect(toutes(db, 'SELECT * FROM commandes_achat')).toEqual([])
  })
})
