import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, une } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { cloturerSession } from '../src/main/modules/caisse/service-cloture'
import { ventesPeriode } from '../src/main/modules/caisse/service-rapports'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import {
  classementProduits,
  historiqueSessions,
  ventesParCaissier,
  ventesParHeure
} from '../src/main/modules/rapports-ventes/service'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const CARTON = '16181000000049' // tomate, 7 500 F, coût 24 × 250 = 6 000
const UNITE = '6181000000042' // tomate, 350 F, coût 250
const BAGUETTE = '101' // PLU, 300 F
const JUS = '6034000012345' // 600 F

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId
const jour = (db: Db): string => une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j

function vendre(
  db: Db,
  u: UtilisateurConnecte,
  lignes: RequeteVente['lignes'],
  total: number,
  remiseGlobale = 0
): { venteId: number; numeroTicket: string } {
  return enregistrerVente(db, u.id, {
    lignes,
    remiseGlobale,
    paiements: [{ mode: 'especes', montant: total }]
  })
}

/** `ventes` n'a pas de trigger d'UPDATE : la base de test peut déplacer une vente dans le temps. */
function dater(db: Db, venteId: number, decalage: string): void {
  executer(
    db,
    `UPDATE ventes SET horodatage = datetime('now','localtime','${decalage}') WHERE id = ?`,
    venteId
  )
}

/** Fixe l'heure d'une vente aujourd'hui (« 09:15 »). */
function aHeure(db: Db, venteId: number, hhmm: string): void {
  executer(
    db,
    "UPDATE ventes SET horodatage = date('now','localtime') || ' ' || ? || ':00' WHERE id = ?",
    hhmm,
    venteId
  )
}

/**
 * La semaine de `caisse-rapports.test.ts` : Afi vend à 9 h 15 un carton et 2 unités de tomate
 * (8 200 F, coût 6 500). Kossi vend à 14 h 40 3 unités avec 50 F de remise sur le ticket (1 000 F,
 * coût 750), annule à 14 h 50 un ticket d'un carton (7 500 F), puis reprend 1 unité du ticket d'Afi
 * (350 F rendus, coût 250).
 */
function semaine(): { db: Db; ticket1: number; ticket2: number } {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  ouvrirSession(db, KOSSI.id, 10000)
  const t1 = vendre(
    db,
    AFI,
    [
      { conditionnementId: id(db, CARTON), quantite: 1 },
      { conditionnementId: id(db, UNITE), quantite: 2 }
    ],
    8200
  )
  const t2 = vendre(db, KOSSI, [{ conditionnementId: id(db, UNITE), quantite: 3 }], 1000, 50)
  const t3 = vendre(db, KOSSI, [{ conditionnementId: id(db, CARTON), quantite: 1 }], 7500)
  annulerTicket(db, KOSSI, { numeroTicket: t3.numeroTicket, motif: 'Erreur de saisie' })
  const ligneUnite = consulterRetour(db, KOSSI, t1.numeroTicket).lignes.find(
    (l) => !l.designation.includes('Carton')
  )!
  enregistrerRetour(db, KOSSI, {
    numeroTicket: t1.numeroTicket,
    lignes: [{ ligneId: ligneUnite.ligneId, quantite: 1 }],
    motif: 'defectueux',
    sort: 'detruire',
    remboursement: { mode: 'especes' }
  })
  aHeure(db, t1.venteId, '09:15')
  aHeure(db, t2.venteId, '14:40')
  aHeure(db, t3.venteId, '14:50')
  return { db, ticket1: t1.venteId, ticket2: t2.venteId }
}

describe('Ventes par heure (A14)', () => {
  it('une tranche par heure ayant des ventes ; ticket annulé et retour exclus', () => {
    const { db } = semaine()
    const r = ventesParHeure(db, {})
    expect(r.lignes).toEqual([
      { heure: 9, nbTickets: 1, chiffreAffaires: 8200, panierMoyen: 8200 },
      { heure: 14, nbTickets: 1, chiffreAffaires: 1000, panierMoyen: 1000 }
    ])
    expect(r.nbTickets).toBe(2)
    expect(r.chiffreAffaires).toBe(9200)
  })

  it('additionne la même heure sur plusieurs jours et arrondit le panier moyen', () => {
    const { db, ticket1 } = semaine()
    dater(db, ticket1, '-1 day')
    aHeure(db, ticket1, '14:05') // même tranche que le ticket de 14 h 40, mais aujourd'hui
    const r = ventesParHeure(db, {})
    expect(r.lignes).toEqual([{ heure: 14, nbTickets: 2, chiffreAffaires: 9200, panierMoyen: 4600 }])
    const impair = vendre(db, AFI, [{ conditionnementId: id(db, UNITE), quantite: 1 }], 350)
    aHeure(db, impair.venteId, '14:10')
    // (8 200 + 1 000 + 350) / 3 = 3 183,33 → 3 183
    expect(ventesParHeure(db, {}).lignes[0]).toMatchObject({ nbTickets: 3, panierMoyen: 3183 })
  })

  it('période sans vente : aucune tranche ; fin dans le futur refusée', () => {
    const db = baseAvecDemo()
    expect(ventesParHeure(db, {})).toMatchObject({ lignes: [], nbTickets: 0, chiffreAffaires: 0 })
    expect(() => ventesParHeure(db, { au: '2999-01-01' })).toThrow(/futur/)
  })
})

describe('Ventes par caissier (A14)', () => {
  it('chaque document au nom de celui qui l’a saisi ; le plus gros chiffre d’abord', () => {
    const { db } = semaine()
    const r = ventesParCaissier(db, {})
    expect(r.lignes).toEqual([
      {
        utilisateurId: AFI.id,
        caissier: 'Afi',
        nbTickets: 1,
        ventesTtc: 8200,
        retoursTtc: 0,
        chiffreAffaires: 8200,
        panierMoyen: 8200,
        remises: 0,
        nbAnnules: 0,
        montantAnnules: 0
      },
      {
        utilisateurId: KOSSI.id,
        caissier: 'Kossi',
        nbTickets: 1,
        ventesTtc: 1000,
        retoursTtc: -350,
        chiffreAffaires: 650,
        panierMoyen: 1000,
        remises: 50,
        nbAnnules: 1,
        montantAnnules: 7500
      }
    ])
  })

  it('le total des caissiers égale le chiffre d’affaires de ventesPeriode', () => {
    const { db } = semaine()
    const total = ventesParCaissier(db, {}).lignes.reduce((n, l) => n + l.chiffreAffaires, 0)
    expect(total).toBe(ventesPeriode(db, {}).chiffreAffaires)
    expect(total).toBe(8850)
  })

  it('remises : celle du ticket plus celles des lignes', () => {
    const { db } = semaine()
    // Kossi (gérant, pas de plafond) : un carton à 7 500 F moins 500 F de remise sur la ligne.
    const t = vendre(db, KOSSI, [{ conditionnementId: id(db, CARTON), quantite: 1, remise: 500 }], 7000)
    aHeure(db, t.venteId, '16:00')
    const kossi = ventesParCaissier(db, {}).lignes.find((l) => l.caissier === 'Kossi')!
    expect(kossi.remises).toBe(550)
  })

  it('un ticket d’un autre jour est hors période', () => {
    const { db, ticket1 } = semaine()
    dater(db, ticket1, '-1 day')
    const r = ventesParCaissier(db, { du: jour(db), au: jour(db) })
    expect(r.lignes.map((l) => l.caissier)).toEqual(['Kossi'])
  })
})

describe('Top et flop des produits (A14)', () => {
  it('agrège par produit, tous conditionnements confondus, retours déduits', () => {
    const { db } = semaine()
    const r = classementProduits(db, {})
    // Tomate : 24 + 2 + 3 − 1 = 28 unités de base. Chiffre d'affaires des lignes :
    // 7 500 + 700 + 1 050 − 350 = 8 900 (la remise de 50 F sur le ticket n'est pas répartie).
    // Coût : 6 000 + 500 + 750 − 250 = 7 000.
    expect(r.nbProduits).toBe(1)
    expect(r.top).toEqual([
      {
        produitId: rechercherParCode(db, UNITE)!.produitId,
        produit: 'Tomate concentrée 70 g',
        quantiteBase: 28,
        chiffreAffaires: 8900,
        marge: 1900
      }
    ])
    // L'écart avec ventesPeriode (8 850) est exactement la remise sur le ticket.
    expect(r.top[0].chiffreAffaires - ventesPeriode(db, {}).chiffreAffaires).toBe(50)
  })

  it('le critère change l’ordre ; le flop est l’inverse parmi les produits vendus', () => {
    const { db } = semaine()
    vendre(db, AFI, [{ conditionnementId: id(db, JUS), quantite: 3 }], 1800) // 3 jus : 1 800 F
    vendre(db, AFI, [{ conditionnementId: id(db, BAGUETTE), quantite: 5 }], 1500) // 5 baguettes : 1 500 F
    const noms = (l: { produit: string }[]): string[] => l.map((p) => p.produit.split(' ')[0])

    const parCa = classementProduits(db, { critere: 'chiffreAffaires' })
    expect(parCa.nbProduits).toBe(3)
    expect(noms(parCa.top)).toEqual(['Tomate', 'Jus', 'Baguette'])
    expect(noms(parCa.flop)).toEqual(['Baguette', 'Jus', 'Tomate'])

    // 28 tomates, 5 baguettes, 3 jus.
    const parQuantite = classementProduits(db, { critere: 'quantite' })
    expect(noms(parQuantite.top)).toEqual(['Tomate', 'Baguette', 'Jus'])
    expect(parQuantite.top.map((p) => p.quantiteBase)).toEqual([28, 5, 3])
  })

  it('la limite borne le top et le flop', () => {
    const { db } = semaine()
    vendre(db, AFI, [{ conditionnementId: id(db, JUS), quantite: 3 }], 1800)
    vendre(db, AFI, [{ conditionnementId: id(db, BAGUETTE), quantite: 5 }], 1500)
    const r = classementProduits(db, { limite: 2 })
    expect(r.top).toHaveLength(2)
    expect(r.flop).toHaveLength(2)
    expect(r.nbProduits).toBe(3)
  })

  it('un produit seulement retourné dans la période n’est pas classé', () => {
    const { db } = semaine()
    const t = vendre(db, AFI, [{ conditionnementId: id(db, BAGUETTE), quantite: 2 }], 600)
    dater(db, t.venteId, '-1 day')
    const ligne = consulterRetour(db, KOSSI, t.numeroTicket).lignes[0]
    enregistrerRetour(db, KOSSI, {
      numeroTicket: t.numeroTicket,
      lignes: [{ ligneId: ligne.ligneId, quantite: 2 }],
      motif: 'defectueux',
      sort: 'detruire',
      remboursement: { mode: 'especes' }
    })
    const aujourdhui = classementProduits(db, { du: jour(db), au: jour(db) })
    expect(aujourdhui.top.map((p) => p.produit)).not.toContain('Baguette')
  })

  it('aucune vente : listes vides', () => {
    const db = baseAvecDemo()
    expect(classementProduits(db, {})).toMatchObject({ top: [], flop: [], nbProduits: 0 })
  })
})

describe('Historique des sessions (A14)', () => {
  it('écart figé à la clôture ; une session en cours n’en a pas', () => {
    const { db } = semaine()
    // Afi : fond 10 000 + 8 200 en espèces = 18 200 attendus ; elle compte 18 000.
    cloturerSession(db, AFI, { montantCompte: 18000, commentaire: 'Monnaie rendue en trop ?' })
    const r = historiqueSessions(db, {})
    expect(r.lignes).toHaveLength(2)
    const [kossi, afi] = r.lignes
    expect(kossi).toMatchObject({
      caissier: 'Kossi',
      dateFermeture: null,
      montantTheorique: null,
      ecart: null
    })
    expect(afi).toMatchObject({
      caissier: 'Afi',
      fondOuverture: 10000,
      montantTheorique: 18200,
      montantCompte: 18000,
      ecart: -200,
      commentaire: 'Monnaie rendue en trop ?'
    })
    expect(afi.dateFermeture).not.toBeNull()
    expect(r.totalEcarts).toBe(-200)
    expect(r.nbCloturees).toBe(1)
  })

  it('une session ouverte avant la période est hors liste', () => {
    const { db } = semaine()
    executer(
      db,
      "UPDATE sessions_caisse SET date_ouverture = datetime('now','localtime','-3 day') WHERE utilisateur_id = ?",
      AFI.id
    )
    const r = historiqueSessions(db, { du: jour(db), au: jour(db) })
    expect(r.lignes.map((l) => l.caissier)).toEqual(['Kossi'])
  })

  it('aucune session : liste vide, écarts à 0', () => {
    const db = baseAvecDemo()
    expect(historiqueSessions(db, {})).toMatchObject({ lignes: [], totalEcarts: 0, nbCloturees: 0 })
  })
})
