import { describe, expect, it } from 'vitest'
import { stockProduit } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { htmlFacture } from '../src/main/documents/facture'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { rapportSession } from '../src/main/modules/caisse/service-cloture'
import {
  dejaEditee,
  facturer,
  lireFacture,
  noterEdition,
  trouverFacture,
  verifierEdition
} from '../src/main/modules/caisse/service-facture'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { lireParametres } from '../src/main/modules/parametres/service'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const TOMATE = 3
const ANNEE = new Date().getFullYear()

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/**
 * Ticket de lundi : carton 7 500 + lot de 3 1 000 + 2 unités 700 + jus 600 (18 %) et baguette 300 (0 %)
 * = 10 100 F, payé 5 000 F en TMoney et 5 100 F en espèces.
 * TVA : 9 800 F à 18 % → HT 8 305, TVA 1 495 ; 300 F à 0 %. Total HT 8 605.
 */
function lundi(): { db: Db; sessionId: number; numero: string; venteId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  const v = enregistrerVente(db, AFI.id, {
    lignes: [
      { conditionnementId: id(db, '16181000000049'), quantite: 1 },
      { conditionnementId: id(db, '2000000000015'), quantite: 1 },
      { conditionnementId: id(db, '6181000000042'), quantite: 2 },
      { conditionnementId: id(db, '101'), quantite: 1 },
      { conditionnementId: id(db, '6034000012345'), quantite: 1 }
    ],
    paiements: [
      { mode: 'tmoney', montant: 5000, reference: 'TM-42' },
      { mode: 'especes', montant: 5100 }
    ]
  })
  return { db, sessionId, numero: v.numeroTicket, venteId: v.venteId }
}

const CLIENT = { nom: ' Sarl Agbodjan ', telephone: '90 00 00 00', adresse: 'Bè, Lomé', nif: '1000123456' }

describe('Facture d’un ticket (A10)', () => {
  it('facture du ticket de lundi : numéro F, client recopié, ni stock ni caisse touchés', () => {
    const { db, sessionId, numero, venteId } = lundi()
    const stockAvant = stockProduit(db, TOMATE)
    const xAvant = rapportSession(db, sessionId)

    const f = facturer(db, AFI, { numeroTicket: numero, client: CLIENT })

    expect(f).toEqual({ factureId: f.factureId, numero: `F-${ANNEE}-000001`, numeroTicket: numero })
    expect(
      une(
        db,
        `SELECT vente_id AS venteId, client_nom AS nom, client_telephone AS tel, client_adresse AS adresse,
                client_nif AS nif, utilisateur_id AS auteur FROM factures WHERE id = ?`,
        f.factureId
      )
    ).toEqual({
      venteId,
      nom: 'Sarl Agbodjan',
      tel: '90 00 00 00',
      adresse: 'Bè, Lomé',
      nif: '1000123456',
      auteur: AFI.id
    })
    expect(stockProduit(db, TOMATE)).toBe(stockAvant)
    expect(rapportSession(db, sessionId)).toEqual(xAvant)
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM ventes')!.n).toBe(1)

    const [journal] = toutes<{ apres: string }>(
      db,
      "SELECT nouvelle_valeur AS apres FROM journal_audit WHERE action = 'facture'"
    )
    expect(JSON.parse(journal.apres)).toEqual({
      numero: `F-${ANNEE}-000001`,
      numeroTicket: numero,
      client: 'Sarl Agbodjan',
      montant: 10100
    })
  })

  it('données imprimées : lignes, TVA par taux (HT 8 305 + 300, TVA 1 495), paiements, NIF de la boutique', () => {
    const { db, numero } = lundi()
    executer(db, "INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('boutique_nif', '1000999888')")
    const { factureId } = facturer(db, KOSSI, { numeroTicket: numero, client: { nom: 'Mme Abra' } })
    const d = lireFacture(db, factureId, lireParametres(db))
    expect(d).toMatchObject({
      numeroTicket: numero,
      caissier: 'Afi',
      boutique: { nif: '1000999888' },
      client: { nom: 'Mme Abra', telephone: null, adresse: null, nif: null },
      totalTtc: 10100,
      parTaux: [
        { taux: 18, ttc: 9800, ht: 8305, tva: 1495 },
        { taux: 0, ttc: 300, ht: 300, tva: 0 }
      ],
      paiements: [
        { mode: 'tmoney', montant: 5000, reference: 'TM-42' },
        { mode: 'especes', montant: 5100, reference: null }
      ],
      retours: [],
      netPaye: 10100
    })
    expect(d.lignes).toHaveLength(5)

    const html = htmlFacture(d, { copie: false })
    expect(html).toContain('FACTURE')
    expect(html).toContain(`F-${ANNEE}-000001`)
    expect(html).toContain('NIF : 1000999888')
    expect(html).toContain('Mme Abra')
    expect(html).toContain('<strong>Payée</strong>')
    expect(html).toContain('Dix mille cent francs CFA')
    expect(html).not.toContain('COPIE')
    expect(htmlFacture(d, { copie: true })).toContain('COPIE')
  })

  it('ticket avec un retour : section Retours et net payé (10 100 − 600 = 9 500)', () => {
    const { db, numero } = lundi()
    const jus = consulterRetour(db, KOSSI, numero).lignes.find((l) => l.designation.includes('ananas'))!
    enregistrerRetour(db, AFI, {
      numeroTicket: numero,
      lignes: [{ ligneId: jus.ligneId, quantite: 1 }],
      motif: 'defectueux',
      sort: 'detruire',
      remboursement: { mode: 'especes' },
      autorisation: { utilisateurId: KOSSI.id, code: '5678' }
    })
    const { factureId } = facturer(db, AFI, { numeroTicket: numero, client: { nom: 'Mme Abra' } })
    const d = lireFacture(db, factureId, lireParametres(db))
    expect(d.retours).toEqual([
      {
        numero: `R-${ANNEE}-000001`,
        horodatage: d.retours[0].horodatage,
        total: -600,
        lignes: [{ designation: expect.stringContaining('ananas'), quantite: 1, totalLigne: -600 }]
      }
    ])
    expect(d.netPaye).toBe(9500)
    const html = htmlFacture(d, { copie: false })
    expect(html).toContain('Net payé')
    expect(html).toContain('Neuf mille cinq cents francs CFA')
  })

  it('le nom du client est échappé dans le HTML', () => {
    const { db, numero } = lundi()
    const { factureId } = facturer(db, AFI, { numeroTicket: numero, client: { nom: '<script>x</script>' } })
    const html = htmlFacture(lireFacture(db, factureId, lireParametres(db)), { copie: false })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('Refus et recherche', () => {
  const rien = (db: Db): void => {
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM factures')!.n).toBe(0)
    expect(une(db, "SELECT dernier FROM sequences WHERE prefixe LIKE 'F-%'")).toBeUndefined()
  }

  it('nom manquant, ticket inconnu, ticket annulé, retour', () => {
    const { db, numero } = lundi()
    expect(() => facturer(db, AFI, { numeroTicket: numero, client: { nom: '  ' } })).toThrow(/nom du client/)
    expect(() => facturer(db, AFI, { numeroTicket: 'T-2026-999999', client: CLIENT })).toThrow(/introuvable/)
    expect(() =>
      facturer(db, AFI, { numeroTicket: numero, client: { ...CLIENT, adresse: 'x'.repeat(121) } })
    ).toThrow(/Adresse trop long/)
    annulerTicket(db, KOSSI, { numeroTicket: numero, motif: 'erreur' })
    expect(() => facturer(db, AFI, { numeroTicket: numero, client: CLIENT })).toThrow(/annulé/)
    rien(db)
  })

  it('ticket entièrement retourné, document de retour', () => {
    const db = baseAvecDemo()
    ouvrirSession(db, AFI.id, 10000)
    const v = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, '101'), quantite: 1 }],
      paiements: [{ mode: 'especes', montant: 300 }]
    })
    const r = enregistrerRetour(db, AFI, {
      numeroTicket: v.numeroTicket,
      lignes: [{ ligneId: consulterRetour(db, AFI, v.numeroTicket).lignes[0].ligneId, quantite: 1 }],
      motif: 'erreur_article',
      sort: 'remettre_en_stock',
      remboursement: { mode: 'especes' },
      autorisation: { utilisateurId: KOSSI.id, code: '5678' }
    })
    expect(() => facturer(db, AFI, { numeroTicket: v.numeroTicket, client: CLIENT })).toThrow(
      /rien à facturer/
    )
    expect(() => facturer(db, AFI, { numeroTicket: r.numeroRetour, client: CLIENT })).toThrow(
      /n’est pas un ticket de vente/
    )
    rien(db)
  })

  it('une seule facture par ticket ; on la retrouve par le ticket (court) ou par son numéro', () => {
    const { db, numero } = lundi()
    const f = facturer(db, AFI, { numeroTicket: '1', client: CLIENT })
    expect(f.numeroTicket).toBe(numero)
    expect(() => facturer(db, KOSSI, { numeroTicket: numero, client: CLIENT })).toThrow(
      new RegExp(`déjà la facture ${f.numero} : rééditez-la`)
    )
    expect(trouverFacture(db, numero)).toEqual(f)
    expect(trouverFacture(db, ' 1 ')).toEqual(f)
    expect(trouverFacture(db, f.numero.toLowerCase())).toEqual(f)
    expect(trouverFacture(db, 'F-2026-999999')).toBeNull()

    const { db: db2, numero: n2 } = lundi()
    expect(trouverFacture(db2, n2)).toBeNull()
  })
})

describe('Original puis COPIE', () => {
  it('la première sortie réussie de chaque sorte est l’original', () => {
    const { db, numero } = lundi()
    const { factureId } = facturer(db, AFI, { numeroTicket: numero, client: CLIENT })
    expect(dejaEditee(db, factureId, 'enregistrer')).toBe(false)
    noterEdition(db, AFI.id, factureId, 'enregistrer', false)
    expect(dejaEditee(db, factureId, 'enregistrer')).toBe(true)
    // L'impression de l'original reste possible après l'enregistrement du PDF.
    expect(dejaEditee(db, factureId, 'imprimer')).toBe(false)
  })

  it('identifiant manquant ou sorte inconnue : message clair, pas d’erreur interne', () => {
    const { db } = lundi()
    expect(() => verifierEdition(undefined, 'enregistrer')).toThrow(/Facture introuvable/)
    expect(() => verifierEdition(1, 'faxer')).toThrow(/Enregistrer le PDF/)
    expect(() => verifierEdition(1, 'imprimer')).not.toThrow()
    expect(() => lireFacture(db, undefined as never, lireParametres(db))).toThrow(/Facture introuvable/)
    expect(() => lireFacture(db, 999, lireParametres(db))).toThrow(/Facture introuvable/)
  })
})
