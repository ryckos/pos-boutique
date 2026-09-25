import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, une } from '../src/main/db/requetes'
import { encodeText } from '../src/main/materiel/escpos'
import { lignesRapport, mettreEnPageRapport } from '../src/main/materiel/rapport'
import { LARGEUR } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import {
  cloturerSession,
  noterImpressionZ,
  rapportSession,
  rapportZImprime,
  sessionsOuvertes,
  sessionVisee,
  verifierAccesSession,
  verifierTypeRapport
} from '../src/main/modules/caisse/service-cloture'
import { ouvrirSession, sessionOuverte } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RapportCaisse } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const ENTETE = { nom: 'MA BOUTIQUE', adresse: ['Lomé, Togo'], pied: 'Merci de votre visite !' }

const CARTON = '16181000000049' // tomate, carton de 24 : 7 500 F
const UNITE = '6181000000042' // tomate à l'unité : 350 F
const LOT = '2000000000015' // tomate, lot de 3 : 1 000 F
const BAGUETTE = '101' // 300 F

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Mouvement de caisse posé directement : l'API arrive avec A8 (dépenses de Dev B, B13). */
function mouvementCaisse(
  db: Db,
  sessionId: number,
  sens: 'entree' | 'sortie',
  motif: string,
  montant: number,
  commentaire: string
): void {
  executer(
    db,
    `INSERT INTO mouvements_caisse (session_caisse_id, sens, motif, montant, commentaire, utilisateur_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sessionId,
    sens,
    motif,
    montant,
    commentaire,
    AFI.id
  )
}

/**
 * Vendredi d'Afi (SCENARIO_REFERENCE, clôture) : fond 10 000 ; espèces 46 200 (6 cartons + 4 baguettes) ;
 * TMoney 22 500 (3 cartons) ; Flooz 8 000 (8 lots) ; créance encaissée 3 500 ; taxi-moto 1 000.
 * Le crédit (8 400 dans le scénario) arrive avec A11 : il reste à 0 ici.
 */
function vendrediAfi(): { db: Db; sessionId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, CARTON), quantite: 6 }],
    paiements: [{ mode: 'especes', montant: 45000 }],
    montantRecu: 50000
  })
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, BAGUETTE), quantite: 4 }],
    paiements: [{ mode: 'especes', montant: 1200 }]
  })
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, CARTON), quantite: 3 }],
    paiements: [{ mode: 'tmoney', montant: 22500, reference: 'TM-0001' }]
  })
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, LOT), quantite: 8 }],
    paiements: [{ mode: 'flooz', montant: 8000, reference: 'FL-0001' }]
  })
  mouvementCaisse(db, sessionId, 'entree', 'encaissement_creance', 3500, 'Mme Abra')
  mouvementCaisse(db, sessionId, 'sortie', 'depense', 1000, 'taxi-moto')
  return { db, sessionId }
}

describe('Rapport de caisse (X)', () => {
  it('cas de référence : totaux par mode et espèces théoriques 58 700 F', () => {
    const { db, sessionId } = vendrediAfi()
    const r = rapportSession(db, sessionId)
    expect(r.statut).toBe('ouverte')
    expect(r.caissier).toBe('Afi')
    expect(r.nombreTickets).toBe(4)
    expect(r.totauxParMode).toEqual({ especes: 46200, tmoney: 22500, flooz: 8000, credit: 0 })
    expect(r.totalVentes).toBe(76700)
    expect(r.fondOuverture).toBe(10000)
    expect(r.ventesEspeces).toBe(46200)
    expect(r.mouvements).toEqual([
      { sens: 'entree', libelle: 'Encaissement de créance (Mme Abra)', montant: 3500 },
      { sens: 'sortie', libelle: 'Dépense (taxi-moto)', montant: 1000 }
    ])
    expect(r.especesTheoriques).toBe(58700)
    expect(r.montantCompte).toBeNull()
    expect(r.ecart).toBeNull()
  })

  it('vente mixte : seule la part espèces compte, pas le montant reçu', () => {
    const db = baseAvecDemo()
    const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
    // 1 carton + 2 unités + 1 baguette = 8 500 F : 5 000 en TMoney, 3 500 en espèces, 5 000 reçus.
    enregistrerVente(db, AFI.id, {
      lignes: [
        { conditionnementId: id(db, CARTON), quantite: 1 },
        { conditionnementId: id(db, UNITE), quantite: 2 },
        { conditionnementId: id(db, BAGUETTE), quantite: 1 }
      ],
      paiements: [
        { mode: 'tmoney', montant: 5000, reference: 'TM-0002' },
        { mode: 'especes', montant: 3500 }
      ],
      montantRecu: 5000
    })
    const r = rapportSession(db, sessionId)
    expect(r.ventesEspeces).toBe(3500)
    expect(r.totauxParMode.tmoney).toBe(5000)
    expect(r.especesTheoriques).toBe(13500)
  })

  it('les ventes d’une autre session et les tickets annulés ne comptent pas', () => {
    const { db, sessionId } = vendrediAfi()
    ouvrirSession(db, KOSSI.id, 5000)
    enregistrerVente(db, KOSSI.id, {
      lignes: [{ conditionnementId: id(db, BAGUETTE), quantite: 2 }],
      paiements: [{ mode: 'especes', montant: 600 }]
    })
    const { venteId } = enregistrerVente(db, AFI.id, {
      lignes: [{ conditionnementId: id(db, BAGUETTE), quantite: 1 }],
      paiements: [{ mode: 'especes', montant: 300 }]
    })
    // L'annulation complète arrive avec A6 ; le statut suffit pour le rapport.
    executer(db, "UPDATE ventes SET statut = 'annulee' WHERE id = ?", venteId)
    const r = rapportSession(db, sessionId)
    expect(r.nombreTickets).toBe(4)
    expect(r.especesTheoriques).toBe(58700)
  })

  it('sans session ouverte, rien à consulter', () => {
    const db = baseAvecDemo()
    expect(() => sessionVisee(db, AFI)).toThrow(/pas ouverte/)
  })
})

describe('Clôture de caisse (Z)', () => {
  it('cas de référence : compté 58 200 F → écart −500 F, figé et journalisé', () => {
    const { db, sessionId } = vendrediAfi()
    const r = cloturerSession(db, AFI, { montantCompte: 58200, commentaire: 'Monnaie rendue en trop ?' })
    expect(r.statut).toBe('fermee')
    expect(r.dateFermeture).not.toBeNull()
    expect(r.especesTheoriques).toBe(58700)
    expect(r.montantCompte).toBe(58200)
    expect(r.ecart).toBe(-500)
    expect(r.commentaire).toBe('Monnaie rendue en trop ?')

    const enBase = une<{ theorique: number; compte: number; ecart: number; statut: string }>(
      db,
      `SELECT montant_theorique AS theorique, montant_compte AS compte, ecart, statut
       FROM sessions_caisse WHERE id = ?`,
      sessionId
    )
    expect(enBase).toEqual({ theorique: 58700, compte: 58200, ecart: -500, statut: 'fermee' })

    const journal = une<{ utilisateurId: number; nouvelle: string }>(
      db,
      `SELECT utilisateur_id AS utilisateurId, nouvelle_valeur AS nouvelle FROM journal_audit
       WHERE action = 'cloture_session_caisse' AND entite_id = ?`,
      sessionId
    )!
    expect(journal.utilisateurId).toBe(AFI.id)
    expect(JSON.parse(journal.nouvelle)).toMatchObject({
      especesTheoriques: 58700,
      montantCompte: 58200,
      ecart: -500
    })
  })

  it('écart non nul sans commentaire : refusé, la session reste ouverte', () => {
    const { db, sessionId } = vendrediAfi()
    expect(() => cloturerSession(db, AFI, { montantCompte: 58200, commentaire: '   ' })).toThrow(
      /Expliquez l’écart/
    )
    expect(rapportSession(db, sessionId).statut).toBe('ouverte')
  })

  it('écart nul : le commentaire est facultatif', () => {
    const { db } = vendrediAfi()
    const r = cloturerSession(db, AFI, { montantCompte: 58700 })
    expect(r.ecart).toBe(0)
    expect(r.commentaire).toBeNull()
  })

  it('refuse un compté négatif ou à virgule', () => {
    const { db } = vendrediAfi()
    expect(() => cloturerSession(db, AFI, { montantCompte: -1 })).toThrow(/Espèces comptées invalides/)
    expect(() => cloturerSession(db, AFI, { montantCompte: 58700.5 })).toThrow(/Espèces comptées invalides/)
  })

  it('session figée : double clôture et vente refusées, nouvelle ouverture possible', () => {
    const { db, sessionId } = vendrediAfi()
    cloturerSession(db, AFI, { montantCompte: 58700 })
    expect(() => cloturerSession(db, AFI, { sessionId, montantCompte: 58700 })).toThrow(/déjà clôturée/)
    expect(sessionOuverte(db, AFI.id)).toBeNull()
    expect(() =>
      enregistrerVente(db, AFI.id, {
        lignes: [{ conditionnementId: id(db, BAGUETTE), quantite: 1 }],
        paiements: [{ mode: 'especes', montant: 300 }]
      })
    ).toThrow()
    const nouvelle = ouvrirSession(db, AFI.id, 10000)
    expect(nouvelle.id).not.toBe(sessionId)
    expect(rapportSession(db, nouvelle.id)).toMatchObject({ nombreTickets: 0, especesTheoriques: 10000 })
  })
})

describe('Clôture et rapports — droits', () => {
  it('le gérant voit les sessions ouvertes et clôture celle d’Afi ; Afi ne clôture pas celle du gérant', () => {
    const { db, sessionId } = vendrediAfi()
    const { id: sessionKossi } = ouvrirSession(db, KOSSI.id, 5000)
    expect(sessionsOuvertes(db).map((s) => [s.id, s.caissier])).toEqual([
      [sessionId, 'Afi'],
      [sessionKossi, 'Kossi']
    ])
    expect(() => cloturerSession(db, AFI, { sessionId: sessionKossi, montantCompte: 5000 })).toThrow(
      /pas la vôtre/
    )
    cloturerSession(db, KOSSI, { sessionId, montantCompte: 58700 })
    const journal = une<{ utilisateurId: number; nouvelle: string }>(
      db,
      `SELECT utilisateur_id AS utilisateurId, nouvelle_valeur AS nouvelle FROM journal_audit
       WHERE action = 'cloture_session_caisse' AND entite_id = ?`,
      sessionId
    )!
    expect(journal.utilisateurId).toBe(KOSSI.id)
    expect(JSON.parse(journal.nouvelle).caissierId).toBe(AFI.id)
    expect(sessionsOuvertes(db).map((s) => s.id)).toEqual([sessionKossi])
  })

  it('caissière : sa session ouverte et sa dernière clôturée ; gérant : toutes', () => {
    const db = baseAvecDemo()
    const s1 = ouvrirSession(db, AFI.id, 0).id
    cloturerSession(db, AFI, { montantCompte: 0 })
    const s2 = ouvrirSession(db, AFI.id, 0).id
    cloturerSession(db, AFI, { montantCompte: 0 })
    const s3 = ouvrirSession(db, AFI.id, 0).id
    const sKossi = ouvrirSession(db, KOSSI.id, 0).id

    expect(() => verifierAccesSession(db, AFI, s3)).not.toThrow()
    expect(() => verifierAccesSession(db, AFI, s2)).not.toThrow()
    expect(() => verifierAccesSession(db, AFI, s1)).toThrow(/ancienne session/)
    expect(() => verifierAccesSession(db, AFI, sKossi)).toThrow(/pas la vôtre/)
    for (const s of [s1, s2, s3, sKossi]) expect(() => verifierAccesSession(db, KOSSI, s)).not.toThrow()
  })

  it('X pour une session ouverte, Z pour une session clôturée ; Z en DUPLICATA après une impression', () => {
    const { db, sessionId } = vendrediAfi()
    expect(() => verifierTypeRapport(rapportSession(db, sessionId), 'Z')).toThrow(/après la clôture/)
    expect(() => verifierTypeRapport(rapportSession(db, sessionId), 'X')).not.toThrow()
    cloturerSession(db, AFI, { montantCompte: 58700 })
    expect(() => verifierTypeRapport(rapportSession(db, sessionId), 'X')).toThrow(/rapport Z/)
    expect(rapportZImprime(db, sessionId)).toBe(false)
    noterImpressionZ(db, AFI.id, sessionId, false)
    expect(rapportZImprime(db, sessionId)).toBe(true)
  })
})

describe('Rapports imprimés', () => {
  const rapportZ = (): RapportCaisse => {
    const { db } = vendrediAfi()
    return cloturerSession(db, AFI, { montantCompte: 58200, commentaire: 'Monnaie rendue en trop ?' })
  }
  const texte = (r: RapportCaisse, type: 'X' | 'Z', duplicata = false): string[] =>
    lignesRapport(r, ENTETE, { type, duplicata }).map((l) => l.texte)

  it('Z : totaux, calcul des espèces, compté, écart et commentaire', () => {
    const t = texte(rapportZ(), 'Z')
    expect(t).toContain('RAPPORT Z')
    expect(t).toContain('Caisse   Afi')
    expect(t.some((l) => /^Espèces +46 200 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^TMoney +22 500 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Total des ventes +76 700 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Fond d’ouverture +10 000 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^\+ Encaissement de créance \(Mme Abra\) +3 500 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^- Dépense \(taxi-moto\) +1 000 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^= Espèces théoriques +58 700 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Espèces comptées +58 200 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Écart +-500 F$/.test(l))).toBe(true)
    expect(t).toContain('Monnaie rendue en trop ?')
    expect(t).not.toContain('DUPLICATA')
  })

  it('X : provisoire, sans compté ni écart', () => {
    const { db, sessionId } = vendrediAfi()
    const t = texte(rapportSession(db, sessionId), 'X')
    expect(t).toContain('RAPPORT X')
    expect(t).toContain('Provisoire : caisse non clôturée')
    expect(t.some((l) => l.startsWith('Espèces comptées'))).toBe(false)
    expect(t.some((l) => /^= Espèces théoriques +58 700 F$/.test(l))).toBe(true)
  })

  it('DUPLICATA en tête et en pied ; aucune ligne au-delà de 48 colonnes', () => {
    const lignes = lignesRapport(rapportZ(), ENTETE, { type: 'Z', duplicata: true })
    expect(lignes.filter((l) => l.texte === 'DUPLICATA')).toHaveLength(2)
    for (const l of lignes) expect(l.texte.length).toBeLessThanOrEqual(l.double ? LARGEUR / 2 : LARGEUR)
  })

  it('aucun caractère inconnu (« ? ») dans les trois pages de codes', () => {
    const r = rapportZ()
    for (const page of ['cp858', 'cp1252', 'cp437'] as const) {
      const attendus = encodeText('Monnaie rendue en trop ?', page).filter((o) => o === 0x3f).length
      const octets = mettreEnPageRapport(r, ENTETE, page, { type: 'Z', duplicata: false })
      expect(octets.filter((o) => o === 0x3f).length, page).toBe(attendus)
    }
  })
})
