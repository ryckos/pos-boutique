import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import {
  creerClient,
  desactiverClient,
  encoursClient,
  ficheClient,
  modifierClient,
  rechercherClients
} from '../src/main/modules/clients/service'
import { ouvrirSession, sessionOuverte } from '../src/main/modules/caisse/service-session'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const ABRA = { nom: 'Mme Abra', telephone: '90 00 00 01', adresse: 'Bè, Lomé' }

const journal = (db: Db, action: string): { avant: string | null; apres: string | null }[] =>
  toutes(
    db,
    'SELECT ancienne_valeur AS avant, nouvelle_valeur AS apres FROM journal_audit WHERE action = ?',
    action
  )

/**
 * Créance posée à la main sur un vrai ticket (la vente à crédit arrive dans la PR suivante).
 * `jours` : échéance par rapport à aujourd'hui.
 */
function creance(db: Db, clientId: number, montant: number, jours: number): number {
  if (!sessionOuverte(db, KOSSI.id)) ouvrirSession(db, KOSSI.id, 0)
  const v = enregistrerVente(db, KOSSI.id, {
    lignes: [{ conditionnementId: rechercherParCode(db, '101')!.conditionnementId, quantite: 1 }],
    paiements: [{ mode: 'especes', montant: 300 }]
  })
  return executer(
    db,
    `INSERT INTO creances (vente_id, client_id, montant_initial, date_echeance)
     VALUES (?, ?, ?, date('now','localtime', ?))`,
    v.venteId,
    clientId,
    montant,
    `${jours} days`
  ).id
}

describe('Fiche client (A11)', () => {
  it('la caissière crée un client sans plafond ; espaces nettoyés, journal', () => {
    const db = baseAvecDemo()
    const c = creerClient(db, AFI, { nom: '  Mme   Abra ', telephone: '90 00 00 01', adresse: '' })
    expect(c).toMatchObject({
      nom: 'Mme Abra',
      telephone: '90 00 00 01',
      adresse: null,
      plafondCredit: 0,
      actif: true,
      encours: 0
    })
    expect(journal(db, 'creation_client')).toHaveLength(1)
  })

  it('la caissière ne fixe ni ne change un plafond ; le gérant oui, journalisé', () => {
    const db = baseAvecDemo()
    expect(() => creerClient(db, AFI, { ...ABRA, plafondCredit: 20000 })).toThrow(/Seul le gérant/)
    const c = creerClient(db, AFI, ABRA)
    expect(() => modifierClient(db, AFI, c.id, { ...ABRA, plafondCredit: 20000 })).toThrow(/Seul le gérant/)
    // La caissière corrige l'adresse sans toucher au plafond.
    expect(modifierClient(db, AFI, c.id, { ...ABRA, adresse: 'Tokoin' }).adresse).toBe('Tokoin')
    expect(
      modifierClient(db, KOSSI, c.id, { ...ABRA, adresse: 'Tokoin', plafondCredit: 20000 }).plafondCredit
    ).toBe(20000)
    // Plafond absent à la modification = inchangé.
    expect(modifierClient(db, AFI, c.id, { ...ABRA }).plafondCredit).toBe(20000)
    const plafonds = journal(db, 'plafond_credit')
    expect(plafonds).toHaveLength(1)
    expect(JSON.parse(plafonds[0].avant!).plafond).toBe(0)
    expect(JSON.parse(plafonds[0].apres!).plafond).toBe(20000)
    expect(journal(db, 'modification_client')).toHaveLength(2)
  })

  it('refuse : nom vide, plafond négatif ou à virgule, téléphone absent avec un plafond, téléphone incomplet', () => {
    const db = baseAvecDemo()
    expect(() => creerClient(db, KOSSI, { nom: '  ' })).toThrow(/nom du client est obligatoire/)
    expect(() => creerClient(db, KOSSI, { ...ABRA, plafondCredit: -1 })).toThrow(/montant entier/)
    expect(() => creerClient(db, KOSSI, { ...ABRA, plafondCredit: 100.5 })).toThrow(/montant entier/)
    expect(() => creerClient(db, KOSSI, { nom: 'Mme Abra', plafondCredit: 5000 })).toThrow(
      /doit avoir un téléphone/
    )
    expect(() => creerClient(db, KOSSI, { nom: 'Mme Abra', telephone: '90 00' })).toThrow(/incomplet/)
    expect(toutes(db, 'SELECT id FROM clients')).toHaveLength(0)
  })

  it('refuse un téléphone déjà pris par un client actif, quelle que soit sa saisie', () => {
    const db = baseAvecDemo()
    creerClient(db, AFI, ABRA)
    expect(() => creerClient(db, AFI, { nom: 'Abra K.', telephone: '90000001' })).toThrow(
      /déjà celui de « Mme Abra »/
    )
    // Deux clients de même nom sans téléphone restent possibles.
    creerClient(db, AFI, { nom: 'Koffi' })
    expect(creerClient(db, AFI, { nom: 'Koffi' }).nom).toBe('Koffi')
  })

  it('recherche par nom ou par téléphone, actifs par ordre alphabétique', () => {
    const db = baseAvecDemo()
    creerClient(db, AFI, ABRA)
    creerClient(db, AFI, { nom: 'Ama Boutique', telephone: '91-22-33-44' })
    creerClient(db, AFI, { nom: 'Yao' })
    expect(rechercherClients(db).map((c) => c.nom)).toEqual(['Ama Boutique', 'Mme Abra', 'Yao'])
    expect(rechercherClients(db, 'ab').map((c) => c.nom)).toEqual(['Mme Abra'])
    expect(rechercherClients(db, '9122').map((c) => c.nom)).toEqual(['Ama Boutique'])
  })

  it('encours = restant dû des créances, part échue à part ; fiche avec les créances', () => {
    const db = baseAvecDemo()
    const c = creerClient(db, KOSSI, { ...ABRA, plafondCredit: 20000 })
    creance(db, c.id, 8400, 30)
    const echue = creance(db, c.id, 3000, -5)
    executer(
      db,
      `INSERT INTO encaissements_creances (creance_id, montant, mode, session_caisse_id, utilisateur_id)
       VALUES (?, 1000, 'especes', 1, ?)`,
      echue,
      KOSSI.id
    )
    expect(encoursClient(db, c.id)).toBe(10400)
    const f = ficheClient(db, c.id)
    expect(f).toMatchObject({ encours: 10400, enRetard: 2000 })
    expect(f.creances).toHaveLength(2)
    expect(f.creances.find((x) => x.id === echue)).toMatchObject({
      montantInitial: 3000,
      encaisse: 1000,
      restantDu: 2000,
      statut: 'ouverte',
      enRetard: true
    })
  })

  it('une créance annulée ne compte plus dans l’encours', () => {
    const db = baseAvecDemo()
    const c = creerClient(db, KOSSI, { ...ABRA, plafondCredit: 20000 })
    const id = creance(db, c.id, 8400, 30)
    executer(
      db,
      "UPDATE creances SET annulee_le = datetime('now','localtime'), motif_annulation = 'x' WHERE id = ?",
      id
    )
    expect(encoursClient(db, c.id)).toBe(0)
    expect(ficheClient(db, c.id).creances[0].statut).toBe('annulee')
  })

  it('désactivation : motif obligatoire, refusée tant que le client doit ; puis exclu de la recherche', () => {
    const db = baseAvecDemo()
    const c = creerClient(db, KOSSI, { ...ABRA, plafondCredit: 20000 })
    expect(() => desactiverClient(db, KOSSI, c.id, ' ')).toThrow(/motif/)
    creance(db, c.id, 8400, 30)
    expect(() => desactiverClient(db, KOSSI, c.id, 'Parti')).toThrow(/doit encore 8\s400/)
    const yao = creerClient(db, AFI, { nom: 'Yao' })
    desactiverClient(db, KOSSI, yao.id, 'Doublon')
    expect(rechercherClients(db).map((x) => x.nom)).toEqual(['Mme Abra'])
    expect(rechercherClients(db, undefined, true).map((x) => x.nom)).toEqual(['Mme Abra', 'Yao'])
    expect(() => modifierClient(db, KOSSI, yao.id, { nom: 'Yao' })).toThrow(/désactivé/)
    expect(journal(db, 'desactivation_client')).toHaveLength(1)
  })
})

describe('Immutabilité des clients et créances (A11)', () => {
  it('ni suppression de client, ni de créance ; montant figé ; annulation définitive ; encaissement immuable', () => {
    const db = baseAvecDemo()
    const c = creerClient(db, KOSSI, { ...ABRA, plafondCredit: 20000 })
    const id = creance(db, c.id, 8400, 30)
    const enc = executer(
      db,
      `INSERT INTO encaissements_creances (creance_id, montant, mode, session_caisse_id, utilisateur_id)
       VALUES (?, 1000, 'especes', 1, ?)`,
      id,
      KOSSI.id
    ).id
    expect(() => executer(db, 'DELETE FROM clients WHERE id = ?', c.id)).toThrow(/ne se supprime pas/)
    expect(() => executer(db, 'DELETE FROM creances WHERE id = ?', id)).toThrow(/ne se supprime pas/)
    expect(() => executer(db, 'UPDATE creances SET montant_initial = 1 WHERE id = ?', id)).toThrow(
      /ne se modifient pas/
    )
    expect(() => executer(db, 'UPDATE encaissements_creances SET montant = 1 WHERE id = ?', enc)).toThrow(
      /ne se modifie pas/
    )
    expect(() => executer(db, 'DELETE FROM encaissements_creances WHERE id = ?', enc)).toThrow(
      /ne se supprime pas/
    )
    executer(db, "UPDATE creances SET annulee_le = datetime('now','localtime') WHERE id = ?", id)
    expect(() => executer(db, "UPDATE creances SET statut = 'soldee' WHERE id = ?", id)).toThrow(/annulée/)
  })
})
