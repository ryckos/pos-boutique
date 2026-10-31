import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { rapportSession } from '../src/main/modules/caisse/service-cloture'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import {
  avoirsDuClient,
  depenserAvoirs,
  retablirAvoirs,
  soldeAvoirs
} from '../src/main/modules/clients/service-avoir'
import { creerClient, desactiverClient, ficheClient } from '../src/main/modules/clients/service'
import type { RequeteRetour } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const ACCORD_KOSSI = { utilisateurId: KOSSI.id, code: '5678' }

const CARTON = '16181000000049' // 7 500 F
const UNITE = '6181000000042' // 350 F
const JUS = '6034000012345' // 600 F

const ANNEE = new Date().getFullYear()
const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Afi vend un carton, 2 unités de tomate et un jus : 8 800 F en espèces. Mme Abra est cliente. */
function preparer(): { db: Db; abra: number; numero: string; venteId: number } {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  const abra = creerClient(db, KOSSI, { nom: 'Mme Abra', telephone: '90 00 00 01', plafondCredit: 0 }).id
  const v = enregistrerVente(db, AFI.id, {
    lignes: [
      { conditionnementId: id(db, CARTON), quantite: 1 },
      { conditionnementId: id(db, UNITE), quantite: 2 },
      { conditionnementId: id(db, JUS), quantite: 1 }
    ],
    paiements: [{ mode: 'especes', montant: 8800 }]
  })
  return { db, abra, numero: v.numeroTicket, venteId: v.venteId }
}

const ligne = (db: Db, numero: string, texte: string): number =>
  consulterRetour(db, KOSSI, numero).lignes.find((l) => l.designation.includes(texte))!.ligneId

const enAvoir = (
  numero: string,
  lignes: RequeteRetour['lignes'],
  clientId?: number,
  autres: Partial<RequeteRetour> = {}
): RequeteRetour => ({
  numeroTicket: numero,
  lignes,
  motif: 'defectueux',
  sort: 'detruire',
  remboursement: { mode: 'avoir' },
  ...(clientId !== undefined && { clientId }),
  autorisation: ACCORD_KOSSI,
  ...autres
})

describe('Avoir en boutique — création par un retour (A11)', () => {
  it('le jus (600 F) rendu en avoir : un avoir au nom du client, rien dans le tiroir', () => {
    const { db, abra, numero } = preparer()
    const jus = ligne(db, numero, 'ananas')
    const avant = rapportSession(db, 1).especesTheoriques

    const r = enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: jus, quantite: 1 }], abra))

    expect(r.mode).toBe('avoir')
    expect(r.montant).toBe(600)
    expect(r.avoir).toEqual({
      numero: `AV-${ANNEE}-000001`,
      montant: 600,
      client: 'Mme Abra',
      soldeClient: 600
    })
    // Paiement négatif de mode avoir, sans référence.
    expect(
      toutes(db, 'SELECT mode, montant, reference FROM paiements WHERE vente_id = ?', r.venteId)
    ).toEqual([{ mode: 'avoir', montant: -600, reference: null }])
    // Les espèces du tiroir ne bougent pas.
    expect(rapportSession(db, 1).especesTheoriques).toBe(avant)
    expect(soldeAvoirs(db, abra)).toBe(600)
    expect(avoirsDuClient(db, abra)).toMatchObject([
      { numero: `AV-${ANNEE}-000001`, montantInitial: 600, utilise: 0, solde: 600 }
    ])
    expect(ficheClient(db, abra).soldeAvoir).toBe(600)
  })

  it('exige un client, actif', () => {
    const { db, abra, numero } = preparer()
    const jus = ligne(db, numero, 'ananas')
    expect(() => enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: jus, quantite: 1 }]))).toThrow(
      /choisissez le client/
    )
    expect(() => enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: jus, quantite: 1 }], 999))).toThrow(
      /introuvable/
    )
    desactiverClient(db, KOSSI, abra, 'test')
    expect(() =>
      enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: jus, quantite: 1 }], abra))
    ).toThrow(/désactivé/)
    // Aucun retour n'a été enregistré.
    expect(une<{ n: number }>(db, "SELECT COUNT(*) AS n FROM ventes WHERE type = 'retour'")!.n).toBe(0)
  })

  it('un client qui a un avoir ne se désactive pas', () => {
    const { db, abra, numero } = preparer()
    enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }], abra))
    expect(() => desactiverClient(db, KOSSI, abra, 'part')).toThrow(/avoir en boutique/)
  })
})

describe('Avoir en boutique — dépense et rétablissement', () => {
  /** Deux avoirs pour Mme Abra : 600 F (jus) puis 700 F (deux unités de tomate). */
  function avecDeuxAvoirs(): { db: Db; abra: number; venteId: number } {
    const { db, abra, numero, venteId } = preparer()
    enregistrerRetour(db, AFI, enAvoir(numero, [{ ligneId: ligne(db, numero, 'ananas'), quantite: 1 }], abra))
    enregistrerRetour(
      db,
      AFI,
      enAvoir(numero, [{ ligneId: ligne(db, numero, 'Tomate'), quantite: 1 }], abra, {
        motif: 'erreur_article'
      })
    )
    return { db, abra, venteId }
  }

  it('dépense les plus anciens d’abord et garde le solde', () => {
    const { db, abra, venteId } = avecDeuxAvoirs()
    const total = soldeAvoirs(db, abra)
    expect(total).toBeGreaterThan(600)

    const detail = depenserAvoirs(db, { clientId: abra, venteId, montant: 800, utilisateurId: AFI.id })

    expect(detail.map((d) => d.montant)).toEqual([600, 200])
    expect(detail[0].numero).toBe(`AV-${ANNEE}-000001`)
    expect(soldeAvoirs(db, abra)).toBe(total - 800)
    const [ancien, recent] = avoirsDuClient(db, abra).reverse()
    expect(ancien.solde).toBe(0)
    expect(recent.utilise).toBe(200)
  })

  it('refuse de dépenser plus que le solde', () => {
    const { db, abra, venteId } = avecDeuxAvoirs()
    const total = soldeAvoirs(db, abra)
    expect(() =>
      depenserAvoirs(db, { clientId: abra, venteId, montant: total + 1, utilisateurId: AFI.id })
    ).toThrow(/impossible d’en dépenser/)
    expect(soldeAvoirs(db, abra)).toBe(total)
  })

  it('rétablit par des lignes négatives, une seule fois, sans rien effacer', () => {
    const { db, abra, venteId } = avecDeuxAvoirs()
    const total = soldeAvoirs(db, abra)
    depenserAvoirs(db, { clientId: abra, venteId, montant: 800, utilisateurId: AFI.id })

    expect(retablirAvoirs(db, venteId, AFI.id)).toBe(800)
    expect(soldeAvoirs(db, abra)).toBe(total)
    expect(retablirAvoirs(db, venteId, AFI.id)).toBe(0)
    expect(
      toutes<{ montant: number }>(db, 'SELECT montant FROM utilisations_avoir ORDER BY id').map((u) => u.montant)
    ).toEqual([600, 200, -600, -200])
  })

  it('les triggers refusent de modifier, d’effacer ou de dépasser le solde', () => {
    const { db, abra, venteId } = avecDeuxAvoirs()
    depenserAvoirs(db, { clientId: abra, venteId, montant: 100, utilisateurId: AFI.id })
    expect(() => executer(db, 'UPDATE avoirs SET montant = 1')).toThrow(/ne se modifie pas/)
    expect(() => executer(db, 'DELETE FROM avoirs')).toThrow(/ne se supprime pas/)
    expect(() => executer(db, 'UPDATE utilisations_avoir SET montant = 1')).toThrow(/ne se modifie pas/)
    expect(() => executer(db, 'DELETE FROM utilisations_avoir')).toThrow(/ne se supprime pas/)
    expect(() =>
      executer(
        db,
        'INSERT INTO utilisations_avoir (avoir_id, vente_id, montant, utilisateur_id) VALUES (1, ?, 600, 2)',
        venteId
      )
    ).toThrow(/solde de l’avoir|solde de l'avoir/)
  })
})
