import { describe, expect, it } from 'vitest'
import { stockProduit } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { toutes, une } from '../src/main/db/requetes'
import { lignesTicket } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket, consulterTicket } from '../src/main/modules/caisse/service-annulation'
import { cloturerSession, rapportSession } from '../src/main/modules/caisse/service-cloture'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket, ouvrirTiroirPour } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const CODE_KOSSI = '5678'
const TOMATE = 3
const BAGUETTE = 5

const CARTON = '16181000000049' // 7 500 F
const UNITE = '6181000000042' // 350 F
const PLU_BAGUETTE = '101' // 300 F

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/**
 * Vente de démo d'Afi : 1 carton + 2 unités de tomate + 1 baguette = 8 500 F, payée 5 000 F en TMoney
 * et 3 500 F en espèces. Tomate 72 → 46, baguette 40 → 39.
 */
function venteAfi(): { db: Db; sessionId: number; numero: string; venteId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  const v = enregistrerVente(db, AFI.id, {
    lignes: [
      { conditionnementId: id(db, CARTON), quantite: 1 },
      { conditionnementId: id(db, UNITE), quantite: 2 },
      { conditionnementId: id(db, PLU_BAGUETTE), quantite: 1 }
    ],
    paiements: [
      { mode: 'tmoney', montant: 5000, reference: 'TM-0042' },
      { mode: 'especes', montant: 3500 }
    ],
    montantRecu: 5000
  })
  return { db, sessionId, numero: v.numeroTicket, venteId: v.venteId }
}

const journal = (db: Db): { utilisateurId: number; apres: string }[] =>
  toutes(
    db,
    "SELECT utilisateur_id AS utilisateurId, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'annulation_ticket'"
  )

describe('Annulation d’un ticket (A6)', () => {
  it('par le gérant : stock revenu, paiements à 0, ticket hors du X, 3 500 F à rendre', () => {
    const { db, sessionId, numero, venteId } = venteAfi()
    expect(stockProduit(db, TOMATE)).toBe(46)

    const r = annulerTicket(db, KOSSI, { numeroTicket: numero, motif: ' erreur de caisse ' })

    expect(r).toEqual({
      venteId,
      numeroTicket: numero,
      especesARendre: 3500,
      autresARendre: [{ mode: 'tmoney', montant: 5000, reference: 'TM-0042' }],
      tiroirOuvert: false
    })
    expect(une(db, 'SELECT statut, motif_annulation AS motif FROM ventes WHERE id = ?', venteId)).toEqual({
      statut: 'annulee',
      motif: 'erreur de caisse'
    })
    // Le stock revient exactement : une contre-passation par mouvement de la vente.
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(stockProduit(db, BAGUETTE)).toBe(40)
    const contre = toutes<{ motif: string }>(
      db,
      "SELECT motif FROM mouvements_stock WHERE type = 'contre_passation' AND document_type = 'vente' AND document_id = ?",
      venteId
    )
    expect(contre).toHaveLength(3)
    expect(contre[0].motif).toBe(`Annulation du ticket ${numero} : erreur de caisse`)
    // Un paiement inverse par paiement : la somme du ticket revient à 0.
    expect(toutes(db, 'SELECT mode, montant FROM paiements WHERE vente_id = ? ORDER BY id', venteId)).toEqual(
      [
        { mode: 'tmoney', montant: 5000 },
        { mode: 'especes', montant: 3500 },
        { mode: 'tmoney', montant: -5000 },
        { mode: 'especes', montant: -3500 }
      ]
    )
    // Le X ne compte plus le ticket : les espèces théoriques reviennent au fond.
    expect(rapportSession(db, sessionId)).toMatchObject({
      nombreTickets: 0,
      totauxParMode: { especes: 0, tmoney: 0, flooz: 0, credit: 0 },
      totalVentes: 0,
      especesTheoriques: 10000
    })
    const [entree] = journal(db)
    expect(entree.utilisateurId).toBe(KOSSI.id)
    expect(JSON.parse(entree.apres)).toEqual({
      numeroTicket: numero,
      montant: 8500,
      motif: 'erreur de caisse'
    })
  })

  it('par la caissière, avec le code du gérant : le journal note qui a autorisé', () => {
    const { db, numero } = venteAfi()
    annulerTicket(db, AFI, {
      numeroTicket: numero,
      motif: 'client a changé d’avis',
      autorisation: { utilisateurId: KOSSI.id, code: CODE_KOSSI }
    })
    const [entree] = journal(db)
    expect(entree.utilisateurId).toBe(AFI.id)
    expect(JSON.parse(entree.apres)).toMatchObject({ autoriseeParId: KOSSI.id })
  })

  it('caissière sans accord, avec un compte qui n’est pas gérant ou un code faux : refus, ticket intact', () => {
    const { db, numero, venteId } = venteAfi()
    expect(() => annulerTicket(db, AFI, { numeroTicket: numero, motif: 'x' })).toThrow(/accord du gérant/)
    expect(() =>
      annulerTicket(db, AFI, {
        numeroTicket: numero,
        motif: 'x',
        autorisation: { utilisateurId: AFI.id, code: '0000' }
      })
    ).toThrow(/Seul un gérant/)
    expect(() =>
      annulerTicket(db, AFI, {
        numeroTicket: numero,
        motif: 'x',
        autorisation: { utilisateurId: KOSSI.id, code: '1111' }
      })
    ).toThrow()
    // Le code faux reste compté : il a été vérifié hors de la transaction d'annulation.
    expect(
      une<{ n: number }>(db, 'SELECT echecs_consecutifs AS n FROM utilisateurs WHERE id = ?', KOSSI.id)!.n
    ).toBe(1)
    expect(une<{ s: string }>(db, 'SELECT statut AS s FROM ventes WHERE id = ?', venteId)!.s).toBe('terminee')
    expect(stockProduit(db, TOMATE)).toBe(46)
  })

  it('refus : motif vide, ticket inconnu, déjà annulé', () => {
    const { db, numero } = venteAfi()
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: numero, motif: '  ' })).toThrow(/motif/)
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: 'T-2026-999999', motif: 'x' })).toThrow(
      /introuvable/
    )
    annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'erreur' })
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'encore' })).toThrow(/déjà annulé/)
    expect(stockProduit(db, TOMATE)).toBe(72)
  })

  it('caisse clôturée : refus, on passe par le retour client ; le Z ne bouge pas', () => {
    const { db, sessionId, numero } = venteAfi()
    cloturerSession(db, AFI, { montantCompte: 13500 })
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'x' })).toThrow(
      /caisse déjà clôturée : faites un retour client/
    )
    expect(rapportSession(db, sessionId)).toMatchObject({ nombreTickets: 1, totalVentes: 8500, ecart: 0 })
  })

  it('la caissière n’annule pas un ticket d’une autre caisse, même avec le code', () => {
    const db = baseAvecDemo()
    ouvrirSession(db, AFI.id, 10000)
    ouvrirSession(db, KOSSI.id, 5000)
    const v = enregistrerVente(db, KOSSI.id, {
      lignes: [{ conditionnementId: id(db, PLU_BAGUETTE), quantite: 1 }],
      paiements: [{ mode: 'especes', montant: 300 }]
    })
    expect(() =>
      annulerTicket(db, AFI, {
        numeroTicket: v.numeroTicket,
        motif: 'x',
        autorisation: { utilisateurId: KOSSI.id, code: CODE_KOSSI }
      })
    ).toThrow(/pas de votre caisse/)
    // Refusé avant de demander le code : aucun essai n'est compté.
    expect(
      une<{ n: number }>(db, 'SELECT echecs_consecutifs AS n FROM utilisateurs WHERE id = ?', KOSSI.id)!.n
    ).toBe(0)
  })

  it('ticket payé seulement en mobile money : rien à rendre en espèces', () => {
    const db = baseAvecDemo()
    ouvrirSession(db, AFI.id, 10000)
    const v = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, PLU_BAGUETTE), quantite: 2 }],
      paiements: [{ mode: 'flooz', montant: 600, reference: 'FL-9' }]
    })
    const r = annulerTicket(db, KOSSI, { numeroTicket: v.numeroTicket, motif: 'doublon' })
    expect(r.especesARendre).toBe(0)
    expect(r.autresARendre).toEqual([{ mode: 'flooz', montant: 600, reference: 'FL-9' }])
  })
})

describe('Consultation et réimpression d’un ticket annulé', () => {
  it('consulterTicket : contenu, espèces à rendre, et la raison d’un refus', () => {
    const { db, numero } = venteAfi()
    const t = consulterTicket(db, KOSSI, numero)
    expect(t).toMatchObject({
      numeroTicket: numero,
      caissier: 'Afi',
      totalTtc: 8500,
      especesARendre: 3500,
      statut: 'terminee',
      raisonRefus: null
    })
    expect(t.lignes).toHaveLength(3)
    annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'erreur' })
    expect(consulterTicket(db, KOSSI, numero)).toMatchObject({
      statut: 'annulee',
      motifAnnulation: 'erreur',
      // Les paiements inverses ne s'affichent pas.
      paiements: [
        { mode: 'tmoney', montant: 5000, reference: 'TM-0042' },
        { mode: 'especes', montant: 3500, reference: null }
      ],
      raisonRefus: `Le ticket ${numero} est déjà annulé.`
    })
  })

  it('réimprimé : « TICKET ANNULÉ » et le motif, paiements d’origine, jamais de tiroir', () => {
    const { db, numero, venteId } = venteAfi()
    annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'erreur de caisse' })
    const ticket = lireTicket(db, venteId)
    expect(ticket.annulation).toEqual({ motif: 'erreur de caisse' })
    expect(ticket.paiements.map((p) => p.montant)).toEqual([5000, 3500])
    expect(ouvrirTiroirPour(ticket, false)).toBe(false)
    const textes = lignesTicket(
      ticket,
      { nom: 'MA BOUTIQUE', adresse: [], pied: 'Merci' },
      { duplicata: true }
    ).map((l) => l.texte)
    expect(textes).toContain('TICKET ANNULÉ')
    expect(textes).toContain('Motif : erreur de caisse')
  })
})
