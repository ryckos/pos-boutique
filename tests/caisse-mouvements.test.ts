import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { avecTransaction, executer, toutes } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { cloturerSession, rapportSession } from '../src/main/modules/caisse/service-cloture'
import {
  annulerMouvementAuTiroir,
  annulerMouvementCaisse,
  enregistrerMouvementCaisse,
  mouvementsSession,
  saisirMouvementAuTiroir,
  sessionPourMouvement
} from '../src/main/modules/caisse/service-mouvements'
import { ouvrirSession, sessionOuverte } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { libelleMouvementCaisse, sensDuMotif } from '../src/shared/caisse'
import { formaterFCFA as F } from '../src/shared/format'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const PATRON: UtilisateurConnecte = { id: 1, nom: 'Patron', role: 'admin' }
const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const CARTON = '16181000000049' // tomate, carton de 24 : 7 500 F
const BAGUETTE = '101' // 300 F

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Session d'Afi : fond 10 000, ventes en espèces 46 200 (6 cartons + 4 baguettes). */
function caisseAfi(): { db: Db; sessionId: number } {
  const db = baseAvecDemo()
  const { id: sessionId } = ouvrirSession(db, AFI.id, 10000)
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, CARTON), quantite: 6 }],
    paiements: [{ mode: 'especes', montant: 45000 }]
  })
  enregistrerVente(db, AFI.id, {
    lignes: [{ conditionnementId: id(db, BAGUETTE), quantite: 4 }],
    paiements: [{ mode: 'especes', montant: 1200 }]
  })
  return { db, sessionId }
}

const journal = (db: Db, action: string): { entiteId: number; apres: string }[] =>
  toutes(
    db,
    'SELECT entite_id AS entiteId, nouvelle_valeur AS apres FROM journal_audit WHERE action = ?',
    action
  )

describe('Mouvements de caisse — cas de référence', () => {
  it('fond 10 000 + espèces 46 200 + apport 3 500 − dépense 1 000 = 58 700 ; compté 58 200 → −500', () => {
    const { db, sessionId } = caisseAfi()
    // L'encaissement de créance du scénario (3 500) arrive avec A12 : un apport du gérant le remplace.
    saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant: 3500, commentaire: 'monnaie' })
    // Ce que fera la dépense de Dev B (B13), dans sa propre transaction.
    avecTransaction(db, () =>
      enregistrerMouvementCaisse(db, {
        sessionId,
        utilisateurId: KOSSI.id,
        sens: 'sortie',
        motif: 'depense',
        montant: 1000,
        commentaire: 'taxi-moto',
        documentType: 'depense',
        documentId: 1
      })
    )

    const r = rapportSession(db, sessionId)
    expect(r.mouvements).toEqual([
      { sens: 'entree', libelle: 'Apport (monnaie)', montant: 3500 },
      { sens: 'sortie', libelle: 'Dépense (taxi-moto)', montant: 1000 }
    ])
    expect(r.especesTheoriques).toBe(58700)
    expect(cloturerSession(db, AFI, { montantCompte: 58200, commentaire: 'manque' }).ecart).toBe(-500)
  })

  it('le mouvement est au nom du gérant, sur la caisse d’Afi, et journalisé', () => {
    const { db, sessionId } = caisseAfi()
    const m = saisirMouvementAuTiroir(db, KOSSI, {
      motif: 'retrait',
      montant: 20000,
      commentaire: ' banque '
    })
    expect(m).toMatchObject({
      sessionId,
      sens: 'sortie',
      motif: 'retrait',
      montant: 20000,
      commentaire: 'banque',
      auteur: 'Kossi',
      libelle: 'Retrait (banque)',
      mouvementOrigineId: null,
      annuleParId: null
    })
    const [entree] = journal(db, 'mouvement_caisse')
    expect(entree.entiteId).toBe(m.id)
    expect(JSON.parse(entree.apres)).toMatchObject({
      sessionId,
      sens: 'sortie',
      motif: 'retrait',
      montant: 20000
    })
  })

  it('« Autre » : le gérant choisit le sens ; l’admin a les mêmes droits', () => {
    const { db } = caisseAfi()
    const m = saisirMouvementAuTiroir(db, PATRON, {
      motif: 'autre',
      sens: 'entree',
      montant: 500,
      commentaire: 'pièce retrouvée'
    })
    expect(m).toMatchObject({ sens: 'entree', libelle: 'Autre (pièce retrouvée)', auteur: 'Patron' })
    expect(() =>
      saisirMouvementAuTiroir(db, KOSSI, { motif: 'autre', montant: 500, commentaire: 'x' })
    ).toThrow(/entrée ou d’une sortie/)
  })

  it('le motif impose le sens : un apport entre même si l’écran envoie « sortie »', () => {
    const { db } = caisseAfi()
    expect(
      saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', sens: 'sortie', montant: 100, commentaire: 'x' })
        .sens
    ).toBe('entree')
  })
})

describe('Mouvements de caisse — refus', () => {
  it('montant nul, négatif ou à virgule', () => {
    const { db } = caisseAfi()
    for (const montant of [0, -500, 12.5]) {
      expect(() =>
        saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant, commentaire: 'x' })
      ).toThrow(/Montant invalide/)
    }
  })

  it('motif en clair obligatoire', () => {
    const { db } = caisseAfi()
    expect(() =>
      saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant: 100, commentaire: '  ' })
    ).toThrow(/Précisez le motif/)
  })

  it('la caissière ne met ni ne retire d’espèces hors vente', () => {
    const { db } = caisseAfi()
    expect(() =>
      saisirMouvementAuTiroir(db, AFI, { motif: 'apport', montant: 100, commentaire: 'x' })
    ).toThrow(/Seul le gérant/)
  })

  it('les motifs nés d’un document ne se saisissent pas au tiroir', () => {
    const { db } = caisseAfi()
    expect(() =>
      // @ts-expect-error l'écran ne peut pas l'envoyer, le service le refuse quand même
      saisirMouvementAuTiroir(db, KOSSI, { motif: 'depense', montant: 100, commentaire: 'x' })
    ).toThrow(/propre écran/)
  })

  it('une sortie ne dépasse pas les espèces théoriques du tiroir (56 200 F ici)', () => {
    const { db, sessionId } = caisseAfi()
    expect(() =>
      saisirMouvementAuTiroir(db, KOSSI, { motif: 'retrait', montant: 56201, commentaire: 'banque' })
    ).toThrow(`Il n’y a que ${F(56200)} en caisse : impossible de sortir ${F(56201)}.`)
    saisirMouvementAuTiroir(db, KOSSI, { motif: 'retrait', montant: 56200, commentaire: 'banque' })
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(0)
  })

  it('session clôturée : refusée par le service', () => {
    const { db, sessionId } = caisseAfi()
    cloturerSession(db, AFI, { montantCompte: 56200 })
    expect(() =>
      enregistrerMouvementCaisse(db, {
        sessionId,
        utilisateurId: KOSSI.id,
        sens: 'entree',
        motif: 'apport',
        montant: 100,
        commentaire: 'x'
      })
    ).toThrow('Cette caisse est clôturée : ouvrez une nouvelle session.')
  })

  it('l’historique ne se modifie ni ne s’efface', () => {
    const { db } = caisseAfi()
    const m = saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant: 100, commentaire: 'x' })
    expect(() => executer(db, 'UPDATE mouvements_caisse SET montant = 1 WHERE id = ?', m.id)).toThrow(
      /ne se modifie pas/
    )
    expect(() => executer(db, 'DELETE FROM mouvements_caisse WHERE id = ?', m.id)).toThrow(
      /ne se supprime pas/
    )
  })

  it('dans la transaction de l’appelant : si le document échoue, le mouvement disparaît aussi', () => {
    const { db, sessionId } = caisseAfi()
    expect(() =>
      avecTransaction(db, () => {
        enregistrerMouvementCaisse(db, {
          sessionId,
          utilisateurId: KOSSI.id,
          sens: 'sortie',
          motif: 'depense',
          montant: 1000,
          commentaire: 'taxi-moto'
        })
        throw new Error('la dépense échoue après coup')
      })
    ).toThrow()
    expect(mouvementsSession(db, sessionId)).toEqual([])
    expect(journal(db, 'mouvement_caisse')).toEqual([])
  })
})

describe('Mouvements de caisse — annulation par contre-mouvement', () => {
  it('un apport annulé : sortie liée, même montant, théorique revenu à 56 200, journalisée', () => {
    const { db, sessionId } = caisseAfi()
    const apport = saisirMouvementAuTiroir(db, KOSSI, {
      motif: 'apport',
      montant: 3500,
      commentaire: 'monnaie'
    })
    const contre = annulerMouvementAuTiroir(db, KOSSI, { mouvementId: apport.id, motif: 'erreur de saisie' })

    expect(contre).toMatchObject({
      sens: 'sortie',
      motif: 'apport',
      montant: 3500,
      mouvementOrigineId: apport.id,
      libelle: 'Annulation : Apport (erreur de saisie)'
    })
    expect(mouvementsSession(db, sessionId).map((m) => [m.id, m.annuleParId])).toEqual([
      [apport.id, contre.id],
      [contre.id, null]
    ])
    expect(rapportSession(db, sessionId).especesTheoriques).toBe(56200)
    const [entree] = journal(db, 'annulation_mouvement_caisse')
    expect(entree.entiteId).toBe(apport.id)
    expect(JSON.parse(entree.apres)).toEqual({ contreMouvementId: contre.id, motif: 'erreur de saisie' })
  })

  it('une seule fois ; jamais une annulation ; motif obligatoire', () => {
    const { db } = caisseAfi()
    const m = saisirMouvementAuTiroir(db, KOSSI, { motif: 'retrait', montant: 1000, commentaire: 'banque' })
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: m.id, motif: ' ' })).toThrow(/motif/)
    const contre = annulerMouvementAuTiroir(db, KOSSI, { mouvementId: m.id, motif: 'erreur' })
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: m.id, motif: 'encore' })).toThrow(
      /déjà annulé/
    )
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: contre.id, motif: 'x' })).toThrow(
      /lui-même une annulation/
    )
  })

  it('refusée après la clôture', () => {
    const { db } = caisseAfi()
    const m = saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant: 1000, commentaire: 'x' })
    cloturerSession(db, AFI, { montantCompte: 57200 })
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: m.id, motif: 'erreur' })).toThrow(
      /clôturée : ses mouvements ne s’annulent plus/
    )
  })

  it('annuler une entrée est une sortie : refusée si le tiroir ne la couvre plus', () => {
    const { db } = caisseAfi()
    const apport = saisirMouvementAuTiroir(db, KOSSI, { motif: 'apport', montant: 5000, commentaire: 'x' })
    saisirMouvementAuTiroir(db, KOSSI, { motif: 'retrait', montant: 60000, commentaire: 'banque' })
    // Tiroir : 56 200 + 5 000 − 60 000 = 1 200 F.
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: apport.id, motif: 'erreur' })).toThrow(
      `Il n’y a que ${F(1200)} en caisse : impossible de sortir ${F(5000)}.`
    )
  })

  it('au tiroir, le gérant n’annule pas une dépense : elle s’annule depuis son document', () => {
    const { db, sessionId } = caisseAfi()
    const depense = enregistrerMouvementCaisse(db, {
      sessionId,
      utilisateurId: KOSSI.id,
      sens: 'sortie',
      motif: 'depense',
      montant: 1000,
      commentaire: 'taxi-moto',
      documentType: 'depense',
      documentId: 7
    })
    expect(() => annulerMouvementAuTiroir(db, KOSSI, { mouvementId: depense.id, motif: 'x' })).toThrow(
      /vient d’un document \(Dépense\)/
    )
    // Depuis le module des dépenses (Dev B) : contre-mouvement lié au même document.
    const contre = annulerMouvementCaisse(db, {
      mouvementId: depense.id,
      utilisateurId: KOSSI.id,
      motif: 'doublon'
    })
    expect(contre).toMatchObject({ sens: 'entree', documentType: 'depense', documentId: 7 })
    expect(() => annulerMouvementAuTiroir(db, AFI, { mouvementId: depense.id, motif: 'x' })).toThrow(
      /Seul le gérant/
    )
  })
})

describe('Session du tiroir', () => {
  it('sessionOuverte(db) : la seule caisse ouverte, sinon null (aucune ou plusieurs)', () => {
    const db = baseAvecDemo()
    expect(sessionOuverte(db)).toBeNull()
    const afi = ouvrirSession(db, AFI.id, 10000)
    expect(sessionOuverte(db)?.id).toBe(afi.id)
    ouvrirSession(db, KOSSI.id, 5000)
    expect(sessionOuverte(db)).toBeNull()
    // Avec un utilisateur, rien ne change.
    expect(sessionOuverte(db, AFI.id)?.id).toBe(afi.id)
  })

  it('sessionPourMouvement : prise d’office, ou demande de choisir', () => {
    const db = baseAvecDemo()
    expect(() => sessionPourMouvement(db)).toThrow(/Aucune caisse n’est ouverte/)
    const afi = ouvrirSession(db, AFI.id, 10000)
    expect(sessionPourMouvement(db)).toBe(afi.id)
    const kossi = ouvrirSession(db, KOSSI.id, 5000)
    expect(() => sessionPourMouvement(db)).toThrow(/Plusieurs caisses sont ouvertes/)
    expect(sessionPourMouvement(db, kossi.id)).toBe(kossi.id)
  })
})

describe('Règles pures partagées', () => {
  it('sens imposé par le motif', () => {
    expect(sensDuMotif('apport')).toBe('entree')
    expect(sensDuMotif('retrait')).toBe('sortie')
    expect(sensDuMotif('autre')).toBeNull()
  })

  it('libellés', () => {
    expect(
      libelleMouvementCaisse({ motif: 'reglement_fournisseur', commentaire: 'SOTOMA', annulation: false })
    ).toBe('Règlement fournisseur (SOTOMA)')
    expect(libelleMouvementCaisse({ motif: 'retrait', commentaire: null, annulation: true })).toBe(
      'Annulation : Retrait'
    )
  })
})
