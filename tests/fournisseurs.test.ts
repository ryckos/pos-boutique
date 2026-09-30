import { describe, expect, it } from 'vitest'
import {
  creerFournisseur,
  desactiverFournisseur,
  listerFournisseurs,
  modifierFournisseur
} from '../src/main/modules/fournisseurs/service'
import { executer, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Données de démo : Patron = 1 (admin), Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1.
const KOSSI = 3
const GROSSISTE = 1

/** Réception et règlement écrits directement : leurs services arrivent avec B8 et B10. */
function recevoir(db: Db, fournisseurId: number, total: number): void {
  const n = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM receptions')!.n
  executer(
    db,
    'INSERT INTO receptions (numero, fournisseur_id, total, utilisateur_id) VALUES (?, ?, ?, ?)',
    `RC-TEST-${n + 1}`, fournisseurId, total, KOSSI
  )
}
function regler(db: Db, fournisseurId: number, montant: number): void {
  executer(
    db,
    `INSERT INTO reglements_fournisseurs (fournisseur_id, montant, mode, utilisateur_id) VALUES (?, ?, 'especes', ?)`,
    fournisseurId, montant, KOSSI
  )
}

describe('Fournisseurs : fiches (REGLES_METIER § 4.6)', () => {
  it('la démo contient le grossiste du scénario, 15 jours de délai, sans dette', () => {
    expect(listerFournisseurs(baseAvecDemo())).toEqual([
      {
        id: GROSSISTE,
        nom: 'Grossiste Hédzranawoé',
        contact: 'M. Amouzou',
        telephone: '90 00 00 00',
        adresse: 'Marché de Hédzranawoé, Lomé',
        delaiPaiementJours: 15,
        actif: true,
        soldeDu: 0,
        derniereReception: null
      }
    ])
  })

  it('crée un fournisseur : espaces superflus retirés, champs vides = null, comptant', () => {
    const db = baseAvecDemo()
    const id = creerFournisseur(db, { nom: '  Boulangerie   du Port ', telephone: '  ', delaiPaiementJours: 0 })
    const f = listerFournisseurs(db).find((x) => x.id === id)!
    expect(f).toMatchObject({ nom: 'Boulangerie du Port', contact: null, telephone: null, adresse: null })
    expect(f.delaiPaiementJours).toBe(0)
  })

  it('refuse un nom vide', () => {
    expect(() => creerFournisseur(baseAvecDemo(), { nom: '   ', delaiPaiementJours: 0 })).toThrow(/obligatoire/)
  })

  it('refuse un doublon parmi les actifs, casse et espaces ignorés', () => {
    const db = baseAvecDemo()
    expect(() => creerFournisseur(db, { nom: 'grossiste  hédzranawoé', delaiPaiementJours: 0 })).toThrow(
      /existe déjà/
    )
  })

  it('accepte le nom d’un fournisseur désactivé', () => {
    const db = baseAvecDemo()
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(() => creerFournisseur(db, { nom: 'Grossiste Hédzranawoé', delaiPaiementJours: 30 })).not.toThrow()
  })

  it.each([-1, 2.5, 366, Number.NaN])('refuse un délai de paiement de %s jours', (delai) => {
    expect(() => creerFournisseur(baseAvecDemo(), { nom: 'Sodigaz', delaiPaiementJours: delai })).toThrow(
      /entre 0 \(comptant\) et 365/
    )
  })

  it('modifie la fiche, en gardant son propre nom sans se croire en doublon', () => {
    const db = baseAvecDemo()
    modifierFournisseur(db, GROSSISTE, {
      nom: 'Grossiste Hédzranawoé',
      telephone: '91 11 11 11',
      delaiPaiementJours: 30
    })
    expect(listerFournisseurs(db)[0]).toMatchObject({ telephone: '91 11 11 11', contact: null, delaiPaiementJours: 30 })
  })

  it('refuse de renommer vers le nom d’un autre fournisseur actif', () => {
    const db = baseAvecDemo()
    const id = creerFournisseur(db, { nom: 'Sodigaz', delaiPaiementJours: 0 })
    expect(() => modifierFournisseur(db, id, { nom: 'GROSSISTE HÉDZRANAWOÉ', delaiPaiementJours: 0 })).toThrow(
      /existe déjà/
    )
  })

  it('calcule le solde dû : réceptions − règlements, et la date de la dernière réception', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    recevoir(db, GROSSISTE, 25200)
    regler(db, GROSSISTE, 10000)
    const f = listerFournisseurs(db)[0]
    expect(f.soldeDu).toBe(33200)
    expect(f.derniereReception).not.toBeNull()
  })

  it('liste les actifs puis les désactivés, chacun par ordre alphabétique', () => {
    const db = baseAvecDemo()
    const z = creerFournisseur(db, { nom: 'Zénith Distribution', delaiPaiementJours: 0 })
    creerFournisseur(db, { nom: 'Agrotogo', delaiPaiementJours: 7 })
    desactiverFournisseur(db, KOSSI, z, 'Faillite')
    expect(listerFournisseurs(db).map((f) => [f.nom, f.actif])).toEqual([
      ['Agrotogo', true],
      ['Grossiste Hédzranawoé', true],
      ['Zénith Distribution', false]
    ])
  })
})

describe('Fournisseurs : désactivation', () => {
  it('exige un motif', () => {
    expect(() => desactiverFournisseur(baseAvecDemo(), KOSSI, GROSSISTE, '  ')).toThrow(/motif/)
  })

  it('refuse tant qu’il reste une dette (18 000 F reçus, rien réglé)', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')).toThrow(
      /Vous devez encore 18.000 F à « Grossiste Hédzranawoé »/
    )
    expect(listerFournisseurs(db)[0].actif).toBe(true)
  })

  it('accepte une fois la dette réglée, et journalise le motif', () => {
    const db = baseAvecDemo()
    recevoir(db, GROSSISTE, 18000)
    regler(db, GROSSISTE, 18000)
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(listerFournisseurs(db)[0]).toMatchObject({ actif: false, soldeDu: 0 })
    const j = une<{ utilisateurId: number; entiteId: number; apres: string }>(
      db,
      `SELECT utilisateur_id AS utilisateurId, entite_id AS entiteId, nouvelle_valeur AS apres
       FROM journal_audit WHERE action = 'desactivation_fournisseur'`
    )!
    expect(j).toMatchObject({ utilisateurId: KOSSI, entiteId: GROSSISTE })
    expect(JSON.parse(j.apres)).toEqual({ motif: 'Ne livre plus' })
  })

  it('un fournisseur désactivé ne se modifie ni ne se désactive à nouveau', () => {
    const db = baseAvecDemo()
    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(() => modifierFournisseur(db, GROSSISTE, { nom: 'X', delaiPaiementJours: 0 })).toThrow(/désactivé/)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Encore')).toThrow(/déjà désactivé/)
  })

  it('refuse un fournisseur inconnu', () => {
    expect(() => desactiverFournisseur(baseAvecDemo(), KOSSI, 999, 'Motif')).toThrow(/introuvable/)
  })
})
