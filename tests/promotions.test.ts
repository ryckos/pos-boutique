import { describe, expect, it } from 'vitest'
import type { Db } from '../src/main/db/connexion'
import { executer, toutes, une } from '../src/main/db/requetes'
import { rechercherParCode } from '../src/main/modules/catalogue/service'
import {
  arreterPromotion,
  creerPromotion,
  listerPromotions,
  meilleurePromotion,
  modifierPromotion,
  promotionsDuJour
} from '../src/main/modules/promotions/service'
import { formaterFCFA } from '../src/shared/format'
import type { SaisiePromotion } from '../src/shared/ipc/promotions'
import { libelleRegle, mentionPromotion, prixPromotionnel } from '../src/shared/promotions'
import type { UtilisateurConnecte } from '../src/shared/types'
import { baseAvecDemo } from './aide'

const KOSSI: UtilisateurConnecte = { id: 3, nom: 'Kossi', role: 'gerant' }

// Tomate : unité 350 F, lot de 3 à 1 000 F, carton de 24 à 7 500 F.
const UNITE = '6181000000042'
const produitTomate = (db: Db): number => rechercherParCode(db, UNITE)!.produitId

const jourDecale = (db: Db, jours: number): string =>
  une<{ j: string }>(db, `SELECT date('now','localtime','${jours >= 0 ? '+' : ''}${jours} day') AS j`)!.j

function saisie(db: Db, s: Partial<SaisiePromotion> = {}): SaisiePromotion {
  return {
    nom: 'Tomate −20 %',
    type: 'remise_pourcent',
    valeur: 20,
    produitId: produitTomate(db),
    dateDebut: jourDecale(db, 0),
    dateFin: jourDecale(db, 7),
    ...s
  }
}

/** Prix de la tomate sous promotion : [unité, lot de 3, carton de 24]. */
function prixTomate(db: Db): (number | null)[] {
  const p = produitTomate(db)
  return [
    [1, 350],
    [3, 1000],
    [24, 7500]
  ].map(([qb, prix]) => meilleurePromotion(db, p, qb, prix)?.prix ?? null)
}

const troisPrix = (r: Parameters<typeof prixPromotionnel>[0]): (number | null)[] => [
  prixPromotionnel(r, 350, 1),
  prixPromotionnel(r, 1000, 3),
  prixPromotionnel(r, 7500, 24)
]

describe('Prix promotionnel (A16, calcul partagé)', () => {
  it('pourcentage −20 % : 350 → 280, lot de 3 → 800, carton → 6 000', () => {
    expect(troisPrix({ type: 'remise_pourcent', valeur: 20 })).toEqual([280, 800, 6000])
  })

  it('remise en francs : −50 F par unité de base, multipliée par la quantité du conditionnement', () => {
    expect(troisPrix({ type: 'remise_montant', valeur: 50 })).toEqual([300, 850, 6300])
  })

  it('prix fixe : 300 F par unité de base → 300 / 900 / 7 200', () => {
    expect(troisPrix({ type: 'prix_fixe', valeur: 300 })).toEqual([300, 900, 7200])
  })

  it('une promotion ne fait jamais monter un prix : prix fixe 400 F sans effet partout', () => {
    expect(troisPrix({ type: 'prix_fixe', valeur: 400 })).toEqual([null, null, null])
  })

  it('une remise qui viderait le prix est sans effet (jamais un article gratuit par erreur)', () => {
    expect(prixPromotionnel({ type: 'remise_montant', valeur: 350 }, 350, 1)).toBeNull()
    expect(prixPromotionnel({ type: 'remise_montant', valeur: 400 }, 350, 1)).toBeNull()
  })

  it('arrondi au franc le plus proche, 0,5 vers le haut : 15 % de 350 → 298 ; 10 % de 355 → 320', () => {
    expect(prixPromotionnel({ type: 'remise_pourcent', valeur: 15 }, 350, 1)).toBe(298)
    expect(prixPromotionnel({ type: 'remise_pourcent', valeur: 10 }, 355, 1)).toBe(320)
    expect(prixPromotionnel({ type: 'remise_pourcent', valeur: 33 }, 100, 1)).toBe(67)
  })

  it('textes de la règle et du ticket', () => {
    expect(libelleRegle({ type: 'remise_pourcent', valeur: 20 }, formaterFCFA)).toBe('−20 %')
    expect(libelleRegle({ type: 'remise_montant', valeur: 50 }, formaterFCFA)).toBe(
      `−${formaterFCFA(50)} par unité`
    )
    expect(libelleRegle({ type: 'prix_fixe', valeur: 300 }, formaterFCFA)).toBe(
      `${formaterFCFA(300)} par unité`
    )
    expect(mentionPromotion('Tomate −20 %', 350, formaterFCFA)).toBe(
      `Promo Tomate −20 % (au lieu de ${formaterFCFA(350)})`
    )
  })
})

describe('Création et contrôles (A16)', () => {
  it('crée une promotion et la journalise', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    expect(id).toBeGreaterThan(0)
    const entree = une<{ utilisateur_id: number }>(
      db,
      "SELECT utilisateur_id FROM journal_audit WHERE action = 'creation_promotion'"
    )!
    expect(entree.utilisateur_id).toBe(KOSSI.id)
    expect(listerPromotions(db)).toMatchObject([
      { id, nom: 'Tomate −20 %', type: 'remise_pourcent', valeur: 20, etat: 'en_cours' }
    ])
  })

  it.each([
    ['un nom vide', { nom: '   ' }, /nom/],
    ['un pourcentage de 100', { valeur: 100 }, /1 à 99/],
    ['une valeur nulle', { valeur: 0 }, /entier positif/],
    ['une valeur à virgule', { valeur: 12.5 }, /entier positif/],
    ['aucune cible', { produitId: null, categorieId: null }, /produit ou un rayon/],
    ['deux cibles', { categorieId: 1 }, /produit ou un rayon/],
    ['un produit inconnu', { produitId: 99999 }, /n’existe plus/],
    ['une date invalide', { dateFin: '2026-02-31' }, /invalides/]
  ])('refuse %s', (_cas, changement, message) => {
    const db = baseAvecDemo()
    expect(() => creerPromotion(db, KOSSI, saisie(db, changement as Partial<SaisiePromotion>))).toThrow(
      message
    )
  })

  it('refuse une fin avant le début, une fin passée et un début dans le passé', () => {
    const db = baseAvecDemo()
    expect(() =>
      creerPromotion(db, KOSSI, saisie(db, { dateDebut: jourDecale(db, 5), dateFin: jourDecale(db, 2) }))
    ).toThrow(/précéder/)
    expect(() =>
      creerPromotion(db, KOSSI, saisie(db, { dateDebut: jourDecale(db, -5), dateFin: jourDecale(db, -2) }))
    ).toThrow(/déjà passée/)
    expect(() => creerPromotion(db, KOSSI, saisie(db, { dateDebut: jourDecale(db, -1) }))).toThrow(
      /dans le passé/
    )
  })

  it('la base refuse une promotion à deux cibles ou sans cible, et sa suppression', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    expect(() => executer(db, 'UPDATE promotions SET categorie_id = 1 WHERE id = ?', id)).toThrow(
      /pas les deux/
    )
    expect(() => executer(db, 'DELETE FROM promotions WHERE id = ?', id)).toThrow(/ne se supprime pas/)
  })
})

describe('Dates et choix de la promotion (A16)', () => {
  it('commence le jour du début et finit le soir du dernier jour (bornes incluses)', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(
      db,
      KOSSI,
      saisie(db, { dateDebut: jourDecale(db, 2), dateFin: jourDecale(db, 4) })
    )
    expect(prixTomate(db)).toEqual([null, null, null]) // veille du début
    expect(listerPromotions(db)[0].etat).toBe('a_venir')

    const dates = 'UPDATE promotions SET date_debut = ?, date_fin = ? WHERE id = ?'
    executer(db, dates, jourDecale(db, 0), jourDecale(db, 3), id)
    expect(prixTomate(db)).toEqual([280, 800, 6000]) // premier jour

    executer(db, dates, jourDecale(db, -3), jourDecale(db, 0), id)
    expect(prixTomate(db)).toEqual([280, 800, 6000]) // dernier jour

    executer(db, 'UPDATE promotions SET date_fin = ? WHERE id = ?', jourDecale(db, -1), id)
    expect(prixTomate(db)).toEqual([null, null, null]) // lendemain
    expect(listerPromotions(db)[0].etat).toBe('terminee')
  })

  it('plusieurs promotions : la plus avantageuse seule, jamais de cumul', () => {
    const db = baseAvecDemo()
    creerPromotion(db, KOSSI, saisie(db)) // −20 % : 280 / 800 / 6 000
    creerPromotion(db, KOSSI, saisie(db, { nom: '−50 F', type: 'remise_montant', valeur: 50 })) // 300 / 850 / 6 300
    expect(prixTomate(db)).toEqual([280, 800, 6000])
    creerPromotion(db, KOSSI, saisie(db, { nom: 'Prix choc', type: 'prix_fixe', valeur: 250 })) // 250 / 750 / 6 000
    // À 6 000 F le carton, le prix choc (le plus récent) l'emporte à égalité.
    expect(prixTomate(db)).toEqual([250, 750, 6000])
    expect(meilleurePromotion(db, produitTomate(db), 24, 7500)?.nom).toBe('Prix choc')
  })

  it('une promotion sur un rayon couvre ses sous-rayons ; un autre rayon est sans effet', () => {
    const db = baseAvecDemo()
    const alimentation = executer(db, "INSERT INTO categories (nom) VALUES ('Alimentation test')").id
    const conserves = executer(
      db,
      'INSERT INTO categories (nom, parent_id) VALUES (?, ?)',
      'Conserves test',
      alimentation
    ).id
    const boissons = executer(db, "INSERT INTO categories (nom) VALUES ('Boissons test')").id
    executer(db, 'UPDATE produits SET categorie_id = ? WHERE id = ?', conserves, produitTomate(db))

    creerPromotion(db, KOSSI, saisie(db, { nom: 'Boissons', produitId: null, categorieId: boissons }))
    expect(prixTomate(db)).toEqual([null, null, null])
    creerPromotion(db, KOSSI, saisie(db, { nom: 'Alimentation', produitId: null, categorieId: alimentation }))
    expect(prixTomate(db)).toEqual([280, 800, 6000])

    const duJour = promotionsDuJour(db)
    expect(duJour.find((p) => p.nom === 'Alimentation')?.produitIds).toContain(produitTomate(db))
    expect(duJour.find((p) => p.nom === 'Boissons')?.produitIds).toEqual([])
  })

  it('promotionsDuJour : ni les promotions à venir, ni les arrêtées', () => {
    const db = baseAvecDemo()
    creerPromotion(db, KOSSI, saisie(db, { nom: 'Demain', dateDebut: jourDecale(db, 1) }))
    const { id } = creerPromotion(db, KOSSI, saisie(db, { nom: 'Arrêtée' }))
    creerPromotion(db, KOSSI, saisie(db, { nom: 'En cours' }))
    arreterPromotion(db, KOSSI, id)
    expect(promotionsDuJour(db).map((p) => p.nom)).toEqual(['En cours'])
  })
})

describe('Modification et arrêt (A16)', () => {
  it('arrêter : plus d’effet, journal, jamais supprimée, ni deux fois', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    arreterPromotion(db, KOSSI, id)
    expect(prixTomate(db)).toEqual([null, null, null])
    expect(listerPromotions(db)[0].etat).toBe('arretee')
    expect(une(db, "SELECT 1 AS x FROM journal_audit WHERE action = 'arret_promotion'")).toBeDefined()
    expect(() => arreterPromotion(db, KOSSI, id)).toThrow(/déjà arrêtée/)
    expect(() => modifierPromotion(db, KOSSI, id, saisie(db))).toThrow(/arrêtée/)
  })

  it('modifier : nouvelle règle appliquée tout de suite, ancien et nouveau dans le journal', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    modifierPromotion(db, KOSSI, id, saisie(db, { nom: 'Tomate −30 %', valeur: 30 }))
    expect(prixTomate(db)).toEqual([245, 700, 5250])
    const entree = une<{ avant: string; apres: string }>(
      db,
      "SELECT ancienne_valeur AS avant, nouvelle_valeur AS apres FROM journal_audit WHERE action = 'modification_promotion'"
    )!
    expect(JSON.parse(entree.avant)).toMatchObject({ nom: 'Tomate −20 %', regle: '−20 %' })
    expect(JSON.parse(entree.apres)).toMatchObject({ nom: 'Tomate −30 %', regle: '−30 %' })
  })

  it('modifier une promotion commencée : le début d’il y a deux jours est gardé, mais ne se recule pas', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    executer(db, 'UPDATE promotions SET date_debut = ? WHERE id = ?', jourDecale(db, -2), id)
    modifierPromotion(
      db,
      KOSSI,
      id,
      saisie(db, { dateDebut: jourDecale(db, -2), dateFin: jourDecale(db, 10) })
    )
    expect(() =>
      modifierPromotion(
        db,
        KOSSI,
        id,
        saisie(db, { dateDebut: jourDecale(db, -5), dateFin: jourDecale(db, 10) })
      )
    ).toThrow(/dans le passé/)
  })

  it('une promotion terminée ne se modifie plus et ne s’arrête plus', () => {
    const db = baseAvecDemo()
    const { id } = creerPromotion(db, KOSSI, saisie(db))
    executer(
      db,
      'UPDATE promotions SET date_debut = ?, date_fin = ? WHERE id = ?',
      jourDecale(db, -9),
      jourDecale(db, -1),
      id
    )
    expect(() => modifierPromotion(db, KOSSI, id, saisie(db))).toThrow(/terminée/)
    expect(() => arreterPromotion(db, KOSSI, id)).toThrow(/déjà terminée/)
    expect(toutes(db, 'SELECT id FROM promotions')).toHaveLength(1)
  })
})
