import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { une } from '../src/main/db/requetes'
import { encodeText, IMPULSION_TIROIR } from '../src/main/materiel/escpos'
import { ecrireReglages, lireReglages, REGLAGES_PAR_DEFAUT } from '../src/main/materiel/reglages'
import {
  couper,
  ENTETE_PROVISOIRE,
  LARGEUR,
  lignesTicket,
  mettreEnPageTicket,
  montantTicket
} from '../src/main/materiel/ticket'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import { ouvrirSession } from '../src/main/modules/caisse/service-session'
import {
  dejaImprime,
  lireTicket,
  noterImpression,
  ouvrirTiroirPour,
  venteParNumero,
  verifierDroitImpression
} from '../src/main/modules/caisse/service-ticket'
import { enregistrerVente } from '../src/main/modules/caisse/service-vente'
import type { RequeteVente } from '../src/shared/ipc/caisse'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

const id = (db: Db, code: string): number => rechercherParCode(db, code)!.conditionnementId

/** Vente de démo d'Afi : 1 carton de tomate + 2 unités + 1 baguette = 8 500 F, payée avec 10 000 F. */
function venteDemo(paiements?: RequeteVente['paiements']): { db: Db; venteId: number } {
  const db = baseAvecDemo()
  ouvrirSession(db, AFI.id, 10000)
  const { venteId } = enregistrerVente(db, AFI.id, {
    lignes: [
      { conditionnementId: id(db, '16181000000049'), quantite: 1 },
      { conditionnementId: id(db, '6181000000042'), quantite: 2 },
      { conditionnementId: id(db, '101'), quantite: 1 }
    ],
    paiements: paiements ?? [{ mode: 'especes', montant: 8500 }],
    ...(paiements ? {} : { montantRecu: 10000 })
  })
  return { db, venteId }
}

const texte = (db: Db, venteId: number, duplicata = false): string[] =>
  lignesTicket(lireTicket(db, venteId), ENTETE_PROVISOIRE, { duplicata }).map((l) => l.texte)

/** Cherche une suite d'octets dans un tampon. */
const contient = (b: Buffer, suite: readonly number[]): boolean => b.indexOf(Buffer.from(suite)) !== -1

describe('Ticket de caisse — contenu', () => {
  it('vente de démo : numéro, lignes, total 8 500 F, TVA ventilée, monnaie rendue', () => {
    const { db, venteId } = venteDemo()
    const t = texte(db, venteId)
    expect(t).toContain('Ticket T-' + new Date().getFullYear() + '-000001')
    expect(t).toContain('Caisse Afi')
    // Carton : désignation longue, puis « 1 x … » ; unités : « 2 x 350 F » ; baguette sur une ligne.
    expect(t.some((l) => l.startsWith('Tomate concentrée 70 g — Carton de 24'))).toBe(true)
    expect(t.some((l) => /^ {2}2 x 350 F +700 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Baguette +300 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^TOTAL +8 500 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Dont HT 18 % +6 949 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Dont TVA 18 % +1 251 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Dont HT 0 % +300 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Espèces reçues +10 000 F$/.test(l))).toBe(true)
    expect(t.some((l) => /^Monnaie rendue +1 500 F$/.test(l))).toBe(true)
    expect(t).not.toContain('DUPLICATA')
  })

  it('aucune ligne ne dépasse 48 colonnes (24 en double taille)', () => {
    const { db, venteId } = venteDemo()
    for (const l of lignesTicket(lireTicket(db, venteId), ENTETE_PROVISOIRE, { duplicata: true })) {
      expect(l.texte.length).toBeLessThanOrEqual(l.double ? LARGEUR / 2 : LARGEUR)
    }
  })

  it('mobile money : la référence figure sur le ticket, pas de ligne d’espèces reçues', () => {
    const { db, venteId } = venteDemo([{ mode: 'tmoney', montant: 8500, reference: 'TM-88213' }])
    const t = texte(db, venteId)
    expect(t.some((l) => /^TMoney \(réf\. TM-88213\) +8 500 F$/.test(l))).toBe(true)
    expect(t.some((l) => l.startsWith('Espèces reçues'))).toBe(false)
  })

  it('duplicata : bandeau en tête et mention en pied', () => {
    const { db, venteId } = venteDemo()
    expect(texte(db, venteId, true).filter((l) => l === 'DUPLICATA')).toHaveLength(2)
  })

  it('coupe une désignation longue aux espaces, un mot trop long à la largeur', () => {
    expect(couper('Riz parfumé long grain qualité supérieure sac de 25 kg importé de Thaïlande')).toEqual([
      'Riz parfumé long grain qualité supérieure sac de',
      '25 kg importé de Thaïlande'
    ])
    expect(couper('x'.repeat(50))).toEqual(['x'.repeat(48), 'xx'])
  })

  it('montants avec une espace ORDINAIRE (pas d’espace fine inconnue de l’imprimante)', () => {
    expect(montantTicket(1250000)).toBe('1 250 000 F')
    expect(montantTicket(300)).toBe('300 F')
  })
})

describe('Ticket de caisse — octets ESC/POS', () => {
  it('cp858 : accents et tiret long encodés, aucun « ? » dans le ticket de démo', () => {
    const { db, venteId } = venteDemo()
    const octets = mettreEnPageTicket(lireTicket(db, venteId), ENTETE_PROVISOIRE, 'cp858', {
      duplicata: false,
      tiroir: true
    })
    expect(octets.includes(0x3f)).toBe(false)
    expect(encodeText('é', 'cp858')).toEqual([0x82])
    expect(encodeText('—', 'cp858')).toEqual([0x2d])
  })

  it('cp1252 : le symbole € est encodé (0x80) — il sortait en « ? » avant A3', () => {
    expect(encodeText('€', 'cp1252')).toEqual([0x80])
    expect(encodeText('é', 'cp1252')).toEqual([0xe9])
    // « 8 500 » tel que formaterFCFA l'écrit, avec une espace fine insécable (U+202F).
    expect(encodeText(`8${String.fromCharCode(0x202f)}500`, 'cp1252')).toEqual([0x38, 0x20, 0x35, 0x30, 0x30])
  })

  it('tiroir : impulsion pour une vente en espèces, jamais pour un duplicata ni pour TMoney seul', () => {
    const especes = venteDemo()
    const t = lireTicket(especes.db, especes.venteId)
    expect(ouvrirTiroirPour(t, false)).toBe(true)
    expect(ouvrirTiroirPour(t, true)).toBe(false)
    const tmoney = venteDemo([{ mode: 'tmoney', montant: 8500, reference: 'TM-1' }])
    expect(ouvrirTiroirPour(lireTicket(tmoney.db, tmoney.venteId), false)).toBe(false)

    const avec = mettreEnPageTicket(t, ENTETE_PROVISOIRE, 'cp858', { duplicata: false, tiroir: true })
    const sans = mettreEnPageTicket(t, ENTETE_PROVISOIRE, 'cp858', { duplicata: true, tiroir: false })
    expect(contient(avec, IMPULSION_TIROIR)).toBe(true)
    expect(contient(sans, IMPULSION_TIROIR)).toBe(false)
  })
})

describe('Impression : original, duplicata et droits', () => {
  it('première impression = original ; une fois notée, les suivantes sont des duplicatas', () => {
    const { db, venteId } = venteDemo()
    expect(dejaImprime(db, venteId)).toBe(false)
    noterImpression(db, AFI.id, venteId, false)
    expect(dejaImprime(db, venteId)).toBe(true)
    noterImpression(db, AFI.id, venteId, true)
    const n = une<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM journal_audit WHERE action = 'impression_ticket'"
    )
    expect(n!.n).toBe(2)
  })

  it('une panne d’imprimante (rien de noté) laisse le prochain « Réimprimer » sortir l’original', () => {
    const { db, venteId } = venteDemo()
    // L'envoi a échoué : noterImpression n'est pas appelée.
    expect(dejaImprime(db, venteId)).toBe(false)
  })

  it('retrouve une vente par son numéro de ticket, refuse un numéro inconnu', () => {
    const { db, venteId } = venteDemo()
    const numero = lireTicket(db, venteId).numeroTicket
    expect(venteParNumero(db, ` ${numero} `)).toBe(venteId)
    expect(() => venteParNumero(db, 'T-2026-999999')).toThrow(/introuvable/)
  })

  it('la caissière réimprime les tickets de sa session, pas ceux d’une autre ; le gérant, tous', () => {
    const { db, venteId } = venteDemo()
    expect(() => verifierDroitImpression(db, AFI, venteId)).not.toThrow()
    expect(() => verifierDroitImpression(db, KOSSI, venteId)).not.toThrow()
    const autreCaissiere: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'caissier' }
    expect(() => verifierDroitImpression(db, autreCaissiere, venteId)).toThrow(/pas de votre session/)
  })
})

describe('Réglages de l’imprimante (fichier local)', () => {
  const dossier = (): string => mkdtempSync(join(tmpdir(), 'pos-reglages-'))

  it('sans fichier : valeurs par défaut, page de codes cp858 provisoire (D-A2)', () => {
    expect(lireReglages(join(dossier(), 'materiel.json'))).toEqual(REGLAGES_PAR_DEFAUT)
    expect(REGLAGES_PAR_DEFAUT.pageDeCodes).toBe('cp858')
  })

  it('enregistrer puis relire donne les mêmes réglages', () => {
    const chemin = join(dossier(), 'materiel.json')
    ecrireReglages(chemin, { methode: 'share', cible: ' XP-80 ', pageDeCodes: 'cp1252' })
    expect(lireReglages(chemin)).toEqual({ methode: 'share', cible: 'XP-80', pageDeCodes: 'cp1252' })
  })

  it('refuse une imprimante vide ; un fichier abîmé redonne les valeurs par défaut', () => {
    const chemin = join(dossier(), 'materiel.json')
    expect(() => ecrireReglages(chemin, { ...REGLAGES_PAR_DEFAUT, cible: '  ' })).toThrow(
      /Choisissez l’imprimante/
    )
    writeFileSync(chemin, '{ pas du json')
    expect(lireReglages(chemin)).toEqual(REGLAGES_PAR_DEFAUT)
    writeFileSync(chemin, JSON.stringify({ methode: 'fax', cible: 'XP', pageDeCodes: 'cp999' }))
    expect(lireReglages(chemin)).toEqual({ ...REGLAGES_PAR_DEFAUT, cible: 'XP' })
  })
})
