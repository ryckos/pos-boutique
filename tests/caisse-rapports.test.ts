import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, une } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { annulerTicket } from '../src/main/modules/caisse/service-annulation'
import { facturer } from '../src/main/modules/caisse/service-facture'
import { ventesPeriode } from '../src/main/modules/caisse/service-rapports'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const CARTON = '16181000000049' // 7 500 F, coût 24 × 250 = 6 000
const UNITE = '6181000000042' // 350 F, coût 250

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId
const aujourdhui = (db: Db): string => une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
const hier = (db: Db): string => une<{ j: string }>(db, "SELECT date('now','localtime','-1 day') AS j")!.j

function vendre(
  db: Db,
  u: UtilisateurConnecte,
  lignes: RequeteVente['lignes'],
  total: number,
  remiseGlobale = 0
) {
  return enregistrerVente(db, u.id, {
    lignes,
    remiseGlobale,
    paiements: [{ mode: 'especes', montant: total }]
  })
}

/** Recule une vente d'un jour : `ventes` n'a pas de trigger d'UPDATE, la base de test le permet. */
function dateeHier(db: Db, venteId: number): void {
  executer(db, "UPDATE ventes SET horodatage = datetime('now','localtime','-1 day') WHERE id = ?", venteId)
}

/**
 * Afi : ticket 1 = 1 carton + 2 unités de tomate (8 200 F, coût 6 500). Kossi : ticket 2 = 3 unités
 * avec 50 F de remise sur le ticket (1 000 F, coût 750), ticket 3 annulé. Kossi reprend 1 unité du
 * ticket 1 (350 F rendus, coût 250).
 */
function semaine(): { db: Db; ticket1: { venteId: number; numeroTicket: string } } {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  ouvrirSession(db, KOSSI.id, 10000)
  const ticket1 = vendre(
    db,
    AFI,
    [
      { conditionnementId: id(db, CARTON), quantite: 1 },
      { conditionnementId: id(db, UNITE), quantite: 2 }
    ],
    8200
  )
  vendre(db, KOSSI, [{ conditionnementId: id(db, UNITE), quantite: 3 }], 1000, 50)
  const t3 = vendre(db, KOSSI, [{ conditionnementId: id(db, CARTON), quantite: 1 }], 7500)
  annulerTicket(db, KOSSI, { numeroTicket: t3.numeroTicket, motif: 'Erreur de saisie' })
  const ligneUnite = consulterRetour(db, KOSSI, ticket1.numeroTicket).lignes.find(
    (l) => !l.designation.includes('Carton')
  )!
  enregistrerRetour(db, KOSSI, {
    numeroTicket: ticket1.numeroTicket,
    lignes: [{ ligneId: ligneUnite.ligneId, quantite: 1 }],
    motif: 'defectueux',
    sort: 'detruire',
    remboursement: { mode: 'especes' }
  })
  return { db, ticket1 }
}

describe('Ventes d’une période (A14, caisse:ventesPeriode)', () => {
  it('chiffre d’affaires, coût et marge : remise sur le ticket déduite, annulé ignoré, retour en moins', () => {
    const { db } = semaine()
    const r = ventesPeriode(db, {})
    expect(r).toMatchObject({
      nbTickets: 2,
      nbRetours: 1,
      ventesTtc: 9200,
      retoursTtc: -350,
      chiffreAffaires: 8850,
      cout: 7000,
      marge: 1850
    })
    expect(r.chiffreAffairesHt + r.tva).toBe(r.chiffreAffaires)
    expect(r.margeHt).toBe(r.chiffreAffairesHt - 7000)
  })

  it('un ticket d’une autre journée est hors période ; son retour compte à sa propre date', () => {
    const { db, ticket1 } = semaine()
    dateeHier(db, ticket1.venteId)
    const jour = aujourdhui(db)
    const r = ventesPeriode(db, { du: jour, au: jour })
    expect(r).toMatchObject({ nbTickets: 1, nbRetours: 1, chiffreAffaires: 650, cout: 500, marge: 150 })
    const veille = ventesPeriode(db, { du: hier(db), au: hier(db) })
    expect(veille).toMatchObject({
      nbTickets: 1,
      nbRetours: 0,
      chiffreAffaires: 8200,
      cout: 6500,
      marge: 1700
    })
  })

  it('une facture ne crée aucune vente', () => {
    const { db, ticket1 } = semaine()
    const avant = ventesPeriode(db, {})
    facturer(db, KOSSI, { numeroTicket: ticket1.numeroTicket, client: { nom: 'Mme Abra' } })
    expect(ventesPeriode(db, {})).toEqual(avant)
  })

  it('période vide : tout à zéro ; mois en cours par défaut', () => {
    const db = baseAvecDemo()
    const r = ventesPeriode(db)
    expect(r).toMatchObject({ nbTickets: 0, nbRetours: 0, chiffreAffaires: 0, cout: 0, marge: 0 })
    expect(r.du).toBe(`${aujourdhui(db).slice(0, 8)}01`)
    expect(r.au).toBe(aujourdhui(db))
  })

  it('refuse une fin de période dans le futur', () => {
    const db = baseAvecDemo()
    expect(() => ventesPeriode(db, { au: '2999-01-01' })).toThrow(/futur/)
  })
})
