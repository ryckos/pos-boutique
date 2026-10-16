import { describe, expect, it } from 'vitest'
import type { ArticleCatalogue } from '../src/shared/types'
import type { LigneProformaReprise, ProformaReprise } from '../src/shared/ipc/caisse'
import {
  alerteRemisesHorsPlafond,
  estNumeroFacture,
  manqueClient,
  nettoyerClient,
  panierDeProforma,
  saisieClientVide
} from '../src/renderer/src/modules/caisse/documents'
import {
  ajouterArticle,
  panierVide,
  totalLigne,
  totalPanier,
  totalRemises
} from '../src/renderer/src/modules/caisse/panier'
import { etatCaisseInitial, reducteurCaisse } from '../src/renderer/src/modules/caisse/attente'

describe('client d’une facture ou d’une proforma (A10)', () => {
  it('retire les espaces et les champs vides', () => {
    expect(nettoyerClient({ nom: '  Ets Agbodjan ', telephone: ' ', adresse: 'Bè, Lomé ', nif: '' })).toEqual(
      { nom: 'Ets Agbodjan', adresse: 'Bè, Lomé' }
    )
  })

  it('garde le NIF et le téléphone saisis', () => {
    expect(
      nettoyerClient({ nom: 'Kodjo', telephone: '90 12 34 56', adresse: '', nif: '1000123456' })
    ).toEqual({
      nom: 'Kodjo',
      telephone: '90 12 34 56',
      nif: '1000123456'
    })
  })

  it('rien de saisi = pas de client (proforma de passage)', () => {
    expect(nettoyerClient({ nom: ' ', telephone: '', adresse: '  ', nif: '' })).toBeNull()
  })

  it('facture : le nom est obligatoire', () => {
    expect(manqueClient(saisieClientVide, true)).toMatch(/nom du client/)
    expect(manqueClient({ ...saisieClientVide, nom: '   ' }, true)).toMatch(/nom du client/)
    expect(manqueClient({ ...saisieClientVide, nom: 'Kodjo' }, true)).toBeNull()
  })

  it('proforma : client facultatif, mais un client donné a un nom', () => {
    expect(manqueClient(saisieClientVide, false)).toBeNull()
    expect(manqueClient({ ...saisieClientVide, telephone: '90 12 34 56' }, false)).toMatch(/nom/)
    expect(manqueClient({ ...saisieClientVide, telephone: '90 12 34 56' }, true)).toMatch(/nom/)
  })

  it('reconnaît un numéro de facture', () => {
    expect(estNumeroFacture(' f-2026-000003')).toBe(true)
    expect(estNumeroFacture('T-2026-000158')).toBe(false)
    expect(estNumeroFacture('158')).toBe(false)
  })
})

function article(
  conditionnementId: number,
  designation: string,
  prixVente: number,
  quantiteBase = 1
): ArticleCatalogue {
  return {
    conditionnementId,
    produitId: conditionnementId,
    designation,
    conditionnement: quantiteBase === 1 ? 'Unité' : `Carton de ${quantiteBase}`,
    quantiteBase,
    prixVente,
    tauxTva: 18,
    suiviPeremption: false,
    coutConditionnement: 0,
    codeBarres: null,
    codePlu: null
  }
}
const carton = article(3, 'Tomate concentrée (carton de 24)', 7500, 24)
const baguette = article(5, 'Baguette', 300)
const lait = article(8, 'Lait UHT 1 L', 900)

function ligne(
  a: ArticleCatalogue,
  quantite: number,
  remise = 0,
  prixProforma = a.prixVente
): LigneProformaReprise {
  return {
    conditionnementId: a.conditionnementId,
    designation: a.designation,
    quantite,
    remise,
    prixProforma,
    article: a,
    prixChange: prixProforma !== a.prixVente
  }
}

function proforma(lignes: LigneProformaReprise[], autre: Partial<ProformaReprise> = {}): ProformaReprise {
  return {
    proformaId: 12,
    numero: 'PF-2026-000012',
    horodatage: '2026-10-16 09:30:00',
    valideJusquAu: '2026-11-15',
    expiree: false,
    client: null,
    remiseGlobale: 0,
    totalTtc: 0,
    lignes,
    ...autre
  }
}

describe('reprise d’une proforma dans la caisse (A10)', () => {
  it('2 cartons (remise 500) + 3 baguettes, remise ticket 400 : 15 000 F, sans alerte', () => {
    const { panier, alertes } = panierDeProforma(
      proforma([ligne(carton, 2, 500), ligne(baguette, 3)], { remiseGlobale: 400 })
    )
    expect(panier.lignes.map((l) => [l.article.conditionnementId, l.quantite, l.remise ?? 0])).toEqual([
      [3, 2, 500],
      [5, 3, 0]
    ])
    expect(totalLigne(panier.lignes[0])).toBe(14_500)
    expect(panier.remiseGlobale).toBe(400)
    expect(totalPanier(panier)).toBe(15_000)
    expect(panier.selection).toBeNull()
    expect(panier.accord).toBeUndefined()
    expect(alertes).toEqual([])
  })

  it('prix changé : la ligne passe au prix du jour et le bandeau le dit', () => {
    const { panier, alertes } = panierDeProforma(proforma([ligne(carton, 1, 0, 7000)]))
    expect(totalPanier(panier)).toBe(7500)
    expect(alertes).toHaveLength(1)
    expect(alertes[0]).toContain('Tomate concentrée (carton de 24)')
    expect(alertes[0]).toMatch(/7\s000 F sur la proforma, 7\s500 F aujourd’hui/)
  })

  it('une remise plus grande que la ligne au nouveau prix est ramenée à la ligne', () => {
    const moinsCher = { ...baguette, prixVente: 200 }
    const { panier } = panierDeProforma(proforma([ligne(moinsCher, 1, 250, 300)]))
    expect(panier.lignes[0].remise).toBe(200)
    expect(totalPanier(panier)).toBe(0)
  })

  it('article retiré de la vente : non repris, signalé, hors du total', () => {
    const retire: LigneProformaReprise = { ...ligne(lait, 2), article: null, prixChange: false }
    const { panier, alertes } = panierDeProforma(proforma([ligne(baguette, 3), retire]))
    expect(panier.lignes).toHaveLength(1)
    expect(totalPanier(panier)).toBe(900)
    expect(alertes).toEqual(['Lait UHT 1 L : n’est plus en vente, non repris au ticket.'])
  })

  it('proforma périmée : signalée avec sa date, lignes reprises quand même', () => {
    const { panier, alertes } = panierDeProforma(
      proforma([ligne(baguette, 2)], { expiree: true, valideJusquAu: '2026-09-30' })
    )
    expect(totalPanier(panier)).toBe(600)
    expect(alertes).toEqual([
      'Proforma PF-2026-000012 périmée depuis le 30/09/2026 : vente aux prix du jour.'
    ])
  })

  it('tous les articles retirés : panier vide, la remise sur le ticket ne reste pas', () => {
    const retire: LigneProformaReprise = { ...ligne(lait, 1), article: null, prixChange: false }
    const { panier } = panierDeProforma(proforma([retire], { remiseGlobale: 100 }))
    expect(panier).toEqual(panierVide)
  })

  it('ticket en cours : il part en attente, la proforma devient le ticket courant', () => {
    const enCours = { ...etatCaisseInitial, courant: ajouterArticle(panierVide, lait) }
    const { panier } = panierDeProforma(proforma([ligne(baguette, 3)]))
    const etat = reducteurCaisse(enCours, { type: 'chargerPanier', panier, maintenant: 0 })
    expect(etat.courant).toBe(panier)
    expect(etat.attente).toHaveLength(1)
    expect(etat.attente[0].panier.lignes[0].article.designation).toBe('Lait UHT 1 L')
  })

  it('panier vide : la caisse ne bouge pas', () => {
    const enCours = { ...etatCaisseInitial, courant: ajouterArticle(panierVide, lait) }
    expect(reducteurCaisse(enCours, { type: 'chargerPanier', panier: panierVide, maintenant: 0 })).toBe(
      enCours
    )
  })

  it('remises reprises au-delà du plafond de la caissière : bandeau ; gérant ou sous le plafond : rien', () => {
    const { panier } = panierDeProforma(
      proforma([ligne(carton, 2, 500), ligne(baguette, 3)], { remiseGlobale: 400 })
    )
    expect(totalRemises(panier)).toBe(900)
    expect(alerteRemisesHorsPlafond(panier, 500, true)).toMatch(/Remises de 900 F au-delà de votre plafond/)
    expect(alerteRemisesHorsPlafond(panier, null, true)).toMatch(/gérant/)
    expect(alerteRemisesHorsPlafond(panier, 1000, true)).toBeNull()
    expect(alerteRemisesHorsPlafond(panier, null, false)).toBeNull()
    expect(alerteRemisesHorsPlafond(panierVide, null, true)).toBeNull()
  })
})
