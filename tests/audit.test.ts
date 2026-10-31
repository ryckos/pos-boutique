import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { choixJournal, lireJournal, TAILLE_PAGE_JOURNAL } from '../src/main/modules/audit/service'
import { journaliser } from '../src/main/core/audit'
import { ecrireParametres } from '../src/main/modules/parametres/service'
import { annulerDepense, enregistrerDepense } from '../src/main/modules/depenses/service'
import { LIBELLES_ACTION, detailsAudit, libelleAction } from '../src/shared/audit'
import { une } from '../src/main/db/requetes'
import type { Db } from '../src/main/db/connexion'
import { baseAvecDemo } from './aide'

// Démo : Patron = 1 (admin), Afi = 2 (caissière), Kossi = 3 (gérant).
const PATRON = { id: 1, nom: 'Patron', role: 'admin' as const }
const AFI = 2
const KOSSI = 3
const GERANT = { id: KOSSI, nom: 'Kossi', role: 'gerant' as const }

function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}
function decaler(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10)
}
const nomDe = (id: number): string => ({ 1: 'Patron', 3: 'Kossi' })[id] ?? 'Compte inconnu'

describe('Journal : mise en mots (règle pure)', () => {
  it('toutes les actions du code ont un libellé français', () => {
    // Lues dans le code du principal : une action ajoutée sans libellé fait échouer ce test.
    const dossier = join(__dirname, '../src/main')
    const actions = new Set<string>()
    for (const f of readdirSync(dossier, { recursive: true, encoding: 'utf8' })) {
      if (!f.endsWith('.ts')) continue
      for (const m of readFileSync(join(dossier, f), 'utf8').matchAll(/action: '([a-z_]+)'/g))
        actions.add(m[1])
    }
    expect(actions.size).toBeGreaterThan(30)
    expect([...actions].filter((a) => !(a in LIBELLES_ACTION))).toEqual([])
    expect(libelleAction('annulation_depense')).toBe('Annulation d’une dépense')
  })

  it('clients et crédit : plafond en F, échéance en date, client en clair', () => {
    const p = detailsAudit(
      {
        action: 'plafond_credit',
        entite: 'clients',
        avant: { client: 'Ama', plafond: 0 },
        apres: { client: 'Ama', plafond: 20000 }
      },
      nomDe
    )
    expect(libelleAction('plafond_credit')).toBe('Changement du plafond de crédit')
    expect(p.apres).toEqual([
      { libelle: 'Client', valeur: 'Ama' },
      { libelle: 'Plafond de crédit', valeur: `${(20000).toLocaleString('fr-FR')} F` }
    ])
    const v = detailsAudit(
      {
        action: 'vente_credit',
        entite: 'ventes',
        avant: null,
        apres: { numeroTicket: 'T-2026-000201', client: 'Ama', montant: 4500, echeance: '2026-11-30' }
      },
      nomDe
    )
    expect(v.apres).toEqual([
      { libelle: 'Ticket', valeur: 'T-2026-000201' },
      { libelle: 'Client', valeur: 'Ama' },
      { libelle: 'Montant', valeur: `${(4500).toLocaleString('fr-FR')} F` },
      { libelle: 'Échéance', valeur: '30/11/2026' }
    ])
  })

  it('mouvement du tiroir : sens et motif en clair, motif libre laissé tel quel', () => {
    const m = detailsAudit(
      {
        action: 'annulation_mouvement_caisse',
        entite: 'mouvements_caisse',
        avant: { session: 4, sens: 'sortie', motif: 'depense', montant: 1000 },
        apres: { contreMouvement: 12, motif: 'Saisie en double' }
      },
      nomDe
    )
    expect(m.avant.map((d) => d.valeur)).toEqual([
      '4',
      'Sortie du tiroir',
      'Dépense',
      `${(1000).toLocaleString('fr-FR')} F`
    ])
    expect(m.apres).toEqual([
      { libelle: 'Contre-mouvement n°', valeur: '12' },
      { libelle: 'Motif', valeur: 'Saisie en double' }
    ])
  })

  it('une action inconnue reste lisible, sans tiret bas', () => {
    expect(libelleAction('fusion_clients')).toBe('Fusion clients')
  })

  it('montants en F, quantités, rôles, oui / non, identifiants remplacés par le nom', () => {
    const d = detailsAudit(
      {
        action: 'remise',
        entite: 'ventes',
        avant: null,
        apres: { numeroTicket: 'T-2026-000158', portee: 'ticket', montant: 1500, autoriseeParId: 3 }
      },
      nomDe
    )
    expect(d.avant).toEqual([])
    expect(d.apres).toEqual([
      { libelle: 'Ticket', valeur: 'T-2026-000158' },
      { libelle: 'Portée', valeur: 'Tout le ticket' },
      { libelle: 'Montant', valeur: `${(1500).toLocaleString('fr-FR')} F` },
      { libelle: 'Autorisée par', valeur: 'Kossi' }
    ])
    const r = detailsAudit(
      {
        action: 'modification_role',
        entite: 'utilisateurs',
        avant: { role: 'caissier' },
        apres: { role: 'gerant' }
      },
      nomDe
    )
    expect(r.avant[0].valeur).toBe('Caissier')
    expect(r.apres[0].valeur).toBe('Gérant')
    const v = detailsAudit(
      {
        action: 'echec_connexion_verrouillage',
        entite: 'utilisateurs',
        avant: null,
        apres: { verrouillage: 2, delaiSecondes: 60 }
      },
      nomDe
    )
    expect(v.apres).toEqual([
      { libelle: 'Verrouillage n°', valeur: '2' },
      { libelle: 'Délai', valeur: '1 min' }
    ])
  })

  it('un paramètre : son nom en clair, avant et après', () => {
    const d = detailsAudit(
      { action: 'modification_parametre', entite: 'dormant_jours', avant: 60, apres: 45 },
      nomDe
    )
    expect(d.avant).toEqual([{ libelle: 'Produit dormant après', valeur: '60 jours' }])
    expect(d.apres).toEqual([{ libelle: 'Produit dormant après', valeur: '45 jours' }])
    expect(
      detailsAudit(
        { action: 'modification_parametre', entite: 'plafond_remise_caissier', avant: null, apres: 2000 },
        nomDe
      ).avant[0].valeur
    ).toBe('Non défini (gérant obligatoire)')
  })

  it('jamais d’accolade ni de nom de champ technique, même pour un champ inconnu', () => {
    const d = detailsAudit(
      {
        action: 'import_catalogue',
        entite: 'produits',
        avant: null,
        apres: { nouvellesCategories: ['Épicerie', 'Hygiène'], stockApres: { lot: 'A12' } }
      },
      nomDe
    )
    expect(d.apres).toEqual([
      { libelle: 'Nouveaux rayons', valeur: 'Épicerie, Hygiène' },
      { libelle: 'Stock apres', valeur: 'Lot : A12' }
    ])
  })
})

describe('Journal : lecture (admin)', () => {
  it('les plus récentes d’abord, avec le nom de la personne et le détail lisible', () => {
    const db = baseAvecDemo()
    const categorieId = une<{ id: number }>(
      db,
      "SELECT id FROM categories_depense WHERE nom = 'Transport'"
    )!.id
    const d = enregistrerDepense(db, GERANT, {
      categorieId,
      libelle: 'Taxi-moto',
      montant: 1000,
      source: 'fonds_propres'
    })
    annulerDepense(db, KOSSI, d.id, 'doublon')
    ecrireParametres(db, PATRON, { dormantJours: 45 })
    const j = lireJournal(db, {})
    expect(j.entrees[0]).toMatchObject({ utilisateur: 'Patron', libelle: 'Modification d’un paramètre' })
    expect(j.entrees[1]).toMatchObject({ utilisateur: 'Kossi', action: 'annulation_depense' })
    expect(j.entrees[1].avant).toContainEqual({
      libelle: 'Montant',
      valeur: `${(1000).toLocaleString('fr-FR')} F`
    })
    expect(j.entrees[1].avant).toContainEqual({ libelle: 'Payée par', valeur: 'Fonds propres' })
    expect(j.entrees[1].apres).toEqual([{ libelle: 'Motif', valeur: 'doublon' }])
    expect(j.suite).toBe(false)
  })

  it('7 derniers jours par défaut ; filtres par personne et par action', () => {
    const db = baseAvecDemo()
    journaliser(db, { utilisateurId: AFI, action: 'connexion' })
    journaliser(db, { utilisateurId: KOSSI, action: 'connexion' })
    journaliser(db, { utilisateurId: KOSSI, action: 'ouverture_tiroir_hors_vente' })
    const jour = aujourdhui(db)
    const j = lireJournal(db, {})
    expect(j).toMatchObject({ du: decaler(jour, -6), au: jour })
    expect(lireJournal(db, { utilisateurId: KOSSI }).entrees.map((e) => e.action)).toEqual([
      'ouverture_tiroir_hors_vente',
      'connexion'
    ])
    expect(lireJournal(db, { action: 'connexion' }).entrees.map((e) => e.utilisateur)).toEqual([
      'Kossi',
      'Afi'
    ])
    const hier = decaler(jour, -1)
    expect(lireJournal(db, { du: hier, au: hier }).entrees).toEqual([])
  })

  it('refuse une fin dans le futur ou un début après la fin', () => {
    const db = baseAvecDemo()
    const jour = aujourdhui(db)
    expect(() => lireJournal(db, { au: decaler(jour, 1) })).toThrow(/futur/)
    expect(() => lireJournal(db, { du: jour, au: decaler(jour, -1) })).toThrow(/précéder/)
  })

  it('200 par page, puis « Afficher plus » à partir de la dernière entrée lue', () => {
    const db = baseAvecDemo()
    const avant = lireJournal(db, {}).entrees.length
    for (let i = 0; i < TAILLE_PAGE_JOURNAL + 5; i++)
      journaliser(db, { utilisateurId: AFI, action: 'connexion' })
    const p1 = lireJournal(db, {})
    expect(p1.entrees).toHaveLength(TAILLE_PAGE_JOURNAL)
    expect(p1.suite).toBe(true)
    const p2 = lireJournal(db, { avantId: p1.entrees.at(-1)!.id })
    expect(p2.entrees).toHaveLength(5 + avant)
    expect(p2.suite).toBe(false)
  })

  it('choix : tous les comptes, et seulement les actions présentes, par libellé', () => {
    const db = baseAvecDemo()
    journaliser(db, { utilisateurId: KOSSI, action: 'ouverture_tiroir_hors_vente' })
    journaliser(db, { utilisateurId: KOSSI, action: 'connexion' })
    const c = choixJournal(db)
    expect(c.utilisateurs.map((u) => u.nom)).toEqual(['Afi', 'Kossi', 'Patron'])
    const libelles = c.actions.map((a) => a.libelle)
    expect(libelles).toContain('Connexion')
    expect(libelles).toContain('Ouverture du tiroir hors vente')
    expect(libelles).toEqual([...libelles].sort((a, b) => a.localeCompare(b, 'fr')))
  })
})
