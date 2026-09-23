import { describe, expect, it } from 'vitest'
import {
  changerMonCode,
  comptesConnexion,
  connexion,
  creerPremierAdmin,
  creerUtilisateur,
  definirCodePersonnel,
  etatDemarrage,
  etatVerrouillage
} from '../src/main/modules/auth/service'
import { hacherPin, verifierPin } from '../src/main/core/securite'
import { formaterDate, formaterDelai } from '../src/shared/format'
import { une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo, baseDeTest } from './aide'

const PATRON = 1
const AFI = 2
const KOSSI = 3
const T0 = 1_800_000_000_000

// scrypt est volontairement lent : les scénarios à 20-30 tentatives demandent plus que 5 s.
const LONG = 30_000

/** Tente n codes faux sur un compte à l'instant t. */
function codesFaux(db: Db, id: number, n: number, t: number): void {
  for (let i = 0; i < n; i++) expect(() => connexion(db, id, '9999', t)).toThrow()
}

function compterJournal(db: Db, action: string): number {
  return une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM journal_audit WHERE action = ?', action)!.n
}

describe('Connexion : toucher son nom, puis taper son code (D-17)', () => {
  it('ne stocke jamais le PIN en clair', () => {
    const h = hacherPin('1234')
    expect(h).not.toContain('1234')
    expect(verifierPin('1234', h)).toBe(true)
    expect(verifierPin('4321', h)).toBe(false)
  })

  it('propose les comptes actifs par ordre alphabétique, sans rôle ni code', () => {
    expect(comptesConnexion(baseAvecDemo())).toEqual([
      { id: AFI, nom: 'Afi' },
      { id: KOSSI, nom: 'Kossi' },
      { id: PATRON, nom: 'Patron' }
    ])
  })

  it('connecte avec le code du compte touché, refuse le code d’un autre compte', () => {
    const db = baseAvecDemo()
    expect(connexion(db, AFI, '0000')).toEqual({ utilisateur: { id: AFI, nom: 'Afi', role: 'caissier' } })
    expect(() => connexion(db, AFI, '1234')).toThrow('Code incorrect')
    expect(() => connexion(db, AFI, '12')).toThrow(/4 chiffres/)
  })

  it('accepte deux comptes avec le même code : c’est le nom qui identifie', () => {
    const db = baseAvecDemo()
    const id = creerUtilisateur(db, 'Yao', '0000', 'caissier')
    expect(connexion(db, id, '0000')).toMatchObject({ utilisateur: { nom: 'Yao' } })
    expect(connexion(db, AFI, '0000')).toMatchObject({ utilisateur: { nom: 'Afi' } })
  })

  it('refuse un compte inconnu', () => {
    expect(() => connexion(baseAvecDemo(), 99, '0000')).toThrow(/introuvable ou désactivé/)
  })
})

describe('Verrouillage après 5 codes faux, compte par compte (règle 12)', () => {
  it('4 codes faux puis le bon code : connectée, et le compteur repart de zéro', () => {
    const db = baseAvecDemo()
    codesFaux(db, AFI, 4, T0)
    expect(connexion(db, AFI, '0000', T0)).toMatchObject({ utilisateur: { nom: 'Afi' } })
    codesFaux(db, AFI, 4, T0) // sans remise à zéro, le 1er serait le 5e et verrouillerait
    expect(compterJournal(db, 'echec_connexion_verrouillage')).toBe(0)
  })

  it('5 codes faux : Afi verrouillée 30 s, même avec son bon code ; journalisé à son nom', () => {
    const db = baseAvecDemo()
    codesFaux(db, AFI, 4, T0)
    expect(() => connexion(db, AFI, '9999', T0)).toThrow('Trop de codes faux. Réessayez dans 30 s.')
    expect(() => connexion(db, AFI, '0000', T0 + 10_000)).toThrow('Réessayez dans 20 s.')
    expect(etatVerrouillage(db, AFI, T0 + 10_000)).toEqual({ resteMs: 20_000 })
    expect(etatVerrouillage(db, AFI, T0 + 40_000)).toEqual({ resteMs: 0 })
    const e = une<{ auteur: number; entiteId: number; apres: string }>(
      db,
      `SELECT utilisateur_id AS auteur, entite_id AS entiteId, nouvelle_valeur AS apres
       FROM journal_audit WHERE action = 'echec_connexion_verrouillage'`
    )!
    expect(e).toMatchObject({ auteur: AFI, entiteId: AFI })
    expect(JSON.parse(e.apres)).toEqual({ verrouillage: 1, delaiSecondes: 30 })
  })

  it('le verrouillage d’Afi ne bloque pas Kossi', () => {
    const db = baseAvecDemo()
    codesFaux(db, AFI, 5, T0)
    expect(connexion(db, KOSSI, '5678', T0)).toMatchObject({ utilisateur: { nom: 'Kossi' } })
    expect(etatVerrouillage(db, KOSSI, T0)).toEqual({ resteMs: 0 })
  })

  it('après le délai, le bon code passe', () => {
    const db = baseAvecDemo()
    codesFaux(db, AFI, 5, T0)
    expect(connexion(db, AFI, '0000', T0 + 30_000)).toMatchObject({ utilisateur: { nom: 'Afi' } })
  })

  it('le délai croît (30 s, 1, 2, 5 min) et plafonne à 15 min', () => {
    const db = baseAvecDemo()
    let t = T0
    const messages: string[] = []
    for (let i = 0; i < 6; i++) {
      codesFaux(db, AFI, 4, t)
      try {
        connexion(db, AFI, '9999', t)
      } catch (e) {
        messages.push((e as Error).message)
      }
      t += 20 * 60_000 // on attend toujours la fin du verrouillage
    }
    expect(messages.map((m) => m.replace(/.*dans (.*)\./, '$1'))).toEqual([
      '30 s', '1 min', '2 min', '5 min', '15 min', '15 min'
    ])
    expect(compterJournal(db, 'echec_connexion_verrouillage')).toBe(6)
  }, LONG)

  it('une connexion réussie remet le délai à 30 s', () => {
    const db = baseAvecDemo()
    codesFaux(db, AFI, 5, T0)
    codesFaux(db, AFI, 5, T0 + 30_000) // 2e verrouillage : 1 min
    connexion(db, AFI, '0000', T0 + 30_000 + 60_000)
    codesFaux(db, AFI, 4, T0 + 200_000)
    expect(() => connexion(db, AFI, '9999', T0 + 200_000)).toThrow('dans 30 s.')
  }, LONG)

  it('un code mal formé ne compte pas comme une tentative', () => {
    const db = baseAvecDemo()
    for (let i = 0; i < 10; i++) expect(() => connexion(db, AFI, '12', T0)).toThrow(/4 chiffres/)
    expect(connexion(db, AFI, '0000', T0)).toMatchObject({ utilisateur: { nom: 'Afi' } })
  })

  it('formate le délai restant et la date', () => {
    expect(formaterDelai(30_000)).toBe('30 s')
    expect(formaterDelai(400)).toBe('1 s')
    expect(formaterDelai(61_000)).toBe('2 min')
    expect(formaterDelai(900_000)).toBe('15 min')
    expect(formaterDate('2026-09-23 11:21:00')).toBe('23/09/2026')
  })
})

describe('Code provisoire : l’admin ne connaît jamais le code définitif', () => {
  it('avec un code provisoire, aucune session : il faut d’abord choisir son code', () => {
    const db = baseAvecDemo()
    const id = creerUtilisateur(db, 'Yao', '4444', 'caissier', true)
    expect(connexion(db, id, '4444')).toEqual({ codeProvisoire: true })

    expect(definirCodePersonnel(db, id, '4444', '2468')).toEqual({ id, nom: 'Yao', role: 'caissier' })
    expect(() => connexion(db, id, '4444')).toThrow('Code incorrect')
    expect(connexion(db, id, '2468')).toMatchObject({ utilisateur: { nom: 'Yao' } })
    expect(compterJournal(db, 'modification_pin')).toBe(1)
  })

  it('refuse de garder le code provisoire, ou un code provisoire faux (compté pour le verrouillage)', () => {
    const db = baseAvecDemo()
    const id = creerUtilisateur(db, 'Yao', '4444', 'caissier', true)
    expect(() => definirCodePersonnel(db, id, '4444', '4444')).toThrow(/différent/)
    for (let i = 0; i < 4; i++) expect(() => definirCodePersonnel(db, id, '1111', '2468', T0)).toThrow('Code incorrect')
    expect(() => definirCodePersonnel(db, id, '1111', '2468', T0)).toThrow(/Trop de codes faux/)
  })

  it('n’est pas utilisable sur un code déjà personnel', () => {
    expect(() => definirCodePersonnel(baseAvecDemo(), AFI, '0000', '2468')).toThrow(/déjà personnel/)
  })
})

describe('Mon code', () => {
  const afi = { id: AFI, nom: 'Afi', role: 'caissier' as const }

  it('change son code en donnant l’actuel, et le journalise sans la valeur', () => {
    const db = baseAvecDemo()
    changerMonCode(db, afi, '0000', '3579')
    expect(connexion(db, AFI, '3579')).toMatchObject({ utilisateur: { nom: 'Afi' } })
    const e = une<{ auteur: number; avant: null; apres: null }>(
      db,
      `SELECT utilisateur_id AS auteur, ancienne_valeur AS avant, nouvelle_valeur AS apres
       FROM journal_audit WHERE action = 'modification_pin'`
    )
    expect(e).toEqual({ auteur: AFI, avant: null, apres: null })
  })

  it('refuse un code actuel faux (compté pour le verrouillage) ou un nouveau code identique', () => {
    const db = baseAvecDemo()
    expect(() => changerMonCode(db, afi, '1111', '3579')).toThrow('Code incorrect')
    expect(() => changerMonCode(db, afi, '0000', '0000')).toThrow(/différent/)
  })
})

describe('Premier démarrage en production', () => {
  it('s’affiche seulement si l’application est installée et qu’aucun compte n’existe', () => {
    expect(etatDemarrage(baseDeTest(), true)).toEqual({ premierDemarrage: true })
    expect(etatDemarrage(baseDeTest(), false)).toEqual({ premierDemarrage: false })
    expect(etatDemarrage(baseAvecDemo(), true)).toEqual({ premierDemarrage: false })
  })

  it('crée l’admin avec son propre code (non provisoire), journalise, puis il peut se connecter', () => {
    const db = baseDeTest()
    const admin = creerPremierAdmin(db, ' Mme Adjoa ', '4821')
    expect(admin).toMatchObject({ nom: 'Mme Adjoa', role: 'admin' })
    expect(connexion(db, admin.id, '4821')).toEqual({ utilisateur: admin })
    expect(compterJournal(db, 'creation_utilisateur')).toBe(1)
  })

  it('est refusé dès qu’un compte existe', () => {
    expect(() => creerPremierAdmin(baseAvecDemo(), 'Intrus', '4821')).toThrow(/compte existe déjà/)
  })
})
