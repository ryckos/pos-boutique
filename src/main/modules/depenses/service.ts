/**
 * Dépenses (tâche B13). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 10) : catégorie active, montant en francs entiers, numéro DEP,
 * date passée acceptée mais jamais future ; correction par annulation avec motif, journalisée.
 * Source « caisse » : sortie d'espèces par `enregistrerMouvementCaisse()` de Dev A (A8), dans la
 * même transaction que la dépense ; annulation par contre-mouvement, tant que la caisse est ouverte.
 */
import type {
  CategorieDepense,
  Depense,
  ListeDepenses,
  SaisieDepense,
  SourceDepense
} from '@shared/ipc/depenses'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { prochainNumero } from '../../core/numerotation'
import { sessionsOuvertes } from '../caisse/service-cloture'
import { annulerMouvementCaisse, enregistrerMouvementCaisse } from '../caisse/service-mouvements'
import { sessionOuverte } from '../caisse/service-session'

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
const SOURCES: SourceDepense[] = ['caisse', 'fonds_propres']
/** Période proposée par défaut dans la liste. */
const JOURS_LISTE = 30

const nettoyer = (v: string | null | undefined): string => (v ?? '').trim().replace(/\s+/g, ' ')

function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}

function dateValide(d: string): boolean {
  return DATE_ISO.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d
}

// ─── Catégories ──────────────────────────────────────────────────────────────

export function listerCategories(db: Db, inclureInactives = false): CategorieDepense[] {
  const lignes = toutes<{ id: number; nom: string; actif: number }>(
    db,
    `SELECT id, nom, actif FROM categories_depense ${inclureInactives ? '' : 'WHERE actif = 1'}`
  )
  // « Autre » en dernier : c'est le choix de repli, pas une catégorie comme les autres.
  const rang = (c: { nom: string; actif: number }): number => (c.actif ? 0 : 2) + (c.nom === 'Autre' ? 1 : 0)
  return lignes
    .sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'))
    .map((c) => ({ id: c.id, nom: c.nom, actif: c.actif === 1 }))
}

export function creerCategorie(db: Db, nom: string): CategorieDepense {
  const n = nettoyer(nom)
  if (!n) throw new ErreurMetier('Indiquez le nom de la catégorie')
  return avecTransaction(db, () => {
    // Le schéma impose un nom unique parmi toutes les catégories, désactivées comprises.
    const cle = n.toLocaleLowerCase('fr')
    const existante = toutes<{ nom: string; actif: number }>(
      db,
      'SELECT nom, actif FROM categories_depense'
    ).find((c) => nettoyer(c.nom).toLocaleLowerCase('fr') === cle)
    if (existante) {
      throw new ErreurMetier(
        existante.actif
          ? `La catégorie « ${existante.nom} » existe déjà`
          : `La catégorie « ${existante.nom} » existe déjà mais est désactivée : choisissez un autre nom`
      )
    }
    const { id } = executer(db, 'INSERT INTO categories_depense (nom) VALUES (?)', n)
    return { id, nom: n, actif: true }
  })
}

export function desactiverCategorie(db: Db, id: number): void {
  avecTransaction(db, () => {
    const c = une<{ actif: number }>(db, 'SELECT actif FROM categories_depense WHERE id = ?', id)
    if (!c) throw new ErreurMetier('Catégorie introuvable : rechargez la liste')
    if (!c.actif) throw new ErreurMetier('Cette catégorie est déjà désactivée')
    const { n } = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM categories_depense WHERE actif = 1')!
    if (n <= 1) throw new ErreurMetier('Gardez au moins une catégorie active')
    executer(
      db,
      "UPDATE categories_depense SET actif = 0, desactive_le = datetime('now','localtime') WHERE id = ?",
      id
    )
  })
}

// ─── Dépenses ────────────────────────────────────────────────────────────────

const SELECT_DEPENSE = `
  SELECT d.id, d.numero, d.date_depense AS date, d.categorie_id AS categorieId, c.nom AS categorie,
         d.libelle, d.montant, d.source, d.reference, u.nom AS utilisateur,
         d.annule_le AS annuleLe, a.nom AS annulePar, d.motif_annulation AS motifAnnulation,
         d.session_caisse_id AS sessionId, cs.nom AS caissier, (s.statut = 'fermee') AS sessionCloturee
  FROM depenses d
  JOIN categories_depense c ON c.id = d.categorie_id
  JOIN utilisateurs u ON u.id = d.utilisateur_id
  LEFT JOIN utilisateurs a ON a.id = d.annule_par
  LEFT JOIN sessions_caisse s ON s.id = d.session_caisse_id
  LEFT JOIN utilisateurs cs ON cs.id = s.utilisateur_id`

type DepenseEnBase = Omit<Depense, 'sessionCloturee'> & { sessionCloturee: number | null }

const versDepense = (d: DepenseEnBase): Depense => ({ ...d, sessionCloturee: d.sessionCloturee === 1 })

function lireDepense(db: Db, id: number): Depense | null {
  const d = une<DepenseEnBase>(db, `${SELECT_DEPENSE} WHERE d.id = ?`, id)
  return d ? versDepense(d) : null
}

function depense(db: Db, id: number): Depense {
  return lireDepense(db, id)!
}

/**
 * Caisse d'une dépense payée au tiroir (validé par Dev B le 2026-10-28) : la caissière paie sur sa
 * propre caisse ouverte ; le gérant sur la caisse choisie, sinon la sienne, sinon la seule ouverte.
 */
function caisseDeLaDepense(db: Db, u: UtilisateurConnecte, sessionId?: number | null): number {
  if (u.role === 'caissier') {
    const s = sessionOuverte(db, u.id)
    if (!s) throw new ErreurMetier('Ouvrez votre caisse avant de payer une dépense au tiroir')
    if (sessionId != null && sessionId !== s.id) {
      throw new ErreurMetier('Vous ne pouvez payer une dépense que depuis votre propre caisse')
    }
    return s.id
  }
  const ouvertes = sessionsOuvertes(db)
  if (sessionId != null) {
    if (!ouvertes.some((s) => s.id === sessionId)) {
      throw new ErreurMetier('Cette caisse est clôturée : choisissez une caisse ouverte')
    }
    return sessionId
  }
  const sienne = ouvertes.find((s) => s.utilisateurId === u.id)
  if (sienne) return sienne.id
  if (ouvertes.length === 1) return ouvertes[0].id
  if (ouvertes.length === 0) {
    throw new ErreurMetier('Aucune caisse n’est ouverte : choisissez « Fonds propres » ou ouvrez la caisse')
  }
  throw new ErreurMetier('Plusieurs caisses sont ouvertes : choisissez celle du tiroir')
}

export function enregistrerDepense(db: Db, u: UtilisateurConnecte, s: SaisieDepense): Depense {
  const libelle = nettoyer(s.libelle)
  if (!libelle) throw new ErreurMetier('Indiquez à quoi correspond la dépense (ex. : taxi-moto)')
  if (!Number.isInteger(s.montant) || s.montant <= 0) {
    throw new ErreurMetier('Le montant est un nombre de francs, sans virgule, supérieur à zéro')
  }
  if (!SOURCES.includes(s.source)) throw new ErreurMetier('Indiquez d’où vient l’argent')
  // La caissière ne dépense que l'argent de son tiroir : le reste regarde le gérant.
  if (u.role === 'caissier' && s.source !== 'caisse') {
    throw new ErreurMetier('Vous ne pouvez enregistrer qu’une dépense payée au tiroir de votre caisse')
  }

  return avecTransaction(db, () => {
    const c = une<{ nom: string; actif: number }>(
      db,
      'SELECT nom, actif FROM categories_depense WHERE id = ?',
      s.categorieId
    )
    if (!c) throw new ErreurMetier('Choisissez la catégorie de la dépense')
    if (!c.actif) throw new ErreurMetier(`La catégorie « ${c.nom} » est désactivée : choisissez-en une autre`)

    const jour = aujourdhui(db)
    const caisse = s.source === 'caisse' ? caisseDeLaDepense(db, u, s.sessionId) : null
    // L'argent du tiroir sort aujourd'hui : une dépense « caisse » est toujours datée du jour.
    const date = caisse !== null ? jour : s.date?.trim() || jour
    if (!dateValide(date)) throw new ErreurMetier('Indiquez la date de la dépense')
    if (date > jour) throw new ErreurMetier('La date de la dépense ne peut pas être dans le futur')

    const numero = prochainNumero(db, 'DEP')
    const { id } = executer(
      db,
      `INSERT INTO depenses (numero, categorie_id, libelle, montant, source, session_caisse_id, reference,
                             utilisateur_id, date_depense)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      numero,
      s.categorieId,
      libelle,
      s.montant,
      s.source,
      caisse,
      nettoyer(s.reference) || null,
      u.id,
      date
    )
    if (caisse !== null) {
      // Même transaction : si le tiroir n'a pas assez d'espèces, la dépense et son numéro disparaissent.
      enregistrerMouvementCaisse(db, {
        sessionId: caisse,
        utilisateurId: u.id,
        sens: 'sortie',
        motif: 'depense',
        montant: s.montant,
        commentaire: libelle,
        documentType: 'depense',
        documentId: id
      })
    }
    return depense(db, id)
  })
}

/** La dépense reste visible, marquée annulée, et ne compte plus dans les totaux. */
export function annulerDepense(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = nettoyer(motif)
  if (!m) throw new ErreurMetier('Indiquez le motif de l’annulation')
  avecTransaction(db, () => {
    const d = lireDepense(db, id)
    if (!d) throw new ErreurMetier('Dépense introuvable : rechargez la liste')
    if (d.annuleLe) throw new ErreurMetier(`La dépense ${d.numero} est déjà annulée`)
    if (d.source === 'caisse') {
      // Le Z d'une caisse clôturée est figé : les espèces sorties ne peuvent plus y revenir.
      if (d.sessionCloturee) throw new ErreurMetier('Cette caisse est clôturée : la dépense ne s’annule plus')
      const mouvement = une<{ id: number }>(
        db,
        `SELECT id FROM mouvements_caisse
         WHERE document_type = 'depense' AND document_id = ? AND mouvement_origine_id IS NULL`,
        id
      )
      // Les espèces reviennent au tiroir par une entrée compensatoire, liée à la sortie.
      if (mouvement) {
        annulerMouvementCaisse(db, {
          mouvementId: mouvement.id,
          utilisateurId,
          motif: `Annulation de la dépense ${d.numero} : ${m}`
        })
      }
    }
    executer(
      db,
      `UPDATE depenses SET annule_le = datetime('now','localtime'), annule_par = ?, motif_annulation = ?
       WHERE id = ?`,
      utilisateurId,
      m,
      id
    )
    journaliser(db, {
      utilisateurId,
      action: 'annulation_depense',
      entite: 'depenses',
      entiteId: id,
      avant: {
        numero: d.numero,
        date: d.date,
        categorie: d.categorie,
        libelle: d.libelle,
        montant: d.montant,
        source: d.source
      },
      apres: { motif: m }
    })
  })
}

/** `caissiereId` : la caissière ne voit que les dépenses de sa caisse ouverte, quelle que soit la période. */
export function listerDepenses(
  db: Db,
  filtre: { du?: string | null; au?: string | null; categorieId?: number | null } = {},
  caissiereId?: number
): ListeDepenses {
  const jour = aujourdhui(db)
  const au = filtre.au?.trim() || jour
  const du =
    filtre.du?.trim() ||
    new Date(Date.parse(`${au}T00:00:00Z`) - (JOURS_LISTE - 1) * 86_400_000).toISOString().slice(0, 10)
  if (!dateValide(du) || !dateValide(au)) throw new ErreurMetier('Indiquez une période valide')
  if (du > au) throw new ErreurMetier('Le début de la période doit précéder sa fin')

  const categorieId = filtre.categorieId ?? null
  // Sans caisse ouverte, la caissière ne voit rien (aucune session n'a l'id 0).
  const caisse = caissiereId !== undefined ? (sessionOuverte(db, caissiereId)?.id ?? 0) : null
  const depenses = toutes<DepenseEnBase>(
    db,
    caisse !== null
      ? `${SELECT_DEPENSE} WHERE d.session_caisse_id = ? AND (? IS NULL OR d.categorie_id = ?)
         ORDER BY d.date_depense DESC, d.id DESC`
      : `${SELECT_DEPENSE}
         WHERE d.date_depense BETWEEN ? AND ? AND (? IS NULL OR d.categorie_id = ?)
         ORDER BY d.date_depense DESC, d.id DESC`,
    ...(caisse !== null ? [caisse] : [du, au]),
    categorieId,
    categorieId
  ).map(versDepense)
  const valables = depenses.filter((d) => !d.annuleLe)
  const parCategorie = new Map<number, { categorieId: number; categorie: string; total: number }>()
  for (const d of valables) {
    const c = parCategorie.get(d.categorieId) ?? {
      categorieId: d.categorieId,
      categorie: d.categorie,
      total: 0
    }
    c.total += d.montant
    parCategorie.set(d.categorieId, c)
  }
  return {
    du,
    au,
    depenses,
    total: valables.reduce((s, d) => s + d.montant, 0),
    parCategorie: [...parCategorie.values()].sort(
      (a, b) => b.total - a.total || a.categorie.localeCompare(b.categorie, 'fr')
    )
  }
}

/** Total des dépenses non annulées d'une période (AAAA-MM-JJ incluses) : résultat de la période (B14). */
export function totalDepenses(db: Db, du: string, au: string): number {
  return une<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(montant), 0) AS total FROM depenses
     WHERE annule_le IS NULL AND date_depense BETWEEN ? AND ?`,
    du,
    au
  )!.total
}
