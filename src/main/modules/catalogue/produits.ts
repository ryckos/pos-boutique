/**
 * Fiche produit et conditionnements. Propriétaire : Dev B.
 * Règles : REGLES_METIER § 2.1 à 2.3 — « Unité » ×1 obligatoire et figée, prix libres, codes
 * uniques toutes colonnes confondues, quantité d'un conditionnement existant non modifiable,
 * changements de prix journalisés, désactivation plutôt que suppression.
 */
import {
  alertesPrix,
  codeInterne,
  FORMAT_CODE_BARRES,
  FORMAT_CODE_PLU,
  type AlertePrix
} from '@shared/catalogue'
import type {
  FicheProduit,
  LigneProduit,
  SaisieConditionnement,
  SaisieProduit,
  SaisieUnite,
  UniteBase
} from '@shared/ipc/catalogue'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { stockProduit } from '../../core/mouvements'

const UNITES: UniteBase[] = ['piece', 'kg', 'g', 'litre', 'ml', 'paquet']
const NOM_UNITE = 'Unité'
/** Compteur des codes internes dans `sequences` (sans année : un code ne se réutilise jamais). */
const SEQUENCE_CODES = 'EAN-20'

// ─── Contrôle de la saisie ────────────────────────────────────────────────────

const texte = (v: string): string => v.trim().replace(/\s+/g, ' ')
const code = (v: string | null): string | null => (v === null || v.trim() === '' ? null : v.trim())

function exigerPrix(prix: number, quoi: string): number {
  if (!Number.isInteger(prix) || prix < 0) {
    throw new ErreurMetier(`Prix de « ${quoi} » : saisissez un montant en francs, sans virgule`)
  }
  return prix
}

function exigerCodes<T extends SaisieUnite>(c: T, quoi: string): T {
  const codeBarres = code(c.codeBarres)
  const codePlu = code(c.codePlu)
  if (codeBarres !== null && !FORMAT_CODE_BARRES.test(codeBarres)) {
    throw new ErreurMetier(`Code-barres de « ${quoi} » : de 8 à 14 chiffres, sans espace ni lettre`)
  }
  if (codePlu !== null && !FORMAT_CODE_PLU.test(codePlu)) {
    throw new ErreurMetier(`Code PLU de « ${quoi} » : de 1 à 5 chiffres`)
  }
  const ordre = Number.isInteger(c.ordreBouton) && c.ordreBouton >= 0 ? c.ordreBouton : 0
  return { ...c, codeBarres, codePlu, ordreBouton: ordre, prixVente: exigerPrix(c.prixVente, quoi) }
}

function exigerSaisie(s: SaisieProduit): SaisieProduit {
  const nom = texte(s.nom)
  if (!nom) throw new ErreurMetier('Le nom du produit est obligatoire')
  if (!UNITES.includes(s.unite)) throw new ErreurMetier('Choisissez l’unité de base du produit')
  if (s.tauxTva !== 18 && s.tauxTva !== 0) throw new ErreurMetier('La TVA est de 18 % ou 0 % (exonéré)')
  if (!Number.isFinite(s.seuilAlerte) || s.seuilAlerte < 0) {
    throw new ErreurMetier('Le seuil d’alerte est un nombre positif ou zéro')
  }
  const conditionnements = s.conditionnements.map((c) => {
    const n = texte(c.nom)
    if (!n) throw new ErreurMetier('Chaque conditionnement doit avoir un nom (ex. « Pack de 6 »)')
    if (n.toLocaleLowerCase('fr') === NOM_UNITE.toLocaleLowerCase('fr')) {
      throw new ErreurMetier('« Unité » est réservé au conditionnement de base : choisissez un autre nom')
    }
    if (!Number.isFinite(c.quantiteBase) || c.quantiteBase <= 0) {
      throw new ErreurMetier(`« ${n} » doit contenir une quantité supérieure à zéro`)
    }
    return exigerCodes({ ...c, nom: n }, n)
  })
  return { ...s, nom, uniteVente: exigerCodes(s.uniteVente, NOM_UNITE), conditionnements }
}

function exigerCategorie(db: Db, categorieId: number | null): void {
  if (categorieId === null) return
  const c = une<{ nom: string; actif: number }>(
    db,
    'SELECT nom, actif FROM categories WHERE id = ?',
    categorieId
  )
  if (!c) throw new ErreurMetier('Catégorie introuvable : rechargez la page')
  if (!c.actif) throw new ErreurMetier(`La catégorie « ${c.nom} » est désactivée : choisissez-en une autre`)
}

/**
 * Un code n'apparaît qu'une fois dans toute la base, code-barres et PLU confondus, conditionnements
 * désactivés compris (la contrainte UNIQUE les couvre aussi) : un scan n'est jamais ambigu.
 */
function exigerCodesLibres(db: Db, saisies: Array<SaisieUnite & { id?: number; nom: string }>): void {
  const vus = new Map<string, string>()
  for (const c of saisies) {
    for (const valeur of [c.codeBarres, c.codePlu]) {
      if (valeur === null) continue
      const deja = vus.get(valeur)
      if (deja !== undefined) {
        throw new ErreurMetier(`Le code ${valeur} est saisi deux fois (« ${deja} » et « ${c.nom} »)`)
      }
      vus.set(valeur, c.nom)
      const autre = une<{ designation: string; actif: number }>(
        db,
        `SELECT p.nom || ' — ' || c.nom AS designation, c.actif * p.actif AS actif
         FROM conditionnements c JOIN produits p ON p.id = c.produit_id
         WHERE (c.code_barres = ? OR c.code_plu = ?) AND c.id IS NOT ?
         LIMIT 1`,
        valeur,
        valeur,
        c.id ?? null
      )
      if (autre) {
        const etat = autre.actif ? '' : ' (désactivé)'
        throw new ErreurMetier(`Le code ${valeur} est déjà celui de « ${autre.designation} »${etat}`)
      }
    }
  }
}

function alertes(s: SaisieProduit): AlertePrix[] {
  return alertesPrix(
    s.uniteVente.prixVente,
    s.conditionnements.filter((c) => c.actif)
  )
}

// ─── Écritures ────────────────────────────────────────────────────────────────

function insererConditionnement(
  db: Db,
  produitId: number,
  c: SaisieUnite & { nom: string; quantiteBase: number; actif: boolean },
  estDefaut: boolean
): void {
  executer(
    db,
    `INSERT INTO conditionnements
       (produit_id, nom, quantite_base, prix_vente, code_barres, code_plu, est_defaut, actif,
        bouton_tactile, ordre_bouton)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    produitId,
    c.nom,
    c.quantiteBase,
    c.prixVente,
    c.codeBarres,
    c.codePlu,
    estDefaut ? 1 : 0,
    c.actif ? 1 : 0,
    c.boutonTactile ? 1 : 0,
    c.ordreBouton
  )
}

export function creerProduit(db: Db, saisie: SaisieProduit): { id: number; alertesPrix: AlertePrix[] } {
  const s = exigerSaisie(saisie)
  return avecTransaction(db, () => {
    exigerCategorie(db, s.categorieId)
    exigerCodesLibres(db, [{ ...s.uniteVente, nom: NOM_UNITE }, ...s.conditionnements])
    const id = executer(
      db,
      `INSERT INTO produits (nom, categorie_id, unite, taux_tva, suivi_peremption, seuil_alerte)
       VALUES (?, ?, ?, ?, ?, ?)`,
      s.nom,
      s.categorieId,
      s.unite,
      s.tauxTva,
      s.suiviPeremption ? 1 : 0,
      s.seuilAlerte
    ).id
    insererConditionnement(db, id, { ...s.uniteVente, nom: NOM_UNITE, quantiteBase: 1, actif: true }, true)
    for (const c of s.conditionnements) insererConditionnement(db, id, c, false)
    return { id, alertesPrix: alertes(s) }
  })
}

interface ConditionnementEnBase {
  id: number
  nom: string
  quantiteBase: number
  prixVente: number
  estDefaut: number
}

/**
 * Enregistre la fiche. Un conditionnement absent de la saisie reste tel quel (on ne supprime
 * jamais) ; pour le retirer de la vente, la saisie le renvoie avec `actif: false`.
 */
export function modifierProduit(
  db: Db,
  utilisateurId: number,
  id: number,
  saisie: SaisieProduit
): { alertesPrix: AlertePrix[] } {
  const s = exigerSaisie(saisie)
  return avecTransaction(db, () => {
    const produit = une<{ nom: string; actif: number }>(
      db,
      'SELECT nom, actif FROM produits WHERE id = ?',
      id
    )
    if (!produit) throw new ErreurMetier('Produit introuvable : rechargez la liste')
    if (!produit.actif) throw new ErreurMetier(`« ${produit.nom} » est désactivé : il ne se modifie plus`)
    exigerCategorie(db, s.categorieId)

    const existants = new Map(
      toutes<ConditionnementEnBase>(
        db,
        `SELECT id, nom, quantite_base AS quantiteBase, prix_vente AS prixVente, est_defaut AS estDefaut
         FROM conditionnements WHERE produit_id = ?`,
        id
      ).map((c) => [c.id, c])
    )
    const unite = [...existants.values()].find((c) => c.estDefaut === 1)
    if (!unite) throw new Error(`Produit ${id} sans conditionnement « Unité »`)
    for (const c of s.conditionnements) {
      if (c.id === undefined) continue
      const avant = existants.get(c.id)
      if (!avant || avant.estDefaut === 1)
        throw new ErreurMetier('Conditionnement introuvable : rechargez la fiche')
      if (avant.quantiteBase !== c.quantiteBase) {
        throw new ErreurMetier(
          `La quantité de « ${avant.nom} » ne se modifie pas : désactivez-le et créez-en un nouveau`
        )
      }
    }
    exigerCodesLibres(db, [{ ...s.uniteVente, id: unite.id, nom: NOM_UNITE }, ...s.conditionnements])

    executer(
      db,
      `UPDATE produits SET nom = ?, categorie_id = ?, unite = ?, taux_tva = ?, suivi_peremption = ?,
         seuil_alerte = ?, modifie_le = datetime('now','localtime')
       WHERE id = ?`,
      s.nom,
      s.categorieId,
      s.unite,
      s.tauxTva,
      s.suiviPeremption ? 1 : 0,
      s.seuilAlerte,
      id
    )

    const miseAJour = (
      avant: ConditionnementEnBase,
      c: SaisieUnite & { nom: string; actif: boolean }
    ): void => {
      executer(
        db,
        `UPDATE conditionnements SET nom = ?, prix_vente = ?, code_barres = ?, code_plu = ?, actif = ?,
           bouton_tactile = ?, ordre_bouton = ?
         WHERE id = ?`,
        c.nom,
        c.prixVente,
        c.codeBarres,
        c.codePlu,
        c.actif ? 1 : 0,
        c.boutonTactile ? 1 : 0,
        c.ordreBouton,
        avant.id
      )
      if (avant.prixVente !== c.prixVente) {
        journaliser(db, {
          utilisateurId,
          action: 'modification_prix',
          entite: 'conditionnements',
          entiteId: avant.id,
          avant: { produit: s.nom, conditionnement: c.nom, prixVente: avant.prixVente },
          apres: { prixVente: c.prixVente }
        })
      }
    }
    // L'Unité garde son nom et reste active tant que le produit l'est.
    miseAJour(unite, { ...s.uniteVente, nom: NOM_UNITE, actif: true })
    for (const c of s.conditionnements) {
      const avant = c.id === undefined ? undefined : existants.get(c.id)
      if (avant) miseAJour(avant, c)
      else insererConditionnement(db, id, c, false)
    }
    return { alertesPrix: alertes(s) }
  })
}

/** Jamais de suppression. Autorisée même avec du stock (noté au journal, l'écran prévient). */
export function desactiverProduit(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = texte(motif)
  if (!m) throw new ErreurMetier('Indiquez le motif de la désactivation')
  avecTransaction(db, () => {
    const produit = une<{ nom: string; actif: number }>(
      db,
      'SELECT nom, actif FROM produits WHERE id = ?',
      id
    )
    if (!produit) throw new ErreurMetier('Produit introuvable : rechargez la liste')
    if (!produit.actif) throw new ErreurMetier(`« ${produit.nom} » est déjà désactivé`)
    executer(db, `UPDATE produits SET actif = 0, modifie_le = datetime('now','localtime') WHERE id = ?`, id)
    journaliser(db, {
      utilisateurId,
      action: 'desactivation_produit',
      entite: 'produits',
      entiteId: id,
      avant: { nom: produit.nom },
      apres: { motif: m, stockRestant: stockProduit(db, id) }
    })
  })
}

/** Prochain code interne à préfixe 20 : `2000000000015`, `2000000000022`… en sautant les codes pris. */
export function genererCodeInterne(db: Db): string {
  return avecTransaction(db, () => {
    for (;;) {
      executer(
        db,
        `INSERT INTO sequences (prefixe, dernier) VALUES (?, 1)
         ON CONFLICT(prefixe) DO UPDATE SET dernier = dernier + 1`,
        SEQUENCE_CODES
      )
      const { dernier } = une<{ dernier: number }>(
        db,
        'SELECT dernier FROM sequences WHERE prefixe = ?',
        SEQUENCE_CODES
      )!
      const c = codeInterne(dernier)
      const pris = une(db, 'SELECT 1 FROM conditionnements WHERE code_barres = ? OR code_plu = ?', c, c)
      if (!pris) return c
    }
  })
}

// ─── Lectures ─────────────────────────────────────────────────────────────────

export function listeProduits(db: Db): LigneProduit[] {
  return toutes<Omit<LigneProduit, 'actif'> & { actif: number }>(
    db,
    `SELECT p.id, p.nom, p.categorie_id AS categorieId,
            CASE WHEN rayon.id IS NULL THEN cat.nom ELSE rayon.nom || ' › ' || cat.nom END AS categorie,
            p.taux_tva AS tauxTva,
            COALESCE((SELECT prix_vente FROM conditionnements WHERE produit_id = p.id AND est_defaut = 1), 0)
              AS prixUnite,
            (SELECT COUNT(*) FROM conditionnements WHERE produit_id = p.id AND actif = 1) AS nbConditionnements,
            (SELECT COALESCE(SUM(quantite), 0) FROM mouvements_stock WHERE produit_id = p.id) AS stockActuel,
            p.actif
     FROM produits p
     LEFT JOIN categories cat ON cat.id = p.categorie_id
     LEFT JOIN categories rayon ON rayon.id = cat.parent_id
     ORDER BY p.actif DESC, p.nom COLLATE NOCASE`
  ).map((l) => ({ ...l, actif: l.actif === 1 }))
}

interface LigneConditionnement {
  id: number
  nom: string
  quantiteBase: number
  prixVente: number
  codeBarres: string | null
  codePlu: string | null
  boutonTactile: number
  ordreBouton: number
  actif: number
  estDefaut: number
}

export function ficheProduit(db: Db, id: number): FicheProduit {
  const p = une<{
    nom: string
    categorieId: number | null
    unite: UniteBase
    tauxTva: number
    suiviPeremption: number
    seuilAlerte: number
    actif: number
  }>(
    db,
    `SELECT nom, categorie_id AS categorieId, unite, taux_tva AS tauxTva, suivi_peremption AS suiviPeremption,
            seuil_alerte AS seuilAlerte, actif
     FROM produits WHERE id = ?`,
    id
  )
  if (!p) throw new ErreurMetier('Produit introuvable : rechargez la liste')
  const lignes = toutes<LigneConditionnement>(
    db,
    `SELECT id, nom, quantite_base AS quantiteBase, prix_vente AS prixVente, code_barres AS codeBarres,
            code_plu AS codePlu, bouton_tactile AS boutonTactile, ordre_bouton AS ordreBouton, actif,
            est_defaut AS estDefaut
     FROM conditionnements WHERE produit_id = ?
     ORDER BY quantite_base, id`,
    id
  )
  const versSaisie = (c: LigneConditionnement): SaisieConditionnement & { id: number } => ({
    id: c.id,
    nom: c.nom,
    quantiteBase: c.quantiteBase,
    prixVente: c.prixVente,
    codeBarres: c.codeBarres,
    codePlu: c.codePlu,
    boutonTactile: c.boutonTactile === 1,
    ordreBouton: c.ordreBouton,
    actif: c.actif === 1
  })
  const unite = lignes.find((c) => c.estDefaut === 1)
  if (!unite) throw new Error(`Produit ${id} sans conditionnement « Unité »`)
  const uniteVente: SaisieUnite = {
    prixVente: unite.prixVente,
    codeBarres: unite.codeBarres,
    codePlu: unite.codePlu,
    boutonTactile: unite.boutonTactile === 1,
    ordreBouton: unite.ordreBouton
  }
  return {
    id,
    nom: p.nom,
    categorieId: p.categorieId,
    unite: p.unite,
    tauxTva: p.tauxTva,
    suiviPeremption: p.suiviPeremption === 1,
    seuilAlerte: p.seuilAlerte,
    actif: p.actif === 1,
    stockActuel: stockProduit(db, id),
    uniteVente,
    conditionnements: lignes.filter((c) => c.estDefaut !== 1).map(versSaisie)
  }
}
