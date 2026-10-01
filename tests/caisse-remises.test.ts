import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { toutes, une } from '../src/main/db/requetes'
import { lignesTicket, LARGEUR } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { repartirRemise, ventilerTva } from '../src/main/modules/caisse/calculs'
import { journaliserLignesAnnulees } from '../src/main/modules/caisse/service-lignes-annulees'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente, verifierAutorisationGerant } from '../src/main/modules/caisse/service-vente'
import { ecrireParametres } from '../src/main/modules/parametres/service'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const PATRON: UtilisateurConnecte = { id: 1, nom: 'Patron', role: 'admin' }
const AFI = 2
const KOSSI = 3

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Base de démo, caisses d'Afi et de Kossi ouvertes, plafond de remise éventuel. */
function base(plafond: number | null = null): Db {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI, 10000)
  ouvrirSession(db, KOSSI, 10000)
  if (plafond !== null) ecrireParametres(db, PATRON, { plafondRemiseCaissier: plafond })
  return db
}

/** « 1 carton de tomate + 2 unités + 1 baguette » = 7 500 + 700 + 300 = 8 500 F. */
function lignes(db: Db, remiseCarton = 0): RequeteVente['lignes'] {
  return [
    { conditionnementId: id(db, '16181000000049'), quantite: 1, remise: remiseCarton },
    { conditionnementId: id(db, '6181000000042'), quantite: 2 },
    { conditionnementId: id(db, '101'), quantite: 1 }
  ]
}

const especes = (montant: number): RequeteVente['paiements'] => [{ mode: 'especes', montant }]

const journalRemises = (db: Db): Record<string, unknown>[] =>
  toutes<{ v: string }>(
    db,
    "SELECT nouvelle_valeur AS v FROM journal_audit WHERE action = 'remise' ORDER BY id"
  ).map((r) => JSON.parse(r.v))

const nbVentes = (db: Db): number => une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM ventes')!.n

describe('TVA d’une remise sur le ticket (règle 6.6)', () => {
  it('12 700 F à 18 % + 600 F à 0 %, remise 1 000 F : 955 / 45, HT 10 508, TVA 1 792', () => {
    expect(repartirRemise([12700, 600], 1000)).toEqual([955, 45])
    expect(
      ventilerTva(
        [
          { totalTtc: 12700, tauxTva: 18 },
          { totalTtc: 600, tauxTva: 0 }
        ],
        1000
      )
    ).toEqual({
      parTaux: [
        { taux: 18, ttc: 11745, ht: 9953, tva: 1792 },
        { taux: 0, ttc: 555, ht: 555, tva: 0 }
      ],
      totalTtc: 12300,
      totalHt: 10508,
      totalTva: 1792
    })
  })

  it('remise de 10 % (1 330 F) : partage exact 1 270 / 60, sans reste', () => {
    expect(repartirRemise([12700, 600], 1330)).toEqual([1270, 60])
  })

  it('sans remise, la ventilation est inchangée (13 300 → HT 11 363, TVA 1 937)', () => {
    const t = ventilerTva([
      { totalTtc: 12700, tauxTva: 18 },
      { totalTtc: 600, tauxTva: 0 }
    ])
    expect([t.totalTtc, t.totalHt, t.totalTva]).toEqual([13300, 11363, 1937])
  })

  it('le reste va au taux suivant quand le plus élevé est déjà entièrement remisé', () => {
    expect(repartirRemise([1, 999], 1000)).toEqual([1, 999])
  })
})

describe('Remises à la vente — montants', () => {
  it('gérant : 500 F sur le carton → ligne 7 000 F, ticket 8 000 F, coût inchangé, journalisée', () => {
    const db = base()
    const v = enregistrerVente(db, KOSSI, { lignes: lignes(db, 500), paiements: especes(8000) })
    expect(v.totalTtc).toBe(8000)

    const carton = une<{ remise: number; total: number; cout: number }>(
      db,
      `SELECT remise_ligne AS remise, total_ligne AS total, cout_unitaire AS cout
       FROM lignes_vente WHERE vente_id = ? AND quantite_base_totale = 24`,
      v.venteId
    )!
    // Coût du carton = CUMP 250 × 24 : la remise réduit la marge, pas le coût.
    expect(carton).toEqual({ remise: 500, total: 7000, cout: 6000 })

    expect(journalRemises(db)).toEqual([
      {
        numeroTicket: v.numeroTicket,
        portee: 'ligne',
        designation: 'Tomate concentrée 70 g — Carton de 24',
        montant: 500
      }
    ])
  })

  it('gérant : 500 F sur le ticket de 8 500 F → 8 000 F, HT 6 823, TVA 1 177', () => {
    const db = base()
    const v = enregistrerVente(db, KOSSI, {
      lignes: lignes(db),
      remiseGlobale: 500,
      paiements: especes(8000)
    })
    const vente = une<{ ttc: number; ht: number; tva: number; remise: number }>(
      db,
      'SELECT total_ttc AS ttc, total_ht AS ht, total_tva AS tva, remise_globale AS remise FROM ventes WHERE id = ?',
      v.venteId
    )
    // 18 % : 8 200 − 483 = 7 717 → HT 6 540 ; 0 % : 300 − 17 = 283.
    expect(vente).toEqual({ ttc: 8000, ht: 6823, tva: 1177, remise: 500 })
    expect(journalRemises(db)).toEqual([{ numeroTicket: v.numeroTicket, portee: 'ticket', montant: 500 }])
  })

  it('le paiement doit égaler le total APRÈS remise', () => {
    const db = base()
    expect(() => enregistrerVente(db, KOSSI, { lignes: lignes(db, 500), paiements: especes(8500) })).toThrow(
      'Paiement supérieur au total de 500 F'
    )
  })

  it('refuse une remise supérieure à la ligne, négative ou à virgule', () => {
    const db = base()
    expect(() => enregistrerVente(db, KOSSI, { lignes: lignes(db, 7501), paiements: especes(1000) })).toThrow(
      'dépasse le montant de la ligne'
    )
    expect(() => enregistrerVente(db, KOSSI, { lignes: lignes(db, -100), paiements: especes(8600) })).toThrow(
      'Remise invalide'
    )
    expect(() => enregistrerVente(db, KOSSI, { lignes: lignes(db, 10.5), paiements: especes(8490) })).toThrow(
      'Remise invalide'
    )
    expect(nbVentes(db)).toBe(0)
  })

  it('refuse une remise sur le ticket supérieure au total, et un ticket gratuit', () => {
    const db = base()
    expect(() =>
      enregistrerVente(db, KOSSI, { lignes: lignes(db), remiseGlobale: 8501, paiements: especes(1) })
    ).toThrow('dépasse le total des articles')
    expect(() =>
      enregistrerVente(db, KOSSI, { lignes: lignes(db), remiseGlobale: 8500, paiements: especes(1) })
    ).toThrow('Un ticket ne peut pas être gratuit')
  })
})

describe('Remises à la vente — plafond de la caissière (D-A3)', () => {
  it('plafond non renseigné : aucune remise sans gérant, rien n’est enregistré', () => {
    const db = base()
    expect(() => enregistrerVente(db, AFI, { lignes: lignes(db, 100), paiements: especes(8400) })).toThrow(
      'demande l’accord du gérant'
    )
    expect(nbVentes(db)).toBe(0)
    expect(journalRemises(db)).toEqual([])
  })

  it('avec l’accord du gérant : vente au nom d’Afi, journal « autorisée par Kossi »', () => {
    const db = base()
    const v = enregistrerVente(db, AFI, { lignes: lignes(db, 100), paiements: especes(8400) }, KOSSI)
    expect(une(db, 'SELECT utilisateur_id AS u FROM ventes WHERE id = ?', v.venteId)).toEqual({ u: AFI })
    expect(journalRemises(db)[0]).toMatchObject({ montant: 100, autoriseeParId: KOSSI })
  })

  it('plafond 500 F : porte sur le TOTAL du ticket (300 + 200 passe, 300 + 300 non)', () => {
    const db = base(500)
    const v = enregistrerVente(db, AFI, {
      lignes: lignes(db, 300),
      remiseGlobale: 200,
      paiements: especes(8000)
    })
    expect(v.totalTtc).toBe(8000)
    expect(journalRemises(db).map((r) => r.autoriseeParId)).toEqual([undefined, undefined])
    expect(() =>
      enregistrerVente(db, AFI, { lignes: lignes(db, 300), remiseGlobale: 300, paiements: especes(7900) })
    ).toThrow('au-delà de votre plafond (500 F)')
  })

  it('un identifiant de caissière ne vaut pas accord du gérant', () => {
    const db = base(0)
    expect(() =>
      enregistrerVente(db, AFI, { lignes: lignes(db, 100), paiements: especes(8400) }, AFI)
    ).toThrow('demande l’accord du gérant')
  })

  it('code du gérant : bon code → Kossi ; code faux refusé ; compte de caissière refusé', () => {
    const db = base()
    expect(verifierAutorisationGerant(db, { utilisateurId: KOSSI, code: '5678' })).toBe(KOSSI)
    expect(() => verifierAutorisationGerant(db, { utilisateurId: KOSSI, code: '1111' })).toThrow(
      'Code incorrect'
    )
    expect(() => verifierAutorisationGerant(db, { utilisateurId: AFI, code: '0000' })).toThrow(
      'Seul un gérant peut autoriser'
    )
  })
})

describe('Ticket imprimé avec remises', () => {
  it('montre le prix brut, la remise de ligne, le sous-total et la remise sur le ticket', () => {
    const db = base()
    const v = enregistrerVente(db, KOSSI, {
      lignes: lignes(db, 500),
      remiseGlobale: 300,
      paiements: especes(7700)
    })
    const t = lignesTicket(
      lireTicket(db, v.venteId),
      { nom: 'MA BOUTIQUE', adresse: [], pied: '' },
      {
        duplicata: false
      }
    ).map((l) => l.texte)
    expect(t.some((l) => /^Tomate concentrée 70 g — Carton de 24 +7 500 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^ {2}Remise +-500 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Sous-total +8 000 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Remise sur le ticket +-300 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^TOTAL +7 700 F$/.test(l))).toBe(true)
    expect(t.every((l) => l.length <= LARGEUR)).toBe(true)
  })
})

describe('Lignes retirées avant encaissement (annulation_ligne)', () => {
  it('journalise chaque ligne, désignation et prix relus en base', () => {
    const db = base()
    journaliserLignesAnnulees(
      db,
      AFI,
      [
        { conditionnementId: id(db, '16181000000049'), quantite: 2 },
        { conditionnementId: id(db, '101'), quantite: 1 }
      ],
      true
    )
    const entrees = toutes<{ u: number; v: string }>(
      db,
      "SELECT utilisateur_id AS u, nouvelle_valeur AS v FROM journal_audit WHERE action = 'annulation_ligne' ORDER BY id"
    )
    expect(entrees.map((e) => e.u)).toEqual([AFI, AFI])
    expect(entrees.map((e) => JSON.parse(e.v))).toEqual([
      { designation: 'Tomate concentrée 70 g — Carton de 24', quantite: 2, montant: 15000, abandon: true },
      { designation: 'Baguette', quantite: 1, montant: 300, abandon: true }
    ])
  })

  it('liste vide : rien ; quantité invalide : refus et rien d’écrit', () => {
    const db = base()
    journaliserLignesAnnulees(db, AFI, [], false)
    expect(() =>
      journaliserLignesAnnulees(
        db,
        AFI,
        [
          { conditionnementId: id(db, '101'), quantite: 1 },
          { conditionnementId: id(db, '101'), quantite: 0 }
        ],
        false
      )
    ).toThrow('Quantité de ligne invalide')
    expect(une(db, "SELECT COUNT(*) AS n FROM journal_audit WHERE action = 'annulation_ligne'")).toEqual({
      n: 0
    })
  })
})
