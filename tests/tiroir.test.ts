import { describe, expect, it } from 'vitest'
import {
  annulableAuTiroir,
  heureMouvement,
  libelleEnregistrer,
  messageEnregistre,
  montantSigne,
  nouvelleSaisie,
  versRequeteMouvement
} from '../src/renderer/src/modules/caisse/tiroir'
import { formaterFCFA as F } from '../src/shared/format'
import type { MouvementCaisse } from '../src/shared/ipc/caisse'

const mouvement = (m: Partial<MouvementCaisse>): MouvementCaisse => ({
  id: 1,
  sessionId: 4,
  sens: 'entree',
  motif: 'apport',
  libelle: 'Apport (monnaie)',
  montant: 3500,
  commentaire: 'monnaie',
  documentType: null,
  documentId: null,
  auteur: 'Kossi',
  horodatage: '2026-10-12 14:05:33',
  mouvementOrigineId: null,
  annuleParId: null,
  ...m
})

describe('Espèces du tiroir — saisie', () => {
  it('apport : sens imposé, montant tapé avec espaces, motif nettoyé', () => {
    const s = { ...nouvelleSaisie(4, 'apport'), montant: '3 500', commentaire: '  monnaie ' }
    expect(versRequeteMouvement(s)).toEqual({
      sessionId: 4,
      motif: 'apport',
      sens: 'entree',
      montant: 3500,
      commentaire: 'monnaie'
    })
    expect(libelleEnregistrer(s)).toBe('Enregistrer l’apport')
  })

  it('incomplète tant que montant, motif ou sens (pour « Autre ») manque', () => {
    const autre = nouvelleSaisie(4, 'autre')
    expect(autre.sens).toBeNull()
    expect(versRequeteMouvement({ ...autre, montant: '500', commentaire: 'x' })).toBeNull()
    expect(versRequeteMouvement({ ...autre, sens: 'sortie', montant: '0', commentaire: 'x' })).toBeNull()
    expect(versRequeteMouvement({ ...autre, sens: 'sortie', montant: '500', commentaire: ' ' })).toBeNull()
    expect(versRequeteMouvement({ ...autre, sens: 'sortie', montant: '500', commentaire: 'x' })?.sens).toBe(
      'sortie'
    )
  })

  it('le bouton dit l’action', () => {
    expect(libelleEnregistrer(nouvelleSaisie(4, 'retrait'))).toBe('Enregistrer le retrait')
    expect(libelleEnregistrer(nouvelleSaisie(4, 'autre'))).toBe('Enregistrer le mouvement')
    expect(libelleEnregistrer({ ...nouvelleSaisie(4, 'autre'), sens: 'entree' })).toBe('Enregistrer l’entrée')
    expect(libelleEnregistrer({ ...nouvelleSaisie(4, 'autre'), sens: 'sortie' })).toBe(
      'Enregistrer la sortie'
    )
  })
})

describe('Espèces du tiroir — liste', () => {
  it('montant signé et heure', () => {
    expect(montantSigne(mouvement({}))).toBe(3500)
    expect(montantSigne(mouvement({ sens: 'sortie', montant: 1000 }))).toBe(-1000)
    expect(heureMouvement('2026-10-12 14:05:33')).toBe('14:05')
  })

  it('« Annuler » : seulement un apport, un retrait ou un « Autre » encore valable', () => {
    expect(annulableAuTiroir(mouvement({}))).toBe(true)
    expect(annulableAuTiroir(mouvement({ motif: 'autre' }))).toBe(true)
    expect(annulableAuTiroir(mouvement({ annuleParId: 2 }))).toBe(false)
    expect(annulableAuTiroir(mouvement({ mouvementOrigineId: 1, sens: 'sortie' }))).toBe(false)
    expect(annulableAuTiroir(mouvement({ motif: 'depense', sens: 'sortie' }))).toBe(false)
  })

  it('message après l’enregistrement, tiroir ouvert ou non', () => {
    expect(messageEnregistre(mouvement({}), true)).toBe(
      `Entrée de ${F(3500)} enregistrée. Rangez les espèces dans le tiroir.`
    )
    expect(messageEnregistre(mouvement({ sens: 'sortie', montant: 20000 }), false)).toBe(
      `Sortie de ${F(20000)} enregistrée, mais le tiroir ne s’est pas ouvert : ouvrez-le à la clé.`
    )
    expect(messageEnregistre(mouvement({ sens: 'sortie', mouvementOrigineId: 1 }), true)).toBe(
      `Annulation de ${F(3500)} enregistrée. Prenez les espèces dans le tiroir.`
    )
  })
})
