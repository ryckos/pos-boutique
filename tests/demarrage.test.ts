import { describe, expect, it } from 'vitest'
import { reglageDemarrage } from '../src/shared/demarrage'
import { fermerApplication } from '../src/main/modules/auth/service'
import { ecrireParametres, lireParametres } from '../src/main/modules/parametres/service'
import { une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

const PATRON = { id: 1, nom: 'Patron', role: 'admin' as const }
const AFI = { id: 2, nom: 'Afi', role: 'caissier' as const }
const KOSSI = { id: 3, nom: 'Kossi', role: 'gerant' as const }

function compter(db: Db, action: string): number {
  return une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM journal_audit WHERE action = ?', action)!.n
}

describe('Démarrage avec Windows (B-P5)', () => {
  it('suit le paramètre sur l’application installée', () => {
    expect(reglageDemarrage({ installee: true, baseEssai: false, parametre: true })).toBe(true)
    expect(reglageDemarrage({ installee: true, baseEssai: false, parametre: false })).toBe(false)
  })

  it('ne touche à rien en développement ni sur une base d’essai (POS_DB)', () => {
    expect(reglageDemarrage({ installee: false, baseEssai: false, parametre: true })).toBeNull()
    expect(reglageDemarrage({ installee: true, baseEssai: true, parametre: false })).toBeNull()
  })

  it('est activé par défaut ; l’admin l’arrête et le relance, chaque fois journalisé', () => {
    const db = baseAvecDemo()
    expect(lireParametres(db).demarrageAutomatique).toBe(true)
    expect(ecrireParametres(db, PATRON, { demarrageAutomatique: false }).demarrageAutomatique).toBe(false)
    expect(ecrireParametres(db, PATRON, { demarrageAutomatique: true }).demarrageAutomatique).toBe(true)
    expect(compter(db, 'modification_parametre')).toBe(2)
  })

  it('refuse le gérant et une valeur qui n’est pas oui / non', () => {
    const db = baseAvecDemo()
    expect(() => ecrireParametres(db, KOSSI, { demarrageAutomatique: false })).toThrow('Seul l’administrateur')
    expect(() => ecrireParametres(db, PATRON, { demarrageAutomatique: 'non' as never })).toThrow('invalide')
    expect(lireParametres(db).demarrageAutomatique).toBe(true)
  })
})

describe('Quitter l’application (B-P5)', () => {
  it('le gérant et l’admin ferment l’application, journalisé', () => {
    const db = baseAvecDemo()
    fermerApplication(db, KOSSI)
    fermerApplication(db, PATRON)
    expect(compter(db, 'fermeture_application')).toBe(2)
  })

  it('la caissière ne la ferme pas, et rien n’est journalisé', () => {
    const db = baseAvecDemo()
    expect(() => fermerApplication(db, AFI)).toThrow('Seul un gérant')
    expect(compter(db, 'fermeture_application')).toBe(0)
  })
})
