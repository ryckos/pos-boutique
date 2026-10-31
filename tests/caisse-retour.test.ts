import { describe, expect, it } from 'vitest'
import { enregistrerMouvement, stockProduit } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { lignesRapport } from '../src/main/materiel/rapport'
import { lignesTicket } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { rapportSession } from '../src/main/modules/caisse/service-cloture'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket, ouvrirTiroirPour } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RequeteRetour, RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const ACCORD_KOSSI = { utilisateurId: KOSSI.id, code: '5678' }
const ADMIN = 1
const LAIT = 2
const TOMATE = 3
const JUS = 4

const CARTON = '16181000000049' // 7 500 F
const LOT_DE_3 = '2000000000015' // 1 000 F
const UNITE = '6181000000042' // 350 F
const PLU_BAGUETTE = '101' // 300 F
const CODE_JUS = '6034000012345' // 600 F
const CODE_LAIT = '6181000000028' // 2 800 F

const ANNEE = new Date().getFullYear()
const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/**
 * Lundi 10 h du scénario : Afi ouvre avec 10 000 F, ticket de 10 100 F payé en espèces (carton, lot de
 * 3, 2 unités de tomate, baguette, jus d'ananas). Tomate 72 → 43, jus 18 → 17.
 */
function lundi(): { db: Db; sessionId: number; numero: string; venteId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  const v = enregistrerVente(db, AFI.id, {
    lignes: [
      { conditionnementId: id(db, CARTON), quantite: 1 },
      { conditionnementId: id(db, LOT_DE_3), quantite: 1 },
      { conditionnementId: id(db, UNITE), quantite: 2 },
      { conditionnementId: id(db, PLU_BAGUETTE), quantite: 1 },
      { conditionnementId: id(db, CODE_JUS), quantite: 1 }
    ],
    paiements: [{ mode: 'especes', montant: 10100 }]
  })
  return { db, sessionId, numero: v.numeroTicket, venteId: v.venteId }
}

/** La ligne du ticket dont la désignation contient `texte`. */
const ligne = (db: Db, numero: string, texte: string): number =>
  consulterRetour(db, KOSSI, numero).lignes.find((l) => l.designation.includes(texte))!.ligneId

const demande = (
  numero: string,
  lignes: RequeteRetour['lignes'],
  autres: Partial<RequeteRetour> = {}
): RequeteRetour => ({
  numeroTicket: numero,
  lignes,
  motif: 'defectueux',
  sort: 'detruire',
  remboursement: { mode: 'especes' },
  autorisation: ACCORD_KOSSI,
  ...autres
})

const mouvementsRetour = (
  db: Db,
  retourId: number
): { type: string; lotId: number | null; quantite: number }[] =>
  toutes(
    db,
    `SELECT type, lot_id AS lotId, quantite FROM mouvements_stock
     WHERE document_type = 'vente' AND document_id = ? ORDER BY id`,
    retourId
  )

describe('Retour client (A7) — jeudi du scénario', () => {
  it('jus défectueux du ticket de lundi, détruit, remboursé 600 F en espèces', () => {
    const { db, sessionId, numero, venteId } = lundi()
    const jus = ligne(db, numero, 'ananas')

    const r = enregistrerRetour(db, AFI, demande(numero, [{ ligneId: jus, quantite: 1 }]))

    expect(r).toEqual({
      venteId: r.venteId,
      numeroRetour: `R-${ANNEE}-000001`,
      numeroTicketOrigine: numero,
      montant: 600,
      mode: 'especes',
      avoir: null,
      tiroirOuvert: false
    })
    // Un ticket de type retour lié au ticket d'origine, en négatif (600 F à 18 % : HT 508, TVA 92).
    expect(
      une(
        db,
        `SELECT type, statut, vente_origine_id AS origine, total_ttc AS ttc, total_ht AS ht, total_tva AS tva,
                motif_retour AS motif, sort_retour AS sort, session_caisse_id AS session
         FROM ventes WHERE id = ?`,
        r.venteId
      )
    ).toEqual({
      type: 'retour',
      statut: 'terminee',
      origine: venteId,
      ttc: -600,
      ht: -508,
      tva: -92,
      motif: 'Produit défectueux',
      sort: 'detruire',
      session: sessionId
    })
    expect(toutes(db, 'SELECT mode, montant FROM paiements WHERE vente_id = ?', r.venteId)).toEqual([
      { mode: 'especes', montant: -600 }
    ])
    // retour_client (+1) puis casse (−1), sur le lot vendu : le stock du jus ne bouge pas.
    const lotJus = une<{ id: number }>(db, 'SELECT id FROM lots WHERE produit_id = ?', JUS)!.id
    expect(mouvementsRetour(db, r.venteId)).toEqual([
      { type: 'retour_client', lotId: lotJus, quantite: 1 },
      { type: 'casse', lotId: lotJus, quantite: -1 }
    ])
    expect(stockProduit(db, JUS)).toBe(17)

    // Le ticket d'origine n'est pas modifié.
    expect(une(db, 'SELECT statut, total_ttc AS ttc FROM ventes WHERE id = ?', venteId)).toEqual({
      statut: 'terminee',
      ttc: 10100
    })
    expect(toutes(db, 'SELECT montant FROM paiements WHERE vente_id = ?', venteId)).toEqual([
      { montant: 10100 }
    ])

    // X : 10 000 + 10 100 − 600 = 19 500 ; les ventes restent à 10 100, le retour est à part.
    expect(rapportSession(db, sessionId)).toMatchObject({
      nombreTickets: 1,
      totalVentes: 10100,
      totauxParMode: { especes: 10100 },
      remboursements: { nombre: 1, especes: 600, tmoney: 0, flooz: 0, total: 600 },
      especesTheoriques: 19500
    })

    const [journal] = toutes<{ u: number; apres: string }>(
      db,
      "SELECT utilisateur_id AS u, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'retour_client'"
    )
    expect(journal.u).toBe(AFI.id)
    expect(JSON.parse(journal.apres)).toEqual({
      numeroRetour: `R-${ANNEE}-000001`,
      ticketOrigine: numero,
      montant: 600,
      mode: 'especes',
      motif: 'Produit défectueux',
      sort: 'detruire',
      autoriseeParId: KOSSI.id
    })
  })

  it('carton de tomate remis en stock : 24 boîtes reviennent (43 → 67), aucune casse', () => {
    const { db, numero } = lundi()
    expect(stockProduit(db, TOMATE)).toBe(43)
    const r = enregistrerRetour(
      db,
      AFI,
      demande(numero, [{ ligneId: ligne(db, numero, 'Carton'), quantite: 1 }], {
        motif: 'erreur_article',
        sort: 'remettre_en_stock'
      })
    )
    expect(r.montant).toBe(7500)
    expect(stockProduit(db, TOMATE)).toBe(67)
    expect(mouvementsRetour(db, r.venteId)).toEqual([{ type: 'retour_client', lotId: null, quantite: 24 }])
    expect(
      une(
        db,
        'SELECT quantite, quantite_base_totale AS base, total_ligne AS total FROM lignes_vente WHERE vente_id = ?',
        r.venteId
      )
    ).toEqual({ quantite: 1, base: 24, total: -7500 })
  })

  it('remboursement TMoney : référence obligatoire, le tiroir ne bouge pas', () => {
    const { db, sessionId, numero } = lundi()
    const jus = [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }]
    expect(() =>
      enregistrerRetour(db, AFI, demande(numero, jus, { remboursement: { mode: 'tmoney' } }))
    ).toThrow(/référence du transfert TMoney/)
    enregistrerRetour(
      db,
      AFI,
      demande(numero, jus, { remboursement: { mode: 'tmoney', reference: ' TM-77 ' } })
    )
    expect(rapportSession(db, sessionId)).toMatchObject({
      remboursements: { nombre: 1, especes: 0, tmoney: 600, total: 600 },
      especesTheoriques: 20100
    })
  })
})

describe('Quantités et montants rendus', () => {
  /** Kossi vend : il n'a pas de plafond de remise. */
  function venteKossi(requete: (db: Db) => RequeteVente): { db: Db; numero: string } {
    const db = baseAvecDemo()
    ouvrirSession(db, KOSSI.id, 20000)
    return { db, numero: enregistrerVente(db, KOSSI.id, requete(db)).numeroTicket }
  }

  it('3 unités remisées de 100 F (950 F payés) rendues une à une : 316 + 316 + 318, puis plus rien', () => {
    const { db, numero } = venteKossi((db) => ({
      lignes: [{ conditionnementId: id(db, UNITE), quantite: 3, remise: 100 }],
      paiements: [{ mode: 'especes', montant: 950 }]
    }))
    const tomate = ligne(db, numero, 'Tomate')
    const un = (): number =>
      enregistrerRetour(db, KOSSI, demande(numero, [{ ligneId: tomate, quantite: 1 }])).montant

    expect(un()).toBe(316)
    expect(() => enregistrerRetour(db, KOSSI, demande(numero, [{ ligneId: tomate, quantite: 3 }]))).toThrow(
      /pas rendre plus que vendu \(encore 2 au plus\)/
    )
    expect(un()).toBe(316)
    expect(un()).toBe(318)
    // Ligne entièrement rendue : exactement ce qui a été payé.
    expect(consulterRetour(db, KOSSI, numero)).toMatchObject({
      lignes: [
        {
          quantiteVendue: 3,
          quantiteDejaRetournee: 3,
          montantPaye: 950,
          montantDejaRembourse: 950,
          totalLigne: 0
        }
      ],
      retoursPrecedents: [`R-${ANNEE}-000001`, `R-${ANNEE}-000002`, `R-${ANNEE}-000003`],
      raisonRefus: `Tous les articles du ticket ${numero} ont déjà été retournés.`
    })
    expect(() => un()).toThrow(/déjà été retournés/)
    // Détruites : revenues puis sorties en casse, le stock reste à 72 − 3.
    expect(stockProduit(db, TOMATE)).toBe(69)
  })

  it('remise sur le ticket : chaque ligne rend sa part (8 100 F − 810 F → jus 540 F)', () => {
    const { db, numero } = venteKossi((db) => ({
      lignes: [
        { conditionnementId: id(db, CARTON), quantite: 1 },
        { conditionnementId: id(db, CODE_JUS), quantite: 1 }
      ],
      remiseGlobale: 810,
      paiements: [{ mode: 'especes', montant: 7290 }]
    }))
    const t = consulterRetour(db, KOSSI, numero)
    expect(t.lignes.map((l) => l.montantPaye)).toEqual([6750, 540])
    expect(
      enregistrerRetour(db, KOSSI, demande(numero, [{ ligneId: t.lignes[1].ligneId, quantite: 1 }])).montant
    ).toBe(540)
    // Remise d'origine non rendue, gardée sur la ligne du retour : 600 − 540.
    expect(
      une(
        db,
        "SELECT remise_ligne AS r FROM lignes_vente WHERE designation LIKE '%ananas%' AND total_ligne < 0"
      )
    ).toEqual({
      r: 60
    })
  })
})

describe('Lots (FEFO, A9)', () => {
  /** Lot qui périme dans `jours` jours, avec `quantite` boîtes de lait. */
  function ajouterLot(db: Db, numero: string, jours: number, quantite: number): number {
    const lotId = executer(
      db,
      `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire)
       VALUES (?, ?, date('now','localtime', ?), 2100)`,
      LAIT,
      numero,
      `${jours} days`
    ).id
    enregistrerMouvement(db, {
      produitId: LAIT,
      lotId,
      type: 'reception',
      quantite,
      coutUnitaire: 2100,
      utilisateurId: ADMIN
    })
    return lotId
  }

  it('11 boîtes vendues (9 de LOT-A12, 2 de LOT-B03), 3 rendues : le dernier lot servi d’abord', () => {
    const db = baseAvecDemo()
    const demoLot = une<{ id: number }>(
      db,
      "SELECT id FROM lots WHERE produit_id = ? AND numero_lot = 'DEMO-01'",
      LAIT
    )!.id
    enregistrerMouvement(db, {
      produitId: LAIT,
      lotId: demoLot,
      type: 'casse',
      quantite: -12,
      coutUnitaire: 2100,
      utilisateurId: ADMIN
    })
    const b03 = ajouterLot(db, 'LOT-B03', 60, 12)
    const a12 = ajouterLot(db, 'LOT-A12', 8, 9)
    ouvrirSession(db, AFI.id, 50000)
    const v = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, CODE_LAIT), quantite: 11 }],
      paiements: [{ mode: 'especes', montant: 30800 }]
    })
    const lait = consulterRetour(db, AFI, v.numeroTicket).lignes[0].ligneId

    const r = enregistrerRetour(
      db,
      AFI,
      demande(v.numeroTicket, [{ ligneId: lait, quantite: 3 }], { sort: 'remettre_en_stock' })
    )
    expect(mouvementsRetour(db, r.venteId)).toEqual([
      { type: 'retour_client', lotId: b03, quantite: 2 },
      { type: 'retour_client', lotId: a12, quantite: 1 }
    ])
    // Deux lots : la ligne n'en porte aucun, les mouvements font foi.
    expect(une(db, 'SELECT lot_id AS lot FROM lignes_vente WHERE vente_id = ?', r.venteId)).toEqual({
      lot: null
    })

    // Le retour suivant ne reprend que ce qui reste vendu : 8 boîtes de LOT-A12.
    const r2 = enregistrerRetour(db, AFI, demande(v.numeroTicket, [{ ligneId: lait, quantite: 8 }]))
    expect(mouvementsRetour(db, r2.venteId)).toEqual([
      { type: 'retour_client', lotId: a12, quantite: 8 },
      { type: 'casse', lotId: a12, quantite: -8 }
    ])
  })
})

describe('Refus : rien n’est écrit, aucun numéro n’est consommé', () => {
  const rien = (db: Db): void => {
    expect(une<{ n: number }>(db, "SELECT COUNT(*) AS n FROM ventes WHERE type = 'retour'")!.n).toBe(0)
    expect(une(db, "SELECT dernier FROM sequences WHERE prefixe LIKE 'R-%'")).toBeUndefined()
  }

  it('motif, précision, sort, mode, lignes', () => {
    const { db, numero } = lundi()
    const jus = [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }]
    expect(() => enregistrerRetour(db, AFI, demande(numero, jus, { motif: 'autre' }))).toThrow(
      /précisez la raison/
    )
    expect(() => enregistrerRetour(db, AFI, demande(numero, jus, { sort: 'x' as never }))).toThrow(
      /sort du produit/
    )
    expect(() =>
      enregistrerRetour(db, AFI, demande(numero, jus, { remboursement: { mode: 'constructor' as never } }))
    ).toThrow(/espèces, TMoney ou Flooz/)
    expect(() => enregistrerRetour(db, AFI, demande(numero, []))).toThrow(/Cochez au moins un article/)
    expect(() => enregistrerRetour(db, AFI, demande(numero, [{ ...jus[0], quantite: 0 }]))).toThrow(
      /Quantité/
    )
    expect(() => enregistrerRetour(db, AFI, demande(numero, [{ ...jus[0], quantite: 2 }]))).toThrow(
      /pas rendre plus que vendu \(encore 1 au plus\)/
    )
    expect(() => enregistrerRetour(db, AFI, demande(numero, [{ ligneId: 99999, quantite: 1 }]))).toThrow(
      /n’est pas sur le ticket/
    )
    rien(db)
  })

  it('« Autre » avec sa précision est accepté', () => {
    const { db, numero } = lundi()
    const r = enregistrerRetour(
      db,
      AFI,
      demande(numero, [{ ligneId: ligne(db, numero, 'Baguette'), quantite: 1 }], {
        motif: 'autre',
        precision: ' pain rassis '
      })
    )
    expect(une(db, 'SELECT motif_retour AS m FROM ventes WHERE id = ?', r.venteId)).toEqual({
      m: 'Autre : pain rassis'
    })
  })

  it('ticket annulé, retour d’un retour, ticket inconnu', () => {
    const { db, numero } = lundi()
    const jus = ligne(db, numero, 'ananas')
    const r = enregistrerRetour(db, AFI, demande(numero, [{ ligneId: jus, quantite: 1 }]))
    expect(() =>
      enregistrerRetour(db, AFI, demande(r.numeroRetour, [{ ligneId: jus, quantite: 1 }]))
    ).toThrow(/n’est pas un ticket de vente/)
    expect(() => consulterRetour(db, AFI, 'T-2026-999999')).toThrow(/introuvable/)

    const { db: db2, numero: n2 } = lundi()
    annulerTicket(db2, KOSSI, { numeroTicket: n2, motif: 'erreur' })
    expect(consulterRetour(db2, AFI, n2).raisonRefus).toBe(
      `Le ticket ${n2} est annulé : il n’y a rien à retourner.`
    )
    expect(() => enregistrerRetour(db2, AFI, demande(n2, [{ ligneId: 1, quantite: 1 }]))).toThrow(
      /est annulé/
    )
    rien(db2)
  })

  it('pas de caisse ouverte pour celui qui fait le retour', () => {
    const { db, numero } = lundi()
    expect(consulterRetour(db, KOSSI, numero).raisonRefus).toMatch(/Ouvrez votre caisse/)
    expect(() =>
      enregistrerRetour(db, KOSSI, demande(numero, [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }]))
    ).toThrow(/Ouvrez votre caisse/)
    rien(db)
  })

  it('espèces au-delà du tiroir : refus, il faut rembourser par mobile money', () => {
    const db = baseAvecDemo()
    ouvrirSession(db, AFI.id, 0)
    const v = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, CODE_JUS), quantite: 1 }],
      paiements: [{ mode: 'flooz', montant: 600, reference: 'FL-1' }]
    })
    const jus = [{ ligneId: ligne(db, v.numeroTicket, 'ananas'), quantite: 1 }]
    expect(() => enregistrerRetour(db, AFI, demande(v.numeroTicket, jus))).toThrow(
      /Il n’y a que 0 F en caisse|Remboursez par TMoney ou Flooz/
    )
    rien(db)
  })

  it('caissière sans le code du gérant, ou avec un code faux (compté)', () => {
    const { db, numero } = lundi()
    const jus = [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }]
    expect(() => enregistrerRetour(db, AFI, demande(numero, jus, { autorisation: undefined }))).toThrow(
      /Un retour client demande l’accord du gérant/
    )
    expect(() =>
      enregistrerRetour(
        db,
        AFI,
        demande(numero, jus, { autorisation: { utilisateurId: AFI.id, code: '0000' } })
      )
    ).toThrow(/Seul un gérant/)
    expect(() =>
      enregistrerRetour(
        db,
        AFI,
        demande(numero, jus, { autorisation: { utilisateurId: KOSSI.id, code: '1111' } })
      )
    ).toThrow()
    expect(
      une<{ n: number }>(db, 'SELECT echecs_consecutifs AS n FROM utilisateurs WHERE id = ?', KOSSI.id)!.n
    ).toBe(1)
    rien(db)
  })
})

describe('Consultation, numéro court, impression', () => {
  it('« 1 » retrouve T-<année>-000001 ; le mode d’origine est proposé', () => {
    const { db, numero } = lundi()
    expect(numero).toBe(`T-${ANNEE}-000001`)
    expect(consulterRetour(db, AFI, ' 1 ')).toMatchObject({
      numeroTicket: numero,
      caissier: 'Afi',
      totalTtc: 10100,
      paiements: [{ mode: 'especes', montant: 10100, reference: null }],
      retoursPrecedents: [],
      raisonRefus: null
    })
  })

  it('ticket de retour imprimé : RETOUR CLIENT, ticket d’origine, montants négatifs, pas de tiroir à l’impression', () => {
    const { db, sessionId, numero } = lundi()
    const r = enregistrerRetour(
      db,
      AFI,
      demande(numero, [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }])
    )
    const ticket = lireTicket(db, r.venteId)
    expect(ticket).toMatchObject({
      numeroTicket: r.numeroRetour,
      totalTtc: -600,
      parTaux: [{ taux: 18, ttc: -600, ht: -508, tva: -92 }],
      paiements: [{ mode: 'especes', montant: -600, reference: null }],
      retour: { ticketOrigine: numero, motif: 'Produit défectueux', sort: 'Détruire' }
    })
    // Le tiroir s'est ouvert au remboursement (ipc.ts) : pas une seconde fois à l'impression.
    expect(ouvrirTiroirPour(ticket, false)).toBe(false)
    const textes = lignesTicket(
      ticket,
      { nom: 'MA BOUTIQUE', adresse: [], pied: 'Merci' },
      { duplicata: false }
    ).map((l) => l.texte)
    expect(textes).toContain('RETOUR CLIENT')
    expect(textes).toContain(`Sur le ticket ${numero}`)
    expect(textes).toContain('Produit : Détruire')
    expect(textes.some((t) => t.startsWith('Rendu : Espèces') && t.endsWith('-600 F'))).toBe(true)

    const rapport = lignesRapport(
      rapportSession(db, sessionId),
      { nom: 'MA BOUTIQUE', adresse: [], pied: '' },
      {
        type: 'X',
        duplicata: false
      }
    ).map((l) => l.texte)
    expect(rapport).toContain('RETOURS CLIENT (1)')
    expect(rapport.some((t) => t.startsWith('- Remboursements (retours)') && t.endsWith('600 F'))).toBe(true)
  })
})
