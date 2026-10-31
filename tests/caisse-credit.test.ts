import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { lignesTicket, mettreEnPageTicket } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { rapportSession } from '../src/main/modules/caisse/service-cloture'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { ventesPeriode } from '../src/main/modules/caisse/service-rapports'
import { creerClient, desactiverClient, encoursClient } from '../src/main/modules/clients/service'
import { ajouterJours } from '../src/shared/clients'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const ENTETE = { nom: 'Ma Boutique', adresse: ['Lomé'], pied: 'Merci' }

const CARTON = '16181000000049' // 7 500 F
const UNITE = '6181000000042' // 350 F
const JUS = '6034000012345' // 600 F

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId
const aujourdhui = (db: Db): string => une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j

/** 1 carton + 2 unités de tomate + 1 jus = 8 800 F ; avec `sansJus`, 8 200 F. */
function lignes(db: Db, sansJus = false): RequeteVente['lignes'] {
  return [
    { conditionnementId: id(db, CARTON), quantite: 1 },
    { conditionnementId: id(db, UNITE), quantite: 2 },
    ...(sansJus ? [] : [{ conditionnementId: id(db, JUS), quantite: 1 }])
  ]
}

/** Afi a sa caisse ouverte ; Mme Abra a un plafond de 20 000 F. */
function preparer(): { db: Db; abra: number } {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  const abra = creerClient(db, KOSSI, { nom: 'Mme Abra', telephone: '90 00 00 01', plafondCredit: 20000 }).id
  return { db, abra }
}

const aCredit = (db: Db, clientId: number, montant: number, autres: Partial<RequeteVente> = {}) =>
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, UNITE), quantite: montant / 350 }],
    paiements: [{ mode: 'credit', montant }],
    clientId,
    ...autres
  })

describe('Vente à crédit (A11)', () => {
  it('crée la créance à 30 jours, au nom du client, et l’encours monte', () => {
    const { db, abra } = preparer()
    const v = enregistrerVente(db, AFI.id, {
      lignes: lignes(db),
      paiements: [
        { mode: 'especes', montant: 400 },
        { mode: 'credit', montant: 8400 }
      ],
      clientId: abra
    })
    const echeance = ajouterJours(aujourdhui(db), 30)
    expect(v.credit).toEqual({ client: 'Mme Abra', montant: 8400, echeance, encoursApres: 8400 })
    expect(encoursClient(db, abra)).toBe(8400)
    expect(
      une(db, 'SELECT client_id AS clientId, est_credit AS estCredit FROM ventes WHERE id = ?', v.venteId)
    ).toEqual({ clientId: abra, estCredit: 1 })
    expect(
      une(
        db,
        'SELECT montant_initial AS montant, date_echeance AS echeance FROM creances WHERE vente_id = ?',
        v.venteId
      )
    ).toEqual({ montant: 8400, echeance })
    expect(toutes(db, "SELECT id FROM journal_audit WHERE action = 'vente_credit'")).toHaveLength(1)
  })

  it('plafond strict : 8 400 puis 12 000 refusé (20 400 > 20 000), puis 11 550 accepté', () => {
    const { db, abra } = preparer()
    aCredit(db, abra, 8400)
    const avant = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM ventes')!.n
    expect(() => aCredit(db, abra, 12250)).toThrow(
      /Plafond de crédit de « Mme Abra » dépassé : il lui reste 11\s600/
    )
    // Rien d'écrit, aucun numéro consommé.
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM ventes')!.n).toBe(avant)
    expect(toutes(db, 'SELECT id FROM creances')).toHaveLength(1)
    expect(aCredit(db, abra, 11550).credit?.encoursApres).toBe(19950)
    expect(encoursClient(db, abra)).toBe(19950)
  })

  it('l’encours exact au plafond passe', () => {
    const { db, abra } = preparer()
    executer(db, 'UPDATE clients SET plafond_credit = 8400 WHERE id = ?', abra)
    expect(aCredit(db, abra, 8400).credit?.encoursApres).toBe(8400)
  })

  it('refuse : sans client, client sans plafond, désactivé, deux parts à crédit, échéance passée ou invalide', () => {
    const { db, abra } = preparer()
    expect(() =>
      enregistrerVente(db, AFI.id, {
        lignes: lignes(db, true),
        paiements: [{ mode: 'credit', montant: 8200 }]
      })
    ).toThrow(/Choisissez le client/)
    const yao = creerClient(db, AFI, { nom: 'Yao' }).id
    expect(() => aCredit(db, yao, 700)).toThrow(/pas de crédit autorisé/)
    desactiverClient(db, KOSSI, yao, 'Parti')
    expect(() => aCredit(db, yao, 700)).toThrow(/désactivé/)
    expect(() =>
      enregistrerVente(db, AFI.id, {
        lignes: lignes(db, true),
        paiements: [
          { mode: 'credit', montant: 8000 },
          { mode: 'credit', montant: 200 }
        ],
        clientId: abra
      })
    ).toThrow(/Une seule part à crédit/)
    expect(() => aCredit(db, abra, 700, { echeance: ajouterJours(aujourdhui(db), -1) })).toThrow(/passé/)
    expect(() => aCredit(db, abra, 700, { echeance: '2026-02-30' })).toThrow(/invalide/)
    expect(toutes(db, 'SELECT id FROM creances')).toHaveLength(0)
  })

  it('échéance choisie à l’encaissement', () => {
    const { db, abra } = preparer()
    const echeance = ajouterJours(aujourdhui(db), 7)
    expect(aCredit(db, abra, 700, { echeance }).credit?.echeance).toBe(echeance)
  })

  it('X / Z : la part à crédit en « Ventes crédit », hors des espèces théoriques ; comptée dans le CA', () => {
    const { db, abra } = preparer()
    const v = enregistrerVente(db, AFI.id, {
      lignes: lignes(db),
      paiements: [
        { mode: 'especes', montant: 400 },
        { mode: 'credit', montant: 8400 }
      ],
      clientId: abra
    })
    const sessionId = une<{ s: number }>(
      db,
      'SELECT session_caisse_id AS s FROM ventes WHERE id = ?',
      v.venteId
    )!.s
    const r = rapportSession(db, sessionId)
    expect(r.totauxParMode.credit).toBe(8400)
    expect(r.totauxParMode.especes).toBe(400)
    expect(r.especesTheoriques).toBe(10400)
    expect(ventesPeriode(db, {}).chiffreAffaires).toBe(8800)
  })
})

describe('Annulation et retour d’un ticket à crédit (A11)', () => {
  it('annuler le ticket annule la créance ; rien à rendre pour la part à crédit', () => {
    const { db, abra } = preparer()
    const v = enregistrerVente(db, AFI.id, {
      lignes: lignes(db),
      paiements: [
        { mode: 'especes', montant: 400 },
        { mode: 'credit', montant: 8400 }
      ],
      clientId: abra
    })
    const r = annulerTicket(db, KOSSI, { numeroTicket: v.numeroTicket, motif: 'Erreur de client' })
    expect(r.especesARendre).toBe(400)
    expect(r.creditAnnule).toBe(8400)
    expect(r.autresARendre).toEqual([])
    expect(encoursClient(db, abra)).toBe(0)
    expect(
      une(
        db,
        'SELECT annulee_par AS par, motif_annulation AS motif FROM creances WHERE vente_id = ?',
        v.venteId
      )
    ).toEqual({ par: KOSSI.id, motif: `Annulation du ticket ${v.numeroTicket} : Erreur de client` })
    // Le ticket annulé ne porte plus le bloc crédit.
    expect(lireTicket(db, v.venteId).credit).toBeNull()
  })

  it('annulation refusée si le client a déjà payé une partie du crédit', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 700)
    executer(
      db,
      `INSERT INTO encaissements_creances (creance_id, montant, mode, session_caisse_id, utilisateur_id)
       SELECT id, 350, 'especes', 1, ? FROM creances WHERE vente_id = ?`,
      KOSSI.id,
      v.venteId
    )
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: v.numeroTicket, motif: 'x' })).toThrow(
      /déjà payé une partie du crédit/
    )
  })
})

describe('Ticket à crédit imprimé (A11)', () => {
  it('bloc crédit ; signature sur l’exemplaire boutique seulement ; deux exemplaires à l’original', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 700, { echeance: '2099-12-31' })
    const ticket = lireTicket(db, v.venteId)
    expect(ticket.credit).toEqual({
      client: 'Mme Abra',
      telephone: '90 00 00 01',
      montant: 700,
      echeance: '2099-12-31'
    })
    const texte = (exemplaire: 'client' | 'boutique') =>
      lignesTicket(ticket, ENTETE, { duplicata: false, exemplaire }).map((l) => l.texte)
    expect(texte('client')).toContain('VENTE À CRÉDIT')
    expect(texte('client')).toContain('À payer avant le 31/12/2099')
    expect(texte('client')).toContain('Exemplaire client')
    expect(texte('client')).not.toContain('Signature du client :')
    expect(texte('boutique')).toContain('Signature du client :')
    // Deux coupes à l'original, une seule au duplicata (exemplaire boutique).
    const coupes = (b: Buffer) => b.toString('latin1').split('\x1dV').length - 1
    const original = mettreEnPageTicket(ticket, ENTETE, 'cp1252', { duplicata: false, tiroir: false })
    const duplicata = mettreEnPageTicket(ticket, ENTETE, 'cp1252', { duplicata: true, tiroir: false })
    expect(coupes(original)).toBe(2)
    expect(coupes(duplicata)).toBe(1)
    expect(duplicata.toString('latin1')).toContain('Signature du client')
  })

  it('un ticket sans crédit n’a pas de bloc crédit', () => {
    const { db } = preparer()
    const v = enregistrerVente(db, AFI.id, {
      lignes: lignes(db, true),
      paiements: [{ mode: 'especes', montant: 8200 }]
    })
    expect(lireTicket(db, v.venteId).credit).toBeNull()
  })
})
