import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { lignesRapport } from '../src/main/materiel/rapport'
import { lignesRecu, lignesRelance } from '../src/main/materiel/recouvrement'
import { lignesTicket } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { cloturerSession, rapportSession } from '../src/main/modules/caisse/service-cloture'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { creerClient, encoursClient, ficheClient } from '../src/main/modules/clients/service'
import {
  annulerEncaissement,
  balanceAgee,
  encaisserCreance,
  historiqueClient,
  listeRelance,
  lireRecu
} from '../src/main/modules/clients/service-recouvrement'
import type { RequeteRetour } from '../src/shared/ipc/caisse'
import { imputerPaiement, trancheAnciennete } from '../src/shared/recouvrement'
import { repartirRetourCredit } from '../src/shared/retour'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const ENTETE = { nom: 'Ma Boutique', adresse: ['Lomé'], pied: 'Merci' }

const UNITE = '6181000000042' // 350 F
const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Afi a sa caisse ouverte (fond 10 000) ; Mme Abra a un plafond de 50 000 F. */
function preparer(): { db: Db; abra: number; sessionId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  const abra = creerClient(db, KOSSI, { nom: 'Mme Abra', telephone: '90 00 00 01', plafondCredit: 50000 }).id
  return { db, abra, sessionId }
}

/** Une vente 100 % à crédit de `unites` tomates (350 F l'unité). */
const aCredit = (db: Db, clientId: number, unites: number) =>
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, UNITE), quantite: unites }],
    paiements: [{ mode: 'credit', montant: unites * 350 }],
    clientId
  })

const restantDe = (db: Db, numeroTicket: string): number =>
  une<{ n: number }>(
    db,
    `SELECT v.restant_du AS n FROM v_creances_clients v JOIN ventes ve ON ve.id = v.vente_id
     WHERE ve.numero_ticket = ?`,
    numeroTicket
  )!.n

describe('Règles pures du recouvrement (A12)', () => {
  it('imputation : la plus ancienne d’abord, jamais au-delà du dû', () => {
    const dues = [
      { creanceId: 1, restantDu: 700 },
      { creanceId: 2, restantDu: 1050 },
      { creanceId: 3, restantDu: 1750 }
    ]
    expect(imputerPaiement(dues, 2000)).toEqual([
      { creanceId: 1, montant: 700 },
      { creanceId: 2, montant: 1050 },
      { creanceId: 3, montant: 250 }
    ])
    expect(imputerPaiement(dues, 3500)).toHaveLength(3)
    expect(imputerPaiement(dues, 3501)).toBeNull()
  })

  it('tranches de la balance âgée : 0–30, 31–60, plus de 60 jours', () => {
    expect([0, 30, 31, 60, 61].map(trancheAnciennete)).toEqual([
      'jusqu30',
      'jusqu30',
      'de31a60',
      'de31a60',
      'plus60'
    ])
  })

  it('retour sur ticket à crédit : la part de la dette réduit la créance, le reste se rembourse', () => {
    // Ticket 7 000 F : 2 800 espèces + 4 200 crédit ; retour de 1 750 F.
    const credit = { totalCredit: 4200, restantCreance: 4200, dejaRendu: 0, totalTtc: 7000 }
    expect(repartirRetourCredit(credit, 1750)).toEqual({ creanceReduite: 1050, aRembourser: 700 })
    // Le dernier retour prend le reste exact : 1 750 puis 5 250 réduisent 4 200 au total.
    const suite = { ...credit, dejaRendu: 1750, restantCreance: 3150 }
    expect(repartirRetourCredit(suite, 5250)).toEqual({ creanceReduite: 3150, aRembourser: 2100 })
    // Jamais plus que ce que le client doit encore ; l'excédent est rendu.
    expect(repartirRetourCredit({ ...credit, restantCreance: 500 }, 1750)).toEqual({
      creanceReduite: 500,
      aRembourser: 1250
    })
    expect(repartirRetourCredit(null, 1750)).toEqual({ creanceReduite: 0, aRembourser: 1750 })
  })
})

describe('Encaisser une créance (A12)', () => {
  it('3 500 F en espèces : créance soldée, entrée de caisse, théorique 13 500, reçu EC-', () => {
    const { db, abra, sessionId } = preparer()
    const v = aCredit(db, abra, 10)
    expect(encoursClient(db, abra)).toBe(3500)

    const r = encaisserCreance(db, AFI, { clientId: abra, montant: 3500, mode: 'especes' })

    expect(r.numeroRecu).toMatch(/^EC-\d{4}-000001$/)
    expect(r.parts).toEqual([
      { creanceId: expect.any(Number), numeroTicket: v.numeroTicket, montant: 3500, restantApres: 0 }
    ])
    expect(r.restantClient).toBe(0)
    expect(encoursClient(db, abra)).toBe(0)
    expect(ficheClient(db, abra).creances[0]).toMatchObject({
      statut: 'soldee',
      encaisse: 3500,
      restantDu: 0
    })
    const rapport = rapportSession(db, sessionId)
    expect(rapport.especesTheoriques).toBe(13500)
    expect(rapport.creancesEncaissees).toEqual({ nombre: 1, especes: 3500, tmoney: 0, flooz: 0, total: 3500 })
    expect(
      une(db, "SELECT sens, motif, montant FROM mouvements_caisse WHERE motif = 'encaissement_creance'")
    ).toEqual({ sens: 'entree', motif: 'encaissement_creance', montant: 3500 })
    expect(
      une<{ action: string }>(db, "SELECT action FROM journal_audit WHERE action = 'encaissement_creance'")
    ).toBeTruthy()
  })

  it('paiement partiel : 7 000 F dus, 4 000 F puis 3 000 F', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 20)
    const r1 = encaisserCreance(db, AFI, { clientId: abra, montant: 4000, mode: 'especes' })
    expect(r1.restantClient).toBe(3000)
    expect(restantDe(db, v.numeroTicket)).toBe(3000)
    expect(ficheClient(db, abra).creances[0].statut).toBe('ouverte')
    encaisserCreance(db, AFI, { clientId: abra, montant: 3000, mode: 'especes' })
    expect(ficheClient(db, abra).creances[0]).toMatchObject({ statut: 'soldee', restantDu: 0 })
  })

  it('un paiement se répartit : 2 000 F sur des créances de 700, 1 050 et 1 750 F', () => {
    const { db, abra } = preparer()
    const a = aCredit(db, abra, 2)
    const b = aCredit(db, abra, 3)
    const c = aCredit(db, abra, 5)
    const r = encaisserCreance(db, AFI, { clientId: abra, montant: 2000, mode: 'especes' })
    expect(r.parts.map((p) => [p.numeroTicket, p.montant, p.restantApres])).toEqual([
      [a.numeroTicket, 700, 0],
      [b.numeroTicket, 1050, 0],
      [c.numeroTicket, 250, 1500]
    ])
    expect(r.restantClient).toBe(1500)
  })

  it('créance choisie : le paiement ne touche que celle-là', () => {
    const { db, abra } = preparer()
    aCredit(db, abra, 2)
    const b = aCredit(db, abra, 3)
    const creanceB = une<{ id: number }>(db, 'SELECT id FROM creances WHERE vente_id = ?', b.venteId)!.id
    const r = encaisserCreance(db, AFI, {
      clientId: abra,
      montant: 500,
      mode: 'especes',
      creanceId: creanceB
    })
    expect(r.parts).toHaveLength(1)
    expect(restantDe(db, b.numeroTicket)).toBe(550)
    expect(() =>
      encaisserCreance(db, AFI, { clientId: abra, montant: 600, mode: 'especes', creanceId: creanceB })
    ).toThrow(/dépasse/)
  })

  it('TMoney : référence obligatoire, rien dans le tiroir, visible sur le rapport', () => {
    const { db, abra, sessionId } = preparer()
    aCredit(db, abra, 10)
    expect(() => encaisserCreance(db, AFI, { clientId: abra, montant: 1000, mode: 'tmoney' })).toThrow(
      /référence du transfert TMoney/
    )
    encaisserCreance(db, AFI, { clientId: abra, montant: 1000, mode: 'tmoney', reference: ' TM-55 ' })
    expect(toutes(db, 'SELECT id FROM mouvements_caisse')).toHaveLength(0)
    const rapport = rapportSession(db, sessionId)
    expect(rapport.especesTheoriques).toBe(10000)
    expect(rapport.creancesEncaissees).toMatchObject({ nombre: 1, especes: 0, tmoney: 1000, total: 1000 })
    expect(une(db, 'SELECT reference FROM encaissements_creances')).toEqual({ reference: 'TM-55' })
    expect(
      lignesRapport(rapport, ENTETE, { type: 'X', duplicata: false })
        .map((l) => l.texte)
        .join('\n')
    ).toMatch(/CRÉANCES ENCAISSÉES \(1\)[\s\S]*Par TMoney\s+1 000 F/)
  })

  it('refus : plus que le dû, rien à payer, sans caisse ouverte, mode forgé, montant décimal', () => {
    const { db, abra } = preparer()
    expect(() => encaisserCreance(db, AFI, { clientId: abra, montant: 100, mode: 'especes' })).toThrow(
      /ne doit rien/
    )
    aCredit(db, abra, 2)
    expect(() => encaisserCreance(db, AFI, { clientId: abra, montant: 701, mode: 'especes' })).toThrow(
      /ne doit que 700\sF/
    )
    expect(() => encaisserCreance(db, KOSSI, { clientId: abra, montant: 100, mode: 'especes' })).toThrow(
      /Ouvrez votre caisse/
    )
    expect(() =>
      encaisserCreance(db, AFI, { clientId: abra, montant: 100, mode: 'constructor' as never })
    ).toThrow(/espèces, TMoney ou Flooz/)
    expect(() => encaisserCreance(db, AFI, { clientId: abra, montant: 99.5, mode: 'especes' })).toThrow(
      /Montant invalide/
    )
    expect(toutes(db, 'SELECT id FROM encaissements_creances')).toHaveLength(0)
  })

  it('la base refuse un encaissement au-delà du dû, même hors du service', () => {
    const { db, abra, sessionId } = preparer()
    const v = aCredit(db, abra, 2)
    const creance = une<{ id: number }>(db, 'SELECT id FROM creances WHERE vente_id = ?', v.venteId)!.id
    expect(() =>
      executer(
        db,
        `INSERT INTO encaissements_creances (creance_id, montant, mode, session_caisse_id, utilisateur_id)
         VALUES (?, 701, 'especes', ?, ?)`,
        creance,
        sessionId,
        AFI.id
      )
    ).toThrow(/ne dépasse pas le restant dû/)
  })

  it('reçu : montant, tickets, reste à payer ; imprimé en 48 colonnes', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 10)
    const fait = encaisserCreance(db, AFI, { clientId: abra, montant: 1000, mode: 'especes' })
    const recu = lireRecu(db, fait.numeroRecu)
    expect(recu).toMatchObject({ client: 'Mme Abra', montant: 1000, restantClient: 2500, caissier: 'Afi' })
    const lignes = lignesRecu(recu, ENTETE)
    const texte = lignes.map((l) => l.texte).join('\n')
    expect(texte).toMatch(/REÇU DE PAIEMENT/)
    expect(texte).toContain(fait.numeroRecu)
    expect(texte).toMatch(new RegExp(`Ticket ${v.numeroTicket}\\s+1 000 F`))
    expect(texte).toMatch(/RESTE À PAYER\s+2 500 F/)
    expect(lignes.every((l) => l.texte.length <= 48)).toBe(true)
  })
})

describe('Annuler un encaissement (A12)', () => {
  it('le gérant annule avec un motif : la dette revient, les espèces ressortent du tiroir', () => {
    const { db, abra, sessionId } = preparer()
    const v = aCredit(db, abra, 10)
    const { numeroRecu } = encaisserCreance(db, AFI, { clientId: abra, montant: 3500, mode: 'especes' })
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(13500)

    expect(() => annulerEncaissement(db, AFI, { numeroRecu, motif: 'Erreur de saisie' })).toThrow(
      /Seul le gérant/
    )
    expect(() => annulerEncaissement(db, KOSSI, { numeroRecu, motif: '  ' })).toThrow(/motif/)
    annulerEncaissement(db, KOSSI, { numeroRecu, motif: 'Erreur de saisie' })

    expect(restantDe(db, v.numeroTicket)).toBe(3500)
    expect(encoursClient(db, abra)).toBe(3500)
    const rapport = rapportSession(db, sessionId)
    expect(rapport.especesTheoriques).toBe(10000)
    expect(rapport.creancesEncaissees.nombre).toBe(0)
    expect(() => annulerEncaissement(db, KOSSI, { numeroRecu, motif: 'Encore' })).toThrow(/déjà annulé/)
    expect(() => annulerEncaissement(db, KOSSI, { numeroRecu: 'EC-1999-000001', motif: 'x' })).toThrow(
      /introuvable/
    )
    // Rien n'est effacé : l'encaissement est toujours là, avec son annulation.
    expect(toutes(db, 'SELECT id FROM encaissements_creances')).toHaveLength(1)
    expect(toutes(db, 'SELECT id FROM annulations_encaissements')).toHaveLength(1)
    expect(une(db, "SELECT action FROM journal_audit WHERE action = 'annulation_encaissement'")).toBeTruthy()
  })

  it('refusée une fois la caisse clôturée', () => {
    const { db, abra } = preparer()
    aCredit(db, abra, 10)
    const { numeroRecu } = encaisserCreance(db, AFI, {
      clientId: abra,
      montant: 3500,
      mode: 'tmoney',
      reference: 'TM-1'
    })
    cloturerSession(db, AFI, { montantCompte: 10000, commentaire: undefined })
    expect(() => annulerEncaissement(db, KOSSI, { numeroRecu, motif: 'Erreur' })).toThrow(/clôturée/)
  })

  it('un paiement mobile money s’annule sans toucher au tiroir', () => {
    const { db, abra, sessionId } = preparer()
    aCredit(db, abra, 10)
    const { numeroRecu } = encaisserCreance(db, AFI, {
      clientId: abra,
      montant: 500,
      mode: 'flooz',
      reference: 'FL-9'
    })
    annulerEncaissement(db, KOSSI, { numeroRecu, motif: 'Mauvais client' })
    expect(encoursClient(db, abra)).toBe(3500)
    expect(toutes(db, 'SELECT id FROM mouvements_caisse')).toHaveLength(0)
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(10000)
  })

  it('un ticket dont la créance est en partie payée ne s’annule toujours pas', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 10)
    const { numeroRecu } = encaisserCreance(db, AFI, { clientId: abra, montant: 500, mode: 'especes' })
    expect(() => annulerTicket(db, KOSSI, { numeroTicket: v.numeroTicket, motif: 'Erreur' })).toThrow(
      /déjà payé une partie/
    )
    annulerEncaissement(db, KOSSI, { numeroRecu, motif: 'Erreur' })
  })
})

describe('Historique, balance âgée et relance (A12)', () => {
  /** Rend une créance plus vieille : le trigger qui fige `cree_le` n'existe pas en production pour rien. */
  function vieillir(db: Db, venteId: number, jours: number, echeanceDansJours: number): void {
    executer(db, 'DROP TRIGGER IF EXISTS trg_creances_figees')
    executer(
      db,
      `UPDATE creances SET cree_le = datetime('now','localtime', ?), date_echeance = date('now','localtime', ?)
        WHERE vente_id = ?`,
      `-${jours} days`,
      `${echeanceDansJours >= 0 ? '+' : ''}${echeanceDansJours} days`,
      venteId
    )
  }

  it('balance âgée : 10, 40 et 70 jours dans la bonne tranche, total = encours', () => {
    const { db, abra } = preparer()
    const kofi = creerClient(db, KOSSI, { nom: 'Kofi', telephone: '90 00 00 02', plafondCredit: 50000 }).id
    vieillir(db, aCredit(db, abra, 2).venteId, 10, 20) // 700
    vieillir(db, aCredit(db, abra, 3).venteId, 40, -10) // 1 050, échue
    vieillir(db, aCredit(db, kofi, 5).venteId, 70, -40) // 1 750, échue

    const b = balanceAgee(db)
    expect(b.totaux).toEqual({ jusqu30: 700, de31a60: 1050, plus60: 1750, total: 3500, enRetard: 2800 })
    expect(b.lignes).toEqual([
      expect.objectContaining({ client: 'Kofi', plus60: 1750, total: 1750, enRetard: 1750 }),
      expect.objectContaining({
        client: 'Mme Abra',
        jusqu30: 700,
        de31a60: 1050,
        total: 1750,
        enRetard: 1050
      })
    ])
    // Un paiement fait baisser la balance.
    encaisserCreance(db, AFI, { clientId: kofi, montant: 1750, mode: 'especes' })
    expect(balanceAgee(db).totaux.total).toBe(1750)
  })

  it('liste de relance : seulement les échéances dépassées, le plus en retard d’abord', () => {
    const { db, abra } = preparer()
    const kofi = creerClient(db, KOSSI, { nom: 'Kofi', telephone: '90 00 00 02', plafondCredit: 50000 }).id
    vieillir(db, aCredit(db, abra, 2).venteId, 10, 20) // pas en retard
    const t3 = aCredit(db, abra, 3)
    vieillir(db, t3.venteId, 40, -5) // 5 jours de retard
    const t5 = aCredit(db, kofi, 5)
    vieillir(db, t5.venteId, 80, -65) // 65 jours de retard

    const liste = listeRelance(db)
    expect(liste.map((l) => [l.client, l.montantEchu, l.joursRetard, l.tranche])).toEqual([
      ['Kofi', 1750, 65, 'plus60'],
      ['Mme Abra', 1050, 5, 'jusqu30']
    ])
    // Mme Abra doit 1 750 en tout dont 1 050 d'échu.
    expect(liste[1].total).toBe(1750)
    expect(liste[1].creances).toEqual([
      { numeroTicket: t3.numeroTicket, restantDu: 1050, dateEcheance: expect.any(String), joursRetard: 5 }
    ])
    const texte = lignesRelance(liste, ENTETE, '01/11/2026')
      .map((l) => l.texte)
      .join('\n')
    expect(texte).toMatch(/LISTE DE RELANCE/)
    expect(texte.indexOf('PLUS DE 60 JOURS')).toBeLessThan(texte.indexOf('0 À 30 JOURS'))
    expect(texte).toMatch(/TOTAL EN RETARD \(2\)\s+2 800 F/)
    // Payé : plus à relancer.
    encaisserCreance(db, AFI, { clientId: kofi, montant: 1750, mode: 'especes' })
    expect(listeRelance(db).map((l) => l.client)).toEqual(['Mme Abra'])
  })

  it('historique : la dette après chaque ligne, l’annulation y figure', () => {
    const { db, abra } = preparer()
    aCredit(db, abra, 10) // +3 500
    const p1 = encaisserCreance(db, AFI, { clientId: abra, montant: 1000, mode: 'especes' })
    encaisserCreance(db, AFI, { clientId: abra, montant: 500, mode: 'tmoney', reference: 'TM-2' })
    annulerEncaissement(db, KOSSI, { numeroRecu: p1.numeroRecu, motif: 'Erreur' })

    const h = historiqueClient(db, KOSSI, abra)
    expect(h.map((l) => [l.type, l.variation, l.soldeApres])).toEqual([
      ['credit', 3500, 3500],
      ['encaissement', -1000, 2500],
      ['encaissement', -500, 2000],
      ['annulation', 1000, 3000]
    ])
    // Le gérant peut annuler le paiement TMoney encore valide, pas celui déjà annulé.
    expect(h.filter((l) => l.annulable).map((l) => l.libelle)).toEqual([expect.stringMatching(/TMoney/)])
    // Une caissière voit l'historique mais n'annule rien.
    expect(historiqueClient(db, AFI, abra).some((l) => l.annulable)).toBe(false)
  })
})

describe('Retour sur un ticket à crédit (A12)', () => {
  const demande = (
    db: Db,
    numero: string,
    quantite: number,
    autres: Partial<RequeteRetour> = {}
  ): RequeteRetour => ({
    numeroTicket: numero,
    lignes: [{ ligneId: consulterRetour(db, KOSSI, numero).lignes[0].ligneId, quantite }],
    motif: 'defectueux',
    sort: 'detruire',
    remboursement: { mode: 'especes' },
    autorisation: { utilisateurId: KOSSI.id, code: '5678' },
    ...autres
  })

  it('ticket tout à crédit : le retour réduit la dette, rien n’est rendu, rien ne sort du tiroir', () => {
    const { db, abra, sessionId } = preparer()
    const v = aCredit(db, abra, 10) // 3 500 F
    expect(consulterRetour(db, AFI, v.numeroTicket)).toMatchObject({
      raisonRefus: null,
      credit: { totalCredit: 3500, restantCreance: 3500, dejaRendu: 0, totalTtc: 3500 }
    })

    const r = enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 4)) // 1 400 F

    expect(r.montant).toBe(0)
    expect(r.creanceReduite).toBe(1400)
    expect(restantDe(db, v.numeroTicket)).toBe(2100)
    expect(encoursClient(db, abra)).toBe(2100)
    expect(toutes(db, 'SELECT id FROM paiements WHERE vente_id = ?', r.venteId)).toHaveLength(0)
    const rapport = rapportSession(db, sessionId)
    expect(rapport.especesTheoriques).toBe(10000)
    expect(rapport.remboursements).toMatchObject({ nombre: 1, total: 0 })
    // Le ticket de retour dit de combien la dette baisse.
    const texte = lignesTicket(lireTicket(db, r.venteId), ENTETE, { duplicata: false, exemplaire: 'client' })
      .map((l) => l.texte)
      .join('\n')
    expect(texte).toMatch(/Dette du client réduite de\s+1 400 F/)
    const h = historiqueClient(db, KOSSI, abra)
    expect(h.at(-1)).toMatchObject({ type: 'reduction', variation: -1400, soldeApres: 2100 })
  })

  it('ticket mixte 2 800 F espèces + 4 200 F crédit : retour de 1 750 F = 1 050 F de dette + 700 F rendus', () => {
    const { db, abra, sessionId } = preparer()
    const v = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, UNITE), quantite: 20 }],
      paiements: [
        { mode: 'especes', montant: 2800 },
        { mode: 'credit', montant: 4200 }
      ],
      montantRecu: 2800,
      clientId: abra
    })
    const r = enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 5))
    expect(r).toMatchObject({ montant: 700, creanceReduite: 1050, mode: 'especes' })
    expect(restantDe(db, v.numeroTicket)).toBe(3150)
    expect(rapportSession(db, sessionId)).toMatchObject({
      remboursements: { especes: 700, total: 700 },
      especesTheoriques: 10000 + 2800 - 700
    })
    // Le retour de tout le reste solde exactement la créance (15 unités = 5 250 F).
    const r2 = enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 15))
    expect(r2).toMatchObject({ montant: 2100, creanceReduite: 3150 })
    expect(restantDe(db, v.numeroTicket)).toBe(0)
    expect(ficheClient(db, abra).creances[0].statut).toBe('soldee')
  })

  it('le client a déjà payé une partie : l’excédent lui est rendu', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 10) // 3 500 F
    encaisserCreance(db, AFI, { clientId: abra, montant: 3000, mode: 'especes' }) // il reste 500 F
    const r = enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 10))
    expect(r).toMatchObject({ montant: 3000, creanceReduite: 500 })
    expect(restantDe(db, v.numeroTicket)).toBe(0)
    expect(() => enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 1))).toThrow(/déjà été retournés/)
  })

  it('espèces à rendre plafonnées au tiroir, mais pas la part de la dette', () => {
    const { db, abra } = preparer()
    const v = aCredit(db, abra, 10)
    encaisserCreance(db, AFI, { clientId: abra, montant: 3000, mode: 'tmoney', reference: 'TM-3' })
    // 3 000 F à rendre en espèces alors que le tiroir ne contient que 10 000 F : passe ; un tiroir vide refuserait.
    expect(enregistrerRetour(db, AFI, demande(db, v.numeroTicket, 10))).toMatchObject({ montant: 3000 })
  })
})
