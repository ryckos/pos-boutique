import { describe, expect, it } from 'vitest'
import type { UtilisateurConnecte } from '../src/shared/types'
import { ecrireParametres, lireParametres } from '../src/main/modules/parametres/service'
import { executer, toutes } from '../src/main/db/requetes'
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

const PATRON: UtilisateurConnecte = { id: 1, nom: 'Patron', role: 'admin' }
const AFI: UtilisateurConnecte = { id: 2, nom: 'Afi', role: 'caissier' }
const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

function journal(db: Db): Array<{ auteur: number; cle: string; avant: string; apres: string }> {
  return toutes(
    db,
    `SELECT utilisateur_id AS auteur, entite AS cle, ancienne_valeur AS avant, nouvelle_valeur AS apres
     FROM journal_audit WHERE action = 'modification_parametre' ORDER BY id`
  )
}

describe('Écriture des paramètres', () => {
  it('enregistre, renvoie les paramètres à jour et ne touche pas aux autres', () => {
    const db = baseAvecDemo()
    const p = ecrireParametres(db, PATRON, {
      boutiqueNom: '  Supérette Afia  ',
      boutiqueNif: '1000123456',
      tvaDefaut: 0,
      plafondRemiseCaissier: 500,
      peremptionSeuilJours: 10
    })
    expect(p).toMatchObject({
      boutiqueNom: 'Supérette Afia',
      boutiqueAdresse: 'Lomé, Togo',
      boutiqueNif: '1000123456',
      tvaDefaut: 0,
      plafondRemiseCaissier: 500,
      peremptionSeuilJours: 10,
      dormantJours: 60
    })
    expect(lireParametres(db)).toEqual(p)
  })

  it('journalise chaque paramètre réellement changé, avec avant et après', () => {
    const db = baseAvecDemo()
    ecrireParametres(db, PATRON, {
      boutiqueNom: 'Supérette Afia',
      boutiqueAdresse: 'Lomé, Togo',
      tvaDefaut: 0
    })
    expect(journal(db)).toEqual([
      { auteur: 1, cle: 'boutique_nom', avant: '"MA BOUTIQUE"', apres: '"Supérette Afia"' },
      { auteur: 1, cle: 'tva_defaut', avant: '18', apres: '0' }
    ])
  })

  it('ne journalise rien si rien ne change (pied effacé alors qu’il est déjà par défaut)', () => {
    const db = baseAvecDemo()
    ecrireParametres(db, PATRON, { ticketPied: '', dormantJours: 60 })
    expect(journal(db)).toEqual([])
    expect(lireParametres(db).ticketPied).toBe('Merci de votre visite !')
  })

  it('efface une valeur avec null : le plafond redevient « non renseigné »', () => {
    const db = baseAvecDemo()
    ecrireParametres(db, PATRON, { plafondRemiseCaissier: 1000 })
    expect(ecrireParametres(db, PATRON, { plafondRemiseCaissier: null }).plafondRemiseCaissier).toBeNull()
  })

  it.each([
    [{ tvaDefaut: 7 }, 'TVA par défaut'],
    [{ peremptionSeuilJours: 0 }, 'au moins 1'],
    [{ dormantJours: 12.5 }, 'au moins 1'],
    [{ plafondRemiseCaissier: -100 }, 'sans décimales'],
    [{ plafondRemiseCaissier: 99.5 }, 'sans décimales'],
    [{ boutiqueNom: '   ' }, 'nom de la boutique'],
    [{ imprimanteMethode: 'usb' }, 'Méthode'],
    [{ boutiqueAdresse: 42 }, 'invalide'],
    [{ couleur: 'rouge' }, 'inconnu']
  ])('refuse %o', (modifs, message) => {
    expect(() => ecrireParametres(baseAvecDemo(), PATRON, modifs as never)).toThrow(message)
  })

  it('tout ou rien : une valeur refusée et rien n’est écrit', () => {
    const db = baseAvecDemo()
    expect(() => ecrireParametres(db, PATRON, { boutiqueNom: 'Supérette Afia', tvaDefaut: 7 })).toThrow()
    expect(lireParametres(db).boutiqueNom).toBe('MA BOUTIQUE')
    expect(journal(db)).toEqual([])
  })

  it('le gérant règle l’imprimante, mais pas le reste', () => {
    const db = baseAvecDemo()
    expect(
      ecrireParametres(db, KOSSI, {
        imprimanteMethode: 'share',
        imprimanteCible: 'XP-80',
        imprimantePageCodes: 'cp858'
      })
    ).toMatchObject({ imprimanteMethode: 'share', imprimanteCible: 'XP-80', imprimantePageCodes: 'cp858' })
    expect(() =>
      ecrireParametres(db, KOSSI, { imprimanteCible: 'XP-80', ticketPied: 'Bonne journée' })
    ).toThrow('Seul l’administrateur')
    expect(lireParametres(db).ticketPied).toBe('Merci de votre visite !')
  })

  it('la caissière ne modifie rien, pas même l’imprimante', () => {
    expect(() => ecrireParametres(baseAvecDemo(), AFI, { imprimanteCible: 'XP-80' })).toThrow(
      'Seul l’administrateur'
    )
  })
})
