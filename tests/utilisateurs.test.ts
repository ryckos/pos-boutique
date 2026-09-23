import { afterEach, describe, expect, it } from 'vitest'
import type { UtilisateurConnecte } from '../src/shared/types'
import {
  changerRole,
  creerCompte,
  desactiverCompte,
  listerComptes,
  reinitialiserCode
} from '../src/main/modules/utilisateurs/service'
import { comptesConnexion, connexion } from '../src/main/modules/auth/service'
import { session } from '../src/main/core/session'
import { toutes } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

const PATRON: UtilisateurConnecte = { id: 1, nom: 'Patron', role: 'admin' }
const AFI = 2
const KOSSI = 3

function journal(db: Db, action: string): Array<{ auteur: number; entiteId: number; avant: string; apres: string }> {
  return toutes(
    db,
    `SELECT utilisateur_id AS auteur, entite_id AS entiteId, ancienne_valeur AS avant, nouvelle_valeur AS apres
     FROM journal_audit WHERE action = ?`,
    action
  )
}

describe('Liste des comptes', () => {
  it('liste les 3 comptes de démo, actifs, avec des codes personnels', () => {
    const comptes = listerComptes(baseAvecDemo())
    expect(comptes.map((c) => c.nom)).toEqual(['Afi', 'Kossi', 'Patron'])
    expect(comptes.every((c) => c.actif && !c.codeProvisoire)).toBe(true)
  })
})

describe('Création de compte', () => {
  it('crée un compte avec un code provisoire et journalise la création', () => {
    const db = baseAvecDemo()
    const id = creerCompte(db, PATRON, 'Yao', '4444', 'caissier')
    expect(connexion(db, id, '4444')).toEqual({ codeProvisoire: true })
    expect(listerComptes(db).find((c) => c.id === id)).toMatchObject({ codeProvisoire: true })
    const [e] = journal(db, 'creation_utilisateur')
    expect(e).toMatchObject({ auteur: 1, entiteId: id })
    expect(JSON.parse(e.apres)).toEqual({ nom: 'Yao', role: 'caissier', codeProvisoire: true })
  })

  it('accepte un code déjà porté par un autre compte (le message ne révèle plus rien)', () => {
    const db = baseAvecDemo()
    expect(() => creerCompte(db, PATRON, 'Yao', '1234', 'caissier')).not.toThrow()
  })

  it('refuse un rôle inconnu, un nom vide, un code mal formé', () => {
    const db = baseAvecDemo()
    expect(() => creerCompte(db, PATRON, 'Yao', '4444', 'patron' as never)).toThrow(/Rôle inconnu/)
    expect(() => creerCompte(db, PATRON, '  ', '4444', 'caissier')).toThrow(/nom est obligatoire/)
    expect(() => creerCompte(db, PATRON, 'Yao', '44', 'caissier')).toThrow(/4 chiffres/)
    expect(journal(db, 'creation_utilisateur')).toHaveLength(0)
  })
})

describe('Réinitialisation du code (code oublié)', () => {
  it('donne un code provisoire : l’ancien ne marche plus, Afi doit choisir le sien', () => {
    const db = baseAvecDemo()
    reinitialiserCode(db, PATRON, AFI, '7777')
    expect(() => connexion(db, AFI, '0000')).toThrow('Code incorrect')
    expect(connexion(db, AFI, '7777')).toEqual({ codeProvisoire: true })
    const [e] = journal(db, 'reinitialisation_pin')
    expect(e).toMatchObject({ auteur: 1, entiteId: AFI, avant: null, apres: null })
  })

  it('débloque un compte verrouillé', () => {
    const db = baseAvecDemo()
    for (let i = 0; i < 5; i++) expect(() => connexion(db, AFI, '9999')).toThrow()
    expect(() => connexion(db, AFI, '0000')).toThrow(/Trop de codes faux/)
    reinitialiserCode(db, PATRON, AFI, '7777')
    expect(connexion(db, AFI, '7777')).toEqual({ codeProvisoire: true })
  })

  it('refuse sur son propre compte (il y a « Mon code ») et sur un compte désactivé', () => {
    const db = baseAvecDemo()
    expect(() => reinitialiserCode(db, PATRON, 1, '7777')).toThrow(/Mon code/)
    desactiverCompte(db, PATRON, AFI, 'Départ')
    expect(() => reinitialiserCode(db, PATRON, AFI, '7777')).toThrow(/désactivé/)
  })
})

describe('Changement de rôle', () => {
  it('fait d’Afi une gérante et journalise l’avant et l’après', () => {
    const db = baseAvecDemo()
    changerRole(db, PATRON, AFI, 'gerant')
    expect(connexion(db, AFI, '0000')).toMatchObject({ utilisateur: { role: 'gerant' } })
    const [e] = journal(db, 'modification_role')
    expect(JSON.parse(e.avant)).toEqual({ role: 'caissier' })
    expect(JSON.parse(e.apres)).toEqual({ role: 'gerant' })
  })

  it('ne journalise rien si le rôle ne change pas', () => {
    const db = baseAvecDemo()
    changerRole(db, PATRON, AFI, 'caissier')
    expect(journal(db, 'modification_role')).toHaveLength(0)
  })

  it('refuse de rétrograder le dernier admin, accepte s’il y en a un autre', () => {
    const db = baseAvecDemo()
    expect(() => changerRole(db, PATRON, 1, 'gerant')).toThrow(/au moins un administrateur/)
    changerRole(db, PATRON, KOSSI, 'admin')
    expect(() => changerRole(db, PATRON, 1, 'gerant')).not.toThrow()
  })
})

describe('Désactivation (jamais de suppression)', () => {
  it('désactive Afi : son code est refusé, le compte reste listé, le motif est journalisé', () => {
    const db = baseAvecDemo()
    desactiverCompte(db, PATRON, AFI, 'Fin de contrat')
    expect(() => connexion(db, AFI, '0000')).toThrow(/désactivé/)
    expect(listerComptes(db).find((c) => c.id === AFI)).toMatchObject({ actif: false })
    const [e] = journal(db, 'desactivation_utilisateur')
    expect(JSON.parse(e.apres)).toEqual({ actif: false, motif: 'Fin de contrat' })
  })

  it('le compte désactivé n’est plus proposé à la connexion', () => {
    const db = baseAvecDemo()
    desactiverCompte(db, PATRON, AFI, 'Départ')
    expect(comptesConnexion(db).map((c) => c.nom)).toEqual(['Kossi', 'Patron'])
  })

  it('refuse sans motif, sur soi-même, sur un compte déjà désactivé ou inconnu', () => {
    const db = baseAvecDemo()
    expect(() => desactiverCompte(db, PATRON, AFI, '  ')).toThrow(/motif/)
    expect(() => desactiverCompte(db, PATRON, 1, 'Test')).toThrow(/propre compte/)
    desactiverCompte(db, PATRON, AFI, 'Départ')
    expect(() => desactiverCompte(db, PATRON, AFI, 'Encore')).toThrow(/désactivé/)
    expect(() => desactiverCompte(db, PATRON, 99, 'Inconnu')).toThrow(/introuvable/)
  })

  it('refuse de désactiver le dernier admin actif', () => {
    const db = baseAvecDemo()
    changerRole(db, PATRON, KOSSI, 'admin')
    const kossi: UtilisateurConnecte = { id: KOSSI, nom: 'Kossi', role: 'admin' }
    desactiverCompte(db, kossi, 1, 'Passation')
    expect(() => changerRole(db, kossi, KOSSI, 'gerant')).toThrow(/au moins un administrateur/)
  })
})

describe('Droits (matrice du chapitre 5)', () => {
  afterEach(() => session.effacer())

  it('la gestion des comptes est réservée à l’admin', () => {
    session.definir({ id: KOSSI, nom: 'Kossi', role: 'gerant' })
    expect(() => session.exiger(['admin'])).toThrow(/non autorisée/)
    session.definir({ id: AFI, nom: 'Afi', role: 'caissier' })
    expect(() => session.exiger(['admin'])).toThrow(/non autorisée/)
    session.definir(PATRON)
    expect(session.exiger(['admin'])).toEqual(PATRON)
  })

  it('le gérant passe là où le gérant est exigé, l’admin passe partout, personne sans session', () => {
    session.definir({ id: KOSSI, nom: 'Kossi', role: 'gerant' })
    expect(() => session.exiger(['gerant'])).not.toThrow()
    session.definir(PATRON)
    expect(() => session.exiger(['gerant'])).not.toThrow()
    session.effacer()
    expect(() => session.exiger()).toThrow(/Session expirée/)
  })
})
