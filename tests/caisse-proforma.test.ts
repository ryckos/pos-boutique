import { describe, expect, it } from 'vitest'
import { stockProduit } from '../src/main/core/mouvements'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { htmlProforma } from '../src/main/documents/proforma'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import {
  creerProforma,
  donneesProforma,
  lireProforma,
  numeroProformaComplet
} from '../src/main/modules/caisse/service-proforma'
import { autoriserRemise } from '../src/main/modules/caisse/service-vente'
import { lireParametres } from '../src/main/modules/parametres/service'
import type { RequeteProforma } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }
const TOMATE = 3
const ANNEE = new Date().getFullYear()

const CARTON = '16181000000049' // 7 500 F
const UNITE = '6181000000042' // 350 F
const PLU_BAGUETTE = '101' // 300 F, TVA 0

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** 2 cartons de tomate (15 000 F) + 3 baguettes (900 F à 0 %) = 15 900 F. */
const devis = (db: Db, autres: Partial<RequeteProforma> = {}): RequeteProforma => ({
  lignes: [
    { conditionnementId: id(db, CARTON), quantite: 2 },
    { conditionnementId: id(db, PLU_BAGUETTE), quantite: 3 }
  ],
  ...autres
})

const dateDans = (db: Db, jours: number): string =>
  une<{ d: string }>(db, "SELECT date('now','localtime', ?) AS d", `${jours} days`)!.d

describe('Proforma (A10)', () => {
  it('sans caisse ouverte : numéro PF, prix recopiés, valable 30 jours, ni vente ni stock', () => {
    const db = baseAvecDemo()
    const p = creerProforma(
      db,
      AFI,
      devis(db, { client: { nom: ' Hôtel du Lac ', telephone: '22 00 00 00' } })
    )

    expect(p).toEqual({
      proformaId: p.proformaId,
      numero: `PF-${ANNEE}-000001`,
      totalTtc: 15900,
      valideJusquAu: dateDans(db, 30)
    })
    // 15 000 F à 18 % → HT 12 712, TVA 2 288 ; 900 F à 0 %.
    expect(
      une(
        db,
        `SELECT client_nom AS nom, client_telephone AS tel, total_ht AS ht, total_tva AS tva, total_ttc AS ttc
         FROM proformas WHERE id = ?`,
        p.proformaId
      )
    ).toEqual({ nom: 'Hôtel du Lac', tel: '22 00 00 00', ht: 13612, tva: 2288, ttc: 15900 })
    expect(
      toutes(
        db,
        'SELECT designation, quantite, prix_unitaire AS prix, taux_tva AS tva, total_ligne AS total FROM lignes_proforma WHERE proforma_id = ?',
        p.proformaId
      )
    ).toEqual([
      {
        designation: expect.stringContaining('Carton de 24'),
        quantite: 2,
        prix: 7500,
        tva: 18,
        total: 15000
      },
      { designation: expect.stringContaining('Baguette'), quantite: 3, prix: 300, tva: 0, total: 900 }
    ])
    expect(stockProduit(db, TOMATE)).toBe(72)
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM ventes')!.n).toBe(0)
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM paiements')!.n).toBe(0)

    const [journal] = toutes<{ apres: string }>(
      db,
      "SELECT nouvelle_valeur AS apres FROM journal_audit WHERE action = 'proforma'"
    )
    expect(JSON.parse(journal.apres)).toEqual({
      numero: `PF-${ANNEE}-000001`,
      montant: 15900,
      client: 'Hôtel du Lac'
    })
  })

  it('client facultatif ; remise du gérant sans plafond', () => {
    const db = baseAvecDemo()
    const p = creerProforma(db, KOSSI, devis(db, { remiseGlobale: 900 }))
    expect(p.totalTtc).toBe(15000)
    expect(
      une(db, 'SELECT client_nom AS nom, remise_globale AS r FROM proformas WHERE id = ?', p.proformaId)
    ).toEqual({
      nom: null,
      r: 900
    })
  })

  it('remise de la caissière au-delà du plafond : il faut l’accord du gérant, qui n’est pas consommé', () => {
    const db = baseAvecDemo()
    expect(() => creerProforma(db, AFI, devis(db, { remiseGlobale: 500 }))).toThrow(/accord du gérant/)
    const { jeton } = autoriserRemise(db, AFI.id, { utilisateurId: KOSSI.id, code: '5678', montant: 500 })
    creerProforma(db, AFI, devis(db, { remiseGlobale: 500, jetonRemise: jeton }))
    // Toujours valable : il servira à la vente.
    creerProforma(db, AFI, devis(db, { remiseGlobale: 500, jetonRemise: jeton }))
  })

  it('refus : panier vide, quantité, remise trop forte, nom trop long ; aucun numéro consommé', () => {
    const db = baseAvecDemo()
    expect(() => creerProforma(db, KOSSI, { lignes: [] })).toThrow(/vide/)
    expect(() =>
      creerProforma(db, KOSSI, { lignes: [{ conditionnementId: id(db, UNITE), quantite: 0 }] })
    ).toThrow(/Quantité/)
    expect(() => creerProforma(db, KOSSI, devis(db, { remiseGlobale: 20000 }))).toThrow(/dépasse/)
    expect(() => creerProforma(db, KOSSI, devis(db, { client: { nom: 'x'.repeat(121) } }))).toThrow(
      /trop long/
    )
    expect(une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM proformas')!.n).toBe(0)
    expect(une(db, "SELECT dernier FROM sequences WHERE prefixe LIKE 'PF-%'")).toBeUndefined()
  })
})

describe('Reprise dans la caisse', () => {
  it('par le numéro court : les lignes et l’article du jour ; un prix changé est signalé', () => {
    const db = baseAvecDemo()
    creerProforma(db, AFI, devis(db, { client: { nom: 'Hôtel du Lac' } }))
    // Le carton passe à 7 800 F après la proforma.
    executer(db, 'UPDATE conditionnements SET prix_vente = 7800 WHERE id = ?', id(db, CARTON))

    const r = lireProforma(db, ' 1 ')
    expect(r).toMatchObject({
      numero: `PF-${ANNEE}-000001`,
      expiree: false,
      client: { nom: 'Hôtel du Lac' },
      totalTtc: 15900,
      remiseGlobale: 0
    })
    expect(r.lignes.map((l) => [l.quantite, l.prixProforma, l.article?.prixVente, l.prixChange])).toEqual([
      [2, 7500, 7800, true],
      [3, 300, 300, false]
    ])
  })

  it('article retiré de la vente : null ; proforma périmée : signalée, la reprise reste possible', () => {
    const db = baseAvecDemo()
    creerProforma(db, AFI, devis(db))
    executer(db, 'UPDATE conditionnements SET actif = 0 WHERE id = ?', id(db, CARTON))
    expect(lireProforma(db, `PF-${ANNEE}-000001`)).toMatchObject({ expiree: false })
    expect(lireProforma(db, `PF-${ANNEE}-000001`).lignes[0].article).toBeNull()

    // Une proforma ne se modifie pas : on en écrit une ancienne directement, échue depuis hier.
    executer(
      db,
      `INSERT INTO proformas (numero, total_ht, total_tva, total_ttc, valide_jusqu_au, utilisateur_id)
       VALUES ('PF-2025-000009', 254, 46, 300, date('now','localtime','-1 day'), ?)`,
      AFI.id
    )
    expect(lireProforma(db, 'PF-2025-000009')).toMatchObject({ expiree: true, lignes: [] })
    expect(() => lireProforma(db, 'PF-2020-000009')).toThrow(/introuvable/)
  })

  it('numéro court', () => {
    expect(numeroProformaComplet('12', 2026)).toBe('PF-2026-000012')
    expect(numeroProformaComplet(' pf-2025-000003 ', 2026)).toBe('PF-2025-000003')
  })
})

describe('Proforma imprimée', () => {
  it('titre, validité, client, TVA, montant en lettres, devis sans valeur de facture', () => {
    const db = baseAvecDemo()
    const p = creerProforma(db, AFI, devis(db, { client: { nom: 'Hôtel <du> Lac' } }))
    const d = donneesProforma(db, p.proformaId, lireParametres(db))
    expect(d).toMatchObject({
      numero: p.numero,
      auteur: 'Afi',
      totalTtc: 15900,
      parTaux: [
        { taux: 18, ttc: 15000, ht: 12712, tva: 2288 },
        { taux: 0, ttc: 900, ht: 900, tva: 0 }
      ]
    })
    const html = htmlProforma(d)
    expect(html).toContain('FACTURE PROFORMA')
    expect(html).toContain(
      `Valable jusqu’au <strong>${p.valideJusquAu.split('-').reverse().join('/')}</strong>`
    )
    expect(html).toContain('Hôtel &lt;du&gt; Lac')
    expect(html).toContain('Quinze mille neuf cents francs CFA')
    expect(html).toContain('sans valeur de facture')
    expect(() => donneesProforma(db, 999, lireParametres(db))).toThrow(/Proforma introuvable/)
  })
})
