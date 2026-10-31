import { describe, expect, it } from 'vitest'
import { aRendre, messageAnnulation, peutAnnuler } from '../src/renderer/src/modules/caisse/annulation'
import { formaterFCFA as F } from '../src/shared/format'
import type { ResultatAnnulation, TicketConsulte } from '../src/shared/ipc/caisse'

const ticket: TicketConsulte = {
  venteId: 7,
  numeroTicket: 'T-2026-000007',
  horodatage: '2026-10-13 09:15:00',
  caissier: 'Afi',
  totalTtc: 8500,
  lignes: [],
  paiements: [
    { mode: 'tmoney', montant: 5000, reference: 'TM-0042' },
    { mode: 'especes', montant: 3500, reference: null }
  ],
  especesARendre: 3500,
  statut: 'terminee',
  motifAnnulation: null,
  raisonRefus: null
}

const resultat: ResultatAnnulation = {
  venteId: 7,
  numeroTicket: 'T-2026-000007',
  especesARendre: 3500,
  autresARendre: [{ mode: 'tmoney', montant: 5000, reference: 'TM-0042' }],
  creditAnnule: 0,
  avoirRetabli: 0,
  tiroirOuvert: true
}

describe('Annuler un ticket — fenêtre', () => {
  it('gérant : il suffit d’un ticket annulable et d’un motif', () => {
    const base = { ticket, motif: 'erreur', estCaissiere: false, gerantId: null, code: '' }
    expect(peutAnnuler(base)).toBe(true)
    expect(peutAnnuler({ ...base, motif: '  ' })).toBe(false)
    expect(peutAnnuler({ ...base, ticket: null })).toBe(false)
    expect(peutAnnuler({ ...base, ticket: { ...ticket, raisonRefus: 'déjà annulé' } })).toBe(false)
  })

  it('caissière : il faut aussi le gérant choisi et ses 4 chiffres', () => {
    const base = { ticket, motif: 'erreur', estCaissiere: true, gerantId: 3, code: '5678' }
    expect(peutAnnuler(base)).toBe(true)
    expect(peutAnnuler({ ...base, gerantId: null })).toBe(false)
    expect(peutAnnuler({ ...base, code: '567' })).toBe(false)
  })

  it('ce qu’il faut rendre : espèces, puis mobile money avec sa référence', () => {
    expect(aRendre(resultat)).toEqual([
      `Rendez ${F(3500)} en espèces.`,
      `Renvoyez ${F(5000)} par TMoney (réf. TM-0042).`
    ])
    expect(
      aRendre({ especesARendre: 0, autresARendre: [{ mode: 'flooz', montant: 600, reference: null }] })
    ).toEqual([`Renvoyez ${F(600)} par Flooz.`])
  })

  it('message dans la caisse, tiroir ouvert ou non', () => {
    expect(messageAnnulation(resultat)).toBe(
      `Ticket T-2026-000007 annulé. Rendez ${F(3500)} en espèces. Renvoyez ${F(5000)} par TMoney (réf. TM-0042).`
    )
    expect(messageAnnulation({ ...resultat, tiroirOuvert: false })).toMatch(/ouvrez-le à la clé\.$/)
    // Rien en espèces : pas de remarque sur le tiroir.
    expect(messageAnnulation({ ...resultat, especesARendre: 0, tiroirOuvert: false })).not.toMatch(/tiroir/)
  })
})
