import { describe, expect, it } from 'vitest'
import { choisirEcranClient } from '../src/shared/ecran-client'
import type { RequeteVente, VenteEnregistree } from '../src/shared/ipc/caisse'
import type { PanierClient } from '../src/shared/types'
import {
  DUREE_FIN_VENTE_MS,
  finDeVente,
  nombreArticles,
  vueEcranClient
} from '../src/renderer/src/modules/caisse/ecran-client'

const ecran = (id: number, x: number) => ({ id, bounds: { x, y: 0, width: 1366, height: 768 } })

describe('choix de l’écran client (A13)', () => {
  it('prend le second écran quand il existe', () => {
    const principal = ecran(1, 0)
    const client = ecran(2, 1920)
    expect(choisirEcranClient([principal, client], 1)).toBe(client)
  })

  it('prend le premier écran qui n’est pas le principal, même listé en tête', () => {
    expect(choisirEcranClient([ecran(2, 1920), ecran(1, 0)], 1)?.id).toBe(2)
  })

  it('ne choisit rien avec un seul écran : la fenêtre client reste à la demande', () => {
    expect(choisirEcranClient([ecran(1, 0)], 1)).toBeNull()
  })
})

// ─── Contenu de l'écran (A13, UI_UX § 5.5) ───
function vente(v: Partial<VenteEnregistree>): VenteEnregistree {
  return {
    venteId: 1,
    numeroTicket: 'T-2026-000001',
    totalTtc: 8500,
    monnaieRendue: 0,
    alertesStock: [],
    alertesPeremption: [],
    credit: null,
    avoir: null,
    ...v
  }
}

const especes = (montantRecu?: number): RequeteVente => ({
  lignes: [{ conditionnementId: 1, quantite: 1 }],
  paiements: [{ mode: 'especes', montant: 8500 }],
  ...(montantRecu !== undefined && { montantRecu })
})

describe('fin de vente affichée au client', () => {
  it('espèces : total 8 500 F, reçu 10 000 F, monnaie 1 500 F (vente de démo)', () => {
    expect(finDeVente(vente({ monnaieRendue: 1500 }), especes(10000))).toEqual({
      total: 8500,
      recu: 10000,
      monnaieRendue: 1500
    })
  })

  it('mobile money : ni reçu ni monnaie', () => {
    const requete: RequeteVente = {
      lignes: [{ conditionnementId: 1, quantite: 1 }],
      paiements: [{ mode: 'tmoney', montant: 8500, reference: 'TM123' }]
    }
    const fin = finDeVente(vente({}), requete)
    expect(fin.recu).toBeUndefined()
    expect(fin.monnaieRendue).toBe(0)
  })

  it('espèces au montant exact : pas de reçu saisi, pas de monnaie', () => {
    expect(finDeVente(vente({}), especes()).recu).toBeUndefined()
  })

  it('ticket à crédit : montant et échéance, sans monnaie', () => {
    const credit = { client: 'Mme Ama', montant: 8500, echeance: '2026-12-01', encoursApres: 8500 }
    const fin = finDeVente(vente({ credit }), {
      lignes: [{ conditionnementId: 1, quantite: 1 }],
      paiements: [{ mode: 'credit', montant: 8500 }],
      clientId: 4
    })
    expect(fin.credit).toEqual({ montant: 8500, echeance: '2026-12-01' })
    expect(fin.monnaieRendue).toBe(0)
  })
})

describe('vue de l’écran client', () => {
  const vide: PanierClient = { lignes: [], total: 0 }
  const ligne = { designation: 'Tomate concentrée', quantite: 2, total: 700 }
  const fin = { total: 8500, recu: 10000, monnaieRendue: 1500 }

  it('ticket vide sans fin de vente : accueil', () => {
    expect(vueEcranClient(vide, false)).toBe('accueil')
  })

  it('juste après l’encaissement : fin de vente, puis accueil une fois le délai écoulé', () => {
    expect(vueEcranClient({ ...vide, fin }, false)).toBe('fin')
    expect(vueEcranClient({ ...vide, fin }, true)).toBe('accueil')
    expect(DUREE_FIN_VENTE_MS).toBe(8000)
  })

  it('un article scanné pour le client suivant l’emporte sur la fin de vente', () => {
    expect(vueEcranClient({ lignes: [ligne], total: 700, fin }, false)).toBe('panier')
  })

  it('compte les articles, pas les lignes', () => {
    expect(nombreArticles({ lignes: [ligne, { ...ligne, quantite: 5 }], total: 0 })).toBe(7)
  })
})
