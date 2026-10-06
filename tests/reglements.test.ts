import { describe, expect, it } from 'vitest'
import {
  annulerReglement,
  dettesFournisseur,
  enregistrerReglement
} from '../src/main/modules/fournisseurs/reglements'
import {
  creerFournisseur,
  desactiverFournisseur,
  listerFournisseurs
} from '../src/main/modules/fournisseurs/service'
import { validerReception } from '../src/main/modules/achats/receptions'
import { imputerReglements, joursEntre } from '../src/shared/fournisseurs'
import { executer, toutes, une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Kossi = 3 (gérant) ; Grossiste Hédzranawoé = fournisseur 1, 15 jours ;
// carton de tomate = 24 boîtes.
const KOSSI = 3
const GROSSISTE = 1
const CARTON_TOMATE = '16181000000049'

function carton(db: Db): number {
  return une<{ id: number }>(db, 'SELECT id FROM conditionnements WHERE code_barres = ?', CARTON_TOMATE)!.id
}
/** Réception de cartons de tomate ; renvoie son id. */
function recevoir(db: Db, quantite: number, prix: number): number {
  return validerReception(db, KOSSI, {
    fournisseurId: GROSSISTE,
    lignes: [{ conditionnementId: carton(db), quantite, prix }]
  }).id
}
/** Recule une réception dans le temps (date de réception et échéance figée). */
function vieillir(db: Db, receptionId: number, jours: number): void {
  executer(
    db,
    `UPDATE receptions SET date_reception = datetime(date_reception, ?), date_echeance = date(date_echeance, ?)
     WHERE id = ?`,
    `-${jours} days`,
    `-${jours} days`,
    receptionId
  )
}
function solde(db: Db): number {
  return listerFournisseurs(db).find((f) => f.id === GROSSISTE)!.soldeDu
}
function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}

describe('Dettes fournisseurs : règle d’imputation (REGLES_METIER § 4.5)', () => {
  it('compte les jours entre deux dates', () => {
    expect(joursEntre('2026-10-01', '2026-10-06')).toBe(5)
    expect(joursEntre('2026-10-06', '2026-10-01')).toBe(-5)
  })

  it('un règlement lié va à sa réception, un global aux plus anciennes d’abord', () => {
    const r = imputerReglements(
      [
        { id: 1, total: 18000, dateEcheance: '2026-10-01' },
        { id: 2, total: 13200, dateEcheance: '2026-10-20' }
      ],
      [{ receptionId: null, montant: 20000 }],
      '2026-10-06'
    )
    expect(r).toEqual([
      { receptionId: 1, regle: 18000, reste: 0, etat: 'soldee', joursRetard: 0 },
      { receptionId: 2, regle: 2000, reste: 11200, etat: 'a_payer', joursRetard: 0 }
    ])
  })

  it('le global ne couvre que ce que les règlements liés laissent', () => {
    const r = imputerReglements(
      [
        { id: 1, total: 18000, dateEcheance: '2026-10-01' },
        { id: 2, total: 13200, dateEcheance: null }
      ],
      [
        { receptionId: 1, montant: 8000 },
        { receptionId: null, montant: 12000 }
      ],
      '2026-10-06'
    )
    expect(r.map((x) => x.reste)).toEqual([0, 11200])
  })

  it('échéance dépassée : en retard du nombre de jours écoulés ; le jour même, à payer', () => {
    const [retard, jour] = imputerReglements(
      [
        { id: 1, total: 18000, dateEcheance: '2026-10-01' },
        { id: 2, total: 5000, dateEcheance: '2026-10-06' }
      ],
      [],
      '2026-10-06'
    )
    expect(retard).toMatchObject({ etat: 'en_retard', joursRetard: 5, reste: 18000 })
    expect(jour).toMatchObject({ etat: 'a_payer', joursRetard: 0 })
  })
})

describe('Règlements fournisseurs (REGLES_METIER § 4.5)', () => {
  it('3 cartons à 6 000 = 18 000 ; 10 000 sur RC-1 → reste 8 000 ; 8 001 refusé ; 8 000 la solde', () => {
    const db = baseAvecDemo()
    const rc1 = recevoir(db, 3, 6000)
    expect(solde(db)).toBe(18000)

    enregistrerReglement(db, KOSSI, {
      fournisseurId: GROSSISTE,
      receptionId: rc1,
      montant: 10000,
      mode: 'especes'
    })
    expect(solde(db)).toBe(8000)
    expect(dettesFournisseur(db, GROSSISTE).echeances[0]).toMatchObject({
      regle: 10000,
      reste: 8000,
      etat: 'a_payer'
    })

    expect(() =>
      enregistrerReglement(db, KOSSI, {
        fournisseurId: GROSSISTE,
        receptionId: rc1,
        montant: 8001,
        mode: 'tmoney'
      })
    ).toThrow(/au plus/)
    enregistrerReglement(db, KOSSI, {
      fournisseurId: GROSSISTE,
      receptionId: rc1,
      montant: 8000,
      mode: 'tmoney'
    })
    expect(solde(db)).toBe(0)
    expect(dettesFournisseur(db, GROSSISTE).echeances[0]).toMatchObject({ reste: 0, etat: 'soldee' })
    expect(() =>
      enregistrerReglement(db, KOSSI, {
        fournisseurId: GROSSISTE,
        receptionId: rc1,
        montant: 1,
        mode: 'especes'
      })
    ).toThrow(/déjà payée/)
  })

  it('règlement global de 20 000 sur 18 000 puis 13 200 : RC-1 soldée, 11 200 restent sur RC-2', () => {
    const db = baseAvecDemo()
    const rc1 = recevoir(db, 3, 6000)
    vieillir(db, rc1, 1)
    const rc2 = recevoir(db, 2, 6600)
    expect(solde(db)).toBe(31200)

    enregistrerReglement(db, KOSSI, {
      fournisseurId: GROSSISTE,
      montant: 20000,
      mode: 'virement',
      reference: ' VIR-778 '
    })
    const d = dettesFournisseur(db, GROSSISTE)
    expect(d.soldeDu).toBe(11200)
    expect(d.echeances.map((e) => [e.receptionId, e.reste])).toEqual([
      [rc2, 11200],
      [rc1, 0]
    ])
    expect(d.reglements[0]).toMatchObject({
      montant: 20000,
      mode: 'virement',
      reference: 'VIR-778',
      reception: null
    })
    expect(() =>
      enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 11201, mode: 'especes' })
    ).toThrow(/Vous devez 11/)
  })

  it('annulation : le règlement reste visible, ne compte plus, est journalisé, une seule fois', () => {
    const db = baseAvecDemo()
    const rc1 = recevoir(db, 3, 6000)
    const id = enregistrerReglement(db, KOSSI, {
      fournisseurId: GROSSISTE,
      receptionId: rc1,
      montant: 10000,
      mode: 'flooz'
    })
    expect(() => annulerReglement(db, KOSSI, id, '   ')).toThrow(/motif/)

    annulerReglement(db, KOSSI, id, 'Montant mal saisi')
    expect(solde(db)).toBe(18000)
    expect(
      une<{ s: number }>(db, 'SELECT solde_du AS s FROM v_dettes_fournisseurs WHERE id = ?', GROSSISTE)!.s
    ).toBe(18000)
    expect(dettesFournisseur(db, GROSSISTE).reglements[0]).toMatchObject({
      montant: 10000,
      annulePar: 'Kossi',
      motifAnnulation: 'Montant mal saisi'
    })
    const journal = toutes<{ action: string; apres: string }>(
      db,
      "SELECT action, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'annulation_reglement_fournisseur'"
    )
    expect(journal).toHaveLength(1)
    expect(JSON.parse(journal[0].apres)).toEqual({ motif: 'Montant mal saisi' })
    expect(() => annulerReglement(db, KOSSI, id, 'Encore')).toThrow(/déjà annulé/)
  })

  it('échéance dépassée : en retard dans l’échéancier et dans la liste des fournisseurs', () => {
    const db = baseAvecDemo()
    const rc1 = recevoir(db, 3, 6000)
    vieillir(db, rc1, 20) // reçue il y a 20 jours, 15 jours de délai → 5 jours de retard
    recevoir(db, 2, 6600)

    const d = dettesFournisseur(db, GROSSISTE)
    expect(d.enRetard).toBe(18000)
    expect(d.echeances[0]).toMatchObject({ receptionId: rc1, etat: 'en_retard', joursRetard: 5 })
    expect(d.echeances[1]).toMatchObject({ etat: 'a_payer', joursRetard: 0 })

    const f = listerFournisseurs(db).find((x) => x.id === GROSSISTE)!
    expect(f.enRetard).toBe(18000)
    expect(f.prochaineEcheance).toBe(d.echeances[0].dateEcheance)
  })

  it('refuse un montant nul ou à virgule, une date future ou invalide, une réception d’un autre fournisseur', () => {
    const db = baseAvecDemo()
    recevoir(db, 3, 6000)
    const base = { fournisseurId: GROSSISTE, mode: 'especes' as const }
    expect(() => enregistrerReglement(db, KOSSI, { ...base, montant: 0 })).toThrow(/supérieur à zéro/)
    expect(() => enregistrerReglement(db, KOSSI, { ...base, montant: 2500.5 })).toThrow(/sans virgule/)
    expect(() => enregistrerReglement(db, KOSSI, { ...base, montant: 1000, date: '2099-01-01' })).toThrow(
      /futur/
    )
    expect(() => enregistrerReglement(db, KOSSI, { ...base, montant: 1000, date: '2026-02-30' })).toThrow(
      /date/
    )

    const autre = creerFournisseur(db, { nom: 'Boulangerie du Port', delaiPaiementJours: 0 })
    const rcGrossiste = une<{ id: number }>(db, 'SELECT id FROM receptions')!.id
    expect(() =>
      enregistrerReglement(db, KOSSI, {
        fournisseurId: autre,
        receptionId: rcGrossiste,
        montant: 1000,
        mode: 'especes'
      })
    ).toThrow(/n’est pas une livraison/)
    expect(() =>
      enregistrerReglement(db, KOSSI, { fournisseurId: autre, montant: 1000, mode: 'especes' })
    ).toThrow(/ne devez rien/)
  })

  it('date antérieure acceptée ; fournisseur désactivé refusé', () => {
    const db = baseAvecDemo()
    recevoir(db, 3, 6000)
    const hier = une<{ j: string }>(db, "SELECT date('now','localtime','-1 day') AS j")!.j
    enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 18000, mode: 'especes', date: hier })
    expect(dettesFournisseur(db, GROSSISTE).reglements[0].date).toBe(hier)
    expect(aujourdhui(db) > hier).toBe(true)

    desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')
    expect(() =>
      enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 1, mode: 'especes' })
    ).toThrow(/désactivé/)
  })

  it('la désactivation, refusée tant qu’il reste une dette, passe une fois la dette réglée', () => {
    const db = baseAvecDemo()
    recevoir(db, 3, 6000)
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')).toThrow(/réglez la dette/)
    enregistrerReglement(db, KOSSI, { fournisseurId: GROSSISTE, montant: 18000, mode: 'especes' })
    expect(() => desactiverFournisseur(db, KOSSI, GROSSISTE, 'Ne livre plus')).not.toThrow()
  })
})
