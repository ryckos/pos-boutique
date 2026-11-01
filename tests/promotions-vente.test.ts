import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { une } from '../src/main/db/requetes'
import { lignesTicket } from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { ventesPeriode } from '../src/main/modules/caisse/service-rapports'
import { creerProforma, lireProforma } from '../src/main/modules/caisse/service-proforma'
import { consulterRetour, enregistrerRetour } from '../src/main/modules/caisse/service-retour'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import { lireTicket } from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import { arreterPromotion, creerPromotion } from '../src/main/modules/promotions/service'
import { ventesParCaissier } from '../src/main/modules/rapports-ventes/service'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { SaisiePromotion } from '../src/shared/ipc/promotions'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const CARTON = '16181000000049' // 7 500 F, coût 24 × 250 = 6 000
const UNITE = '6181000000042' // 350 F, coût 250
const ENTETE = { nom: 'Ma Boutique', adresse: ['Lomé'], pied: 'Merci' }

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId
const jour = (db: Db, decalage = 0): string =>
  une<{ j: string }>(db, `SELECT date('now','localtime','${decalage >= 0 ? '+' : ''}${decalage} day') AS j`)!
    .j

/** Tomate −20 % jusqu'à la semaine prochaine : unité 280, lot de 3 à 800, carton à 6 000. */
function promotion20(db: Db, s: Partial<SaisiePromotion> = {}): number {
  return creerPromotion(db, KOSSI, {
    nom: 'Tomate −20 %',
    type: 'remise_pourcent',
    valeur: 20,
    produitId: rechercherParCode(db, UNITE)!.produitId,
    dateDebut: jour(db),
    dateFin: jour(db, 7),
    ...s
  }).id
}

function boutique(): Db {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  ouvrirSession(db, KOSSI.id, 10000)
  return db
}

/** 1 carton + 2 unités : 6 000 + 560 = 6 560 F sous −20 % (au lieu de 7 500 + 700 = 8 200 F). */
const panier = (db: Db): RequeteVente['lignes'] => [
  { conditionnementId: id(db, CARTON), quantite: 1 },
  { conditionnementId: id(db, UNITE), quantite: 2 }
]

const vendre = (
  db: Db,
  u: UtilisateurConnecte,
  total: number,
  lignes = panier(db),
  autres: Partial<RequeteVente> = {}
) => enregistrerVente(db, u.id, { lignes, paiements: [{ mode: 'especes', montant: total }], ...autres })

describe('Vente sous promotion (A16)', () => {
  it('le prix promotionnel est relu en base : 6 560 F au lieu de 8 200 F, prix normal et promotion copiés', () => {
    const db = boutique()
    const promo = promotion20(db)
    const v = vendre(db, AFI, 6560)
    expect(v.totalTtc).toBe(6560)
    expect(
      db
        .prepare(
          `SELECT designation, quantite, prix_unitaire AS prix, prix_normal AS normal, promotion_id AS promo,
                  promotion_nom AS nom, total_ligne AS total
           FROM lignes_vente WHERE vente_id = ? ORDER BY id`
        )
        .all(v.venteId)
    ).toEqual([
      {
        designation: expect.stringContaining('Carton'),
        quantite: 1,
        prix: 6000,
        normal: 7500,
        promo,
        nom: 'Tomate −20 %',
        total: 6000
      },
      {
        designation: expect.any(String),
        quantite: 2,
        prix: 280,
        normal: 350,
        promo,
        nom: 'Tomate −20 %',
        total: 560
      }
    ])
    // TVA recalculée sur ce que le client paie : 6 560 F à 18 % → HT 5 559, TVA 1 001.
    expect(une(db, 'SELECT total_ht AS ht, total_tva AS tva FROM ventes WHERE id = ?', v.venteId)).toEqual({
      ht: 5559,
      tva: 1001
    })
  })

  it('encaisser l’ancien prix est refusé : la somme des paiements doit égaler le prix promotionnel', () => {
    const db = boutique()
    promotion20(db)
    expect(() => vendre(db, AFI, 8200)).toThrow()
    expect(une(db, 'SELECT COUNT(*) AS n FROM ventes')!).toEqual({ n: 0 })
  })

  it('sans promotion (arrêtée, ou pas encore commencée) : prix normal et aucune mention', () => {
    const db = boutique()
    const arretee = promotion20(db)
    arreterPromotion(db, KOSSI, arretee)
    promotion20(db, { nom: 'Demain', dateDebut: jour(db, 1) })
    const v = vendre(db, AFI, 8200)
    expect(
      une(
        db,
        'SELECT prix_normal AS normal, promotion_id AS promo, promotion_nom AS nom FROM lignes_vente WHERE vente_id = ?',
        v.venteId
      )
    ).toEqual({ normal: null, promo: null, nom: null })
  })

  it('la marge se calcule sur le prix payé : 6 560 − coût 6 500 = 60 F', () => {
    const db = boutique()
    promotion20(db)
    vendre(db, AFI, 6560)
    expect(ventesPeriode(db, {})).toMatchObject({ chiffreAffaires: 6560, cout: 6500, marge: 60 })
  })

  it('la promotion n’est pas une remise : une caissière vend sans accord du gérant, la colonne « Remises » reste à 0', () => {
    const db = boutique()
    promotion20(db)
    vendre(db, AFI, 6560)
    const afi = ventesParCaissier(db, {}).lignes.find((l) => l.caissier === 'Afi')!
    expect(afi).toMatchObject({ ventesTtc: 6560, remises: 0 })
  })

  it('une remise de ligne se calcule sur le prix promotionnel, et ne peut pas le dépasser', () => {
    const db = boutique()
    promotion20(db)
    const carton = (remise: number): RequeteVente['lignes'] => [
      { conditionnementId: id(db, CARTON), quantite: 1, remise }
    ]
    const v = vendre(db, KOSSI, 5500, carton(500))
    expect(une(db, 'SELECT total_ligne AS t FROM lignes_vente WHERE vente_id = ?', v.venteId)).toEqual({
      t: 5500
    })
    // Le carton est à 6 000 F sous promotion : 6 001 F de remise dépasse la ligne (il aurait fallu 7 500 F sans promotion).
    expect(() => vendre(db, KOSSI, 0, carton(6001))).toThrow(/dépasse le montant de la ligne/)
  })

  it('un retour rend le prix payé : 1 unité sur 2 à 280 F → 280 F', () => {
    const db = boutique()
    promotion20(db)
    const v = vendre(db, AFI, 6560)
    const ligneUnite = consulterRetour(db, KOSSI, v.numeroTicket).lignes.find(
      (l) => !l.designation.includes('Carton')
    )!
    const r = enregistrerRetour(db, KOSSI, {
      numeroTicket: v.numeroTicket,
      lignes: [{ ligneId: ligneUnite.ligneId, quantite: 1 }],
      motif: 'defectueux',
      sort: 'detruire',
      remboursement: { mode: 'especes' }
    })
    expect(r.montant).toBe(280)
  })
})

describe('Ticket d’une vente en promotion (A16)', () => {
  it('mention sous chaque ligne en promotion et économie totale : 1 500 + 2 × 70 = 1 640 F', () => {
    const db = boutique()
    promotion20(db)
    const v = vendre(db, AFI, 6560)
    const ticket = lireTicket(db, v.venteId)
    expect(ticket.economiePromotions).toBe(1640)
    expect(ticket.lignes.map((l) => l.promotion)).toEqual([
      { nom: 'Tomate −20 %', prixNormal: 7500 },
      { nom: 'Tomate −20 %', prixNormal: 350 }
    ])
    const texte = lignesTicket(ticket, ENTETE, { duplicata: false }).map((l) => l.texte)
    expect(texte.filter((t) => t.includes('Promo Tomate −20 %'))).toHaveLength(2)
    expect(texte.some((t) => t.includes('au lieu de 7 500 F'))).toBe(true)
    expect(texte.some((t) => t.includes('au lieu de 350 F'))).toBe(true)
    expect(texte.find((t) => t.startsWith('Économie promotions'))).toMatch(/1 640 F$/)
    // Chaque ligne du ticket tient dans les 48 colonnes.
    expect(texte.every((t) => t.length <= 48)).toBe(true)
  })

  it('un ticket sans promotion n’a ni mention ni ligne d’économie', () => {
    const db = boutique()
    const v = vendre(db, AFI, 8200)
    const texte = lignesTicket(lireTicket(db, v.venteId), ENTETE, { duplicata: false }).map((l) => l.texte)
    expect(texte.some((t) => t.includes('Promo') || t.includes('Économie'))).toBe(false)
  })

  it('un retour n’affiche pas d’économie', () => {
    const db = boutique()
    promotion20(db)
    const v = vendre(db, AFI, 6560)
    const ligne = consulterRetour(db, KOSSI, v.numeroTicket).lignes[0]
    const r = enregistrerRetour(db, KOSSI, {
      numeroTicket: v.numeroTicket,
      lignes: [{ ligneId: ligne.ligneId, quantite: 1 }],
      motif: 'defectueux',
      sort: 'detruire',
      remboursement: { mode: 'especes' }
    })
    expect(lireTicket(db, r.venteId).economiePromotions).toBe(0)
  })
})

describe('Proforma et promotions (A16)', () => {
  const devis = (db: Db) => ({ lignes: [{ conditionnementId: id(db, CARTON), quantite: 2 }] })

  it('un devis fait pendant la promotion est au prix promotionnel : 2 cartons = 12 000 F', () => {
    const db = boutique()
    promotion20(db)
    expect(creerProforma(db, AFI, devis(db)).totalTtc).toBe(12000)
  })

  it('repris pendant la même promotion, le prix n’a pas changé ; promotion arrêtée, il a changé', () => {
    const db = boutique()
    const promo = promotion20(db)
    const p = creerProforma(db, AFI, devis(db))
    expect(lireProforma(db, p.numero).lignes[0]).toMatchObject({ prixProforma: 6000, prixChange: false })
    arreterPromotion(db, KOSSI, promo)
    expect(lireProforma(db, p.numero).lignes[0]).toMatchObject({ prixProforma: 6000, prixChange: true })
  })
})
