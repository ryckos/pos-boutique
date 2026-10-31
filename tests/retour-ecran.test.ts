import { describe, expect, it } from 'vitest'
import type { TicketRetour } from '../src/shared/ipc/caisse'
import {
  basculerLigne,
  ceQuiManque,
  changerQuantiteRendue,
  lignesChoisies,
  messageRetour,
  modeParDefaut,
  montantARendre,
  type SaisieRetour,
  versRequete
} from '../src/renderer/src/modules/caisse/retour'

/** Ticket de 3 lignes : jus (1 × 600), 3 tomates remisées (950 payés, 1 déjà rendue), baguette déjà rendue. */
const TICKET: TicketRetour = {
  venteId: 1,
  numeroTicket: 'T-2026-000158',
  horodatage: '2026-10-12 10:00:00',
  caissier: 'Afi',
  totalTtc: 1850,
  lignes: [
    {
      ligneId: 10,
      designation: 'Jus d’ananas 1 L',
      prixUnitaire: 600,
      totalLigne: 600,
      quantiteVendue: 1,
      quantiteDejaRetournee: 0,
      montantPaye: 600,
      montantDejaRembourse: 0
    },
    {
      ligneId: 11,
      designation: 'Tomate concentrée',
      prixUnitaire: 350,
      totalLigne: 634,
      quantiteVendue: 3,
      quantiteDejaRetournee: 1,
      montantPaye: 950,
      montantDejaRembourse: 316
    },
    {
      ligneId: 12,
      designation: 'Baguette',
      prixUnitaire: 300,
      totalLigne: 0,
      quantiteVendue: 1,
      quantiteDejaRetournee: 1,
      montantPaye: 300,
      montantDejaRembourse: 300
    }
  ],
  paiements: [
    { mode: 'tmoney', montant: 1500, reference: 'TM-1' },
    { mode: 'especes', montant: 350, reference: null }
  ],
  retoursPrecedents: ['R-2026-000001'],
  raisonRefus: null,
  clientAvoir: null,
  credit: null
}

const saisie = (autres: Partial<SaisieRetour> = {}): SaisieRetour => ({
  ticket: TICKET,
  selection: { 10: 1 },
  motif: 'defectueux',
  precision: '',
  sort: 'detruire',
  mode: 'especes',
  reference: '',
  client: null,
  estCaissiere: false,
  gerantId: null,
  code: '',
  ...autres
})

describe('Fenêtre « Retour client » (A7)', () => {
  it('cocher rend tout ce qui reste ; + / − entre 1 et le retournable ; une ligne rendue ne se coche pas', () => {
    let s = basculerLigne({}, TICKET, 11)
    expect(s).toEqual({ 11: 2 })
    s = changerQuantiteRendue(s, TICKET, 11, -1)
    expect(s).toEqual({ 11: 1 })
    expect(changerQuantiteRendue(s, TICKET, 11, -1)).toEqual({ 11: 1 })
    expect(changerQuantiteRendue({ 11: 2 }, TICKET, 11, 1)).toEqual({ 11: 2 })
    expect(basculerLigne(s, TICKET, 12)).toEqual(s)
    expect(basculerLigne(s, TICKET, 11)).toEqual({})
  })

  it('montant à rendre : comme le service (jus 600 + 1 tomate 316 = 916 ; les 2 dernières 634)', () => {
    expect(montantARendre(TICKET, { 10: 1, 11: 1 })).toBe(916)
    expect(montantARendre(TICKET, { 11: 2 })).toBe(634)
    expect(lignesChoisies(TICKET, { 11: 1, 10: 1 })).toEqual([
      { ligneId: 10, quantite: 1 },
      { ligneId: 11, quantite: 1 }
    ])
  })

  it('mode proposé : celui qui a payé le plus', () => {
    expect(modeParDefaut(TICKET)).toBe('tmoney')
    expect(modeParDefaut({ ...TICKET, paiements: [] })).toBe('especes')
  })

  it('ce qui manque, dans l’ordre de la fenêtre', () => {
    expect(ceQuiManque(saisie())).toBeNull()
    expect(ceQuiManque(saisie({ ticket: null }))).toMatch(/Affichez le ticket/)
    expect(ceQuiManque(saisie({ selection: {} }))).toMatch(/Cochez/)
    expect(ceQuiManque(saisie({ motif: null }))).toMatch(/motif/)
    expect(ceQuiManque(saisie({ motif: 'autre', precision: ' ' }))).toMatch(/Précisez/)
    expect(ceQuiManque(saisie({ sort: null }))).toMatch(/sort du produit/)
    expect(ceQuiManque(saisie({ mode: 'flooz' }))).toMatch(/référence du transfert Flooz/)
    expect(ceQuiManque(saisie({ estCaissiere: true, gerantId: 3, code: '56' }))).toMatch(/gérant/)
    expect(ceQuiManque(saisie({ estCaissiere: true, gerantId: 3, code: '5678' }))).toBeNull()
  })

  it('requête : référence seulement en mobile money, code seulement pour la caissière', () => {
    expect(versRequete(saisie({ precision: ' boîte bombée ' }))).toEqual({
      numeroTicket: 'T-2026-000158',
      lignes: [{ ligneId: 10, quantite: 1 }],
      motif: 'defectueux',
      precision: 'boîte bombée',
      sort: 'detruire',
      remboursement: { mode: 'especes' }
    })
    expect(
      versRequete(
        saisie({ mode: 'tmoney', reference: ' TM-9 ', estCaissiere: true, gerantId: 3, code: '5678' })
      )
    ).toMatchObject({
      remboursement: { mode: 'tmoney', reference: 'TM-9' },
      autorisation: { utilisateurId: 3, code: '5678' }
    })
  })

  it('message dans la caisse', () => {
    const r = {
      venteId: 9,
      numeroRetour: 'R-2026-000002',
      numeroTicketOrigine: 'T-2026-000158',
      montant: 600,
      mode: 'especes' as const,
      avoir: null,
      tiroirOuvert: true,
      creanceReduite: 0
    }
    expect(messageRetour(r)).toMatch(
      /^Retour R-2026-000002 enregistré \(ticket T-2026-000158\)\. Rendez 600\sF en espèces\.$/
    )
    expect(messageRetour({ ...r, tiroirOuvert: false })).toMatch(/ouvrez-le à la clé/)
    expect(messageRetour({ ...r, mode: 'tmoney' })).toMatch(/remboursés par TMoney\.$/)
    expect(messageRetour({ ...r, montant: 0 })).toMatch(/Rien à rembourser/)
  })

  it('remboursement en avoir : le client est obligatoire, pas de référence, clientId envoyé', () => {
    expect(ceQuiManque(saisie({ mode: 'avoir' }))).toMatch(/client qui reçoit l’avoir/)
    const avecClient = saisie({ mode: 'avoir', client: { id: 4, nom: 'Mme Abra' } })
    expect(ceQuiManque(avecClient)).toBeNull()
    const r = versRequete(avecClient)
    expect(r.clientId).toBe(4)
    expect(r.remboursement).toEqual({ mode: 'avoir' })
  })

  it('ticket payé par avoir : le mode proposé est l’avoir', () => {
    expect(modeParDefaut({ ...TICKET, clientAvoir: { id: 4, nom: 'Mme Abra' } })).toBe('avoir')
  })

  it('message dans la caisse après un retour en avoir', () => {
    const m = messageRetour({
      venteId: 9,
      numeroRetour: 'R-2026-000002',
      numeroTicketOrigine: 'T-2026-000158',
      montant: 600,
      mode: 'avoir',
      avoir: { numero: 'AV-2026-000001', montant: 600, client: 'Mme Abra', soldeClient: 600 },
      tiroirOuvert: false,
      creanceReduite: 0
    })
    expect(m).toContain('en avoir AV-2026-000001 au nom de Mme Abra')
    expect(m).not.toMatch(/tiroir/)
  })
})
