import { describe, expect, it } from 'vitest'
import { lireParametres } from '../src/main/modules/parametres/service'
import { executer } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo, baseDeTest } from './aide'

function poser(db: Db, cle: string, valeur: string | null): void {
  executer(db, 'INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', cle, valeur)
}

describe('Lecture des paramètres', () => {
  it('applique les défauts de REGLES_METIER § 13 sur une base vide', () => {
    expect(lireParametres(baseDeTest())).toEqual({
      boutiqueNom: null,
      boutiqueAdresse: null,
      boutiqueNif: null,
      ticketPied: 'Merci de votre visite !',
      tvaDefaut: 18,
      plafondRemiseCaissier: null,
      peremptionSeuilJours: 15,
      dormantJours: 60,
      imprimanteMethode: 'spooler',
      imprimanteCible: null,
      imprimantePageCodes: null
    })
  })

  it('lit les valeurs de la démo (en-tête du ticket)', () => {
    const p = lireParametres(baseAvecDemo())
    expect(p.boutiqueNom).toBe('MA BOUTIQUE')
    expect(p.boutiqueAdresse).toBe('Lomé, Togo')
    expect(p.ticketPied).toBe('Merci de votre visite !')
  })

  it('convertit les nombres et lit les réglages de l’imprimante', () => {
    const db = baseDeTest()
    poser(db, 'tva_defaut', '0')
    poser(db, 'plafond_remise_caissier', '500')
    poser(db, 'peremption_seuil_jours', '7')
    poser(db, 'dormant_jours', '90')
    poser(db, 'imprimante_methode', 'share')
    poser(db, 'imprimante_cible', 'XP-80')
    poser(db, 'imprimante_page_codes', 'cp858')
    expect(lireParametres(db)).toMatchObject({
      tvaDefaut: 0,
      plafondRemiseCaissier: 500,
      peremptionSeuilJours: 7,
      dormantJours: 90,
      imprimanteMethode: 'share',
      imprimanteCible: 'XP-80',
      imprimantePageCodes: 'cp858'
    })
  })

  it('un plafond de 0 F reste 0 (aucune remise sans gérant), pas « non renseigné »', () => {
    const db = baseDeTest()
    poser(db, 'plafond_remise_caissier', '0')
    expect(lireParametres(db).plafondRemiseCaissier).toBe(0)
  })

  it('revient au défaut pour une valeur vide ou illisible', () => {
    const db = baseDeTest()
    poser(db, 'boutique_nom', '   ')
    poser(db, 'ticket_pied', '')
    poser(db, 'boutique_nif', null)
    poser(db, 'tva_defaut', '7')
    poser(db, 'plafond_remise_caissier', '1 000,5')
    poser(db, 'peremption_seuil_jours', '0')
    poser(db, 'dormant_jours', 'soixante')
    poser(db, 'imprimante_methode', 'usb')
    expect(lireParametres(db)).toMatchObject({
      boutiqueNom: null,
      boutiqueNif: null,
      ticketPied: 'Merci de votre visite !',
      tvaDefaut: 18,
      plafondRemiseCaissier: null,
      peremptionSeuilJours: 15,
      dormantJours: 60,
      imprimanteMethode: 'spooler'
    })
  })
})
