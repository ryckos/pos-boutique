/**
 * Commandes fournisseur (tâche B8, partie 3). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 4.7) : on commande dans le conditionnement (3 cartons) ; brouillon en base
 * avec son numéro CA, seul modifiable ; « envoyée » à la main ; à chaque réception liée, la commande
 * passe à `recue` ou `recue_partiel` en comparant les unités de base produit par produit ; le reste
 * qui ne viendra pas se clôture, une commande non livrée s'annule, avec motif journalisé.
 */
import type {
  Commande,
  LigneCommande,
  ProduitEnAlerte,
  ResumeCommande,
  SaisieCommande,
  StatutCommande
} from '@shared/ipc/achats'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { prochainNumero } from '../../core/numerotation'

/** En dessous, un reste au poids est considéré comme soldé (arrondis des décimales). */
const EPSILON = 1e-9

// ─── Lecture ──────────────────────────────────────────────────────────────────

const SQL_RESUME = `
  SELECT c.id, c.numero, c.fournisseur_id AS fournisseurId, f.nom AS fournisseur, c.statut,
         c.date_commande AS dateCommande, u.nom AS utilisateur,
         COALESCE((SELECT SUM(CAST(ROUND(l.quantite_commandee * l.prix_achat_prevu) AS INTEGER))
                   FROM lignes_commande_achat l WHERE l.commande_id = c.id), 0) AS totalPrevu,
         (SELECT COUNT(*) FROM lignes_commande_achat l WHERE l.commande_id = c.id) AS nbLignes
  FROM commandes_achat c
  JOIN fournisseurs f ON f.id = c.fournisseur_id
  JOIN utilisateurs u ON u.id = c.utilisateur_id`

export function listerCommandes(db: Db, limite = 200): ResumeCommande[] {
  return toutes<ResumeCommande>(db, `${SQL_RESUME} ORDER BY c.id DESC LIMIT ?`, limite)
}

export function commandesOuvertes(db: Db, fournisseurId: number): ResumeCommande[] {
  return toutes<ResumeCommande>(
    db,
    `${SQL_RESUME} WHERE c.fournisseur_id = ? AND c.statut IN ('envoyee', 'recue_partiel') ORDER BY c.id`,
    fournisseurId
  )
}

function lignesCommande(db: Db, commandeId: number): LigneCommande[] {
  // Une commande n'a qu'une ligne par produit : tout ce qui est reçu de ce produit par les
  // réceptions liées vient en déduction, quel que soit le conditionnement livré.
  const lignes = toutes<Omit<LigneCommande, 'prix' | 'total' | 'commandeBase' | 'resteBase'> & { prixPrevu: number }>(
    db,
    `SELECT l.produit_id AS produitId, l.conditionnement_id AS conditionnementId, p.nom AS produit,
            c.nom AS conditionnement, c.quantite_base AS quantiteCond, l.quantite_commandee AS quantite,
            l.prix_achat_prevu AS prixPrevu,
            COALESCE((SELECT SUM(lr.quantite_base_totale) FROM lignes_reception lr
                      JOIN receptions r ON r.id = lr.reception_id
                      WHERE r.commande_id = l.commande_id AND lr.produit_id = l.produit_id), 0) AS recuBase
     FROM lignes_commande_achat l
     JOIN produits p ON p.id = l.produit_id
     JOIN conditionnements c ON c.id = l.conditionnement_id
     WHERE l.commande_id = ?
     ORDER BY l.id`,
    commandeId
  )
  return lignes.map(({ prixPrevu, ...l }) => {
    const commandeBase = l.quantite * l.quantiteCond
    const reste = commandeBase - l.recuBase
    return {
      ...l,
      prix: prixPrevu > 0 ? prixPrevu : null,
      total: prixPrevu > 0 ? Math.round(l.quantite * prixPrevu) : null,
      commandeBase,
      resteBase: reste > EPSILON ? reste : 0
    }
  })
}

export function lireCommande(db: Db, id: number): Commande {
  const c = une<Omit<Commande, 'lignes' | 'receptions'>>(
    db,
    `SELECT c.id, c.numero, c.fournisseur_id AS fournisseurId, f.nom AS fournisseur, c.statut,
            c.date_commande AS dateCommande, u.nom AS utilisateur, c.commentaire,
            COALESCE((SELECT SUM(CAST(ROUND(l.quantite_commandee * l.prix_achat_prevu) AS INTEGER))
                      FROM lignes_commande_achat l WHERE l.commande_id = c.id), 0) AS totalPrevu
     FROM commandes_achat c
     JOIN fournisseurs f ON f.id = c.fournisseur_id
     JOIN utilisateurs u ON u.id = c.utilisateur_id
     WHERE c.id = ?`,
    id
  )
  if (!c) throw new ErreurMetier('Commande introuvable : rechargez la liste')
  const receptions = toutes<Commande['receptions'][number]>(
    db,
    `SELECT id, numero, date_reception AS dateReception, total FROM receptions
     WHERE commande_id = ? ORDER BY id`,
    id
  )
  return { ...c, lignes: lignesCommande(db, id), receptions }
}

export function produitsEnAlerte(db: Db): ProduitEnAlerte[] {
  // Conditionnement proposé : celui de la dernière réception s'il est encore actif, sinon l'Unité.
  return toutes<ProduitEnAlerte>(
    db,
    `SELECT a.id AS produitId, a.nom AS produit, a.unite, a.stock_actuel AS stock,
            a.seuil_alerte AS seuil, a.niveau,
            COALESCE(
              (SELECT lr.conditionnement_id FROM lignes_reception lr
               JOIN conditionnements c ON c.id = lr.conditionnement_id AND c.actif = 1
               WHERE lr.produit_id = a.id ORDER BY lr.id DESC LIMIT 1),
              (SELECT c.id FROM conditionnements c WHERE c.produit_id = a.id AND c.est_defaut = 1)
            ) AS conditionnementId
     FROM v_alertes_stock a
     ORDER BY a.niveau = 'rupture' DESC, a.nom COLLATE NOCASE`
  )
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

interface EnTete {
  numero: string
  statut: StatutCommande
  fournisseurId: number
}

function enTete(db: Db, id: number): EnTete {
  const c = une<EnTete>(
    db,
    'SELECT numero, statut, fournisseur_id AS fournisseurId FROM commandes_achat WHERE id = ?',
    id
  )
  if (!c) throw new ErreurMetier('Commande introuvable : rechargez la liste')
  return c
}

interface LignePrete {
  produitId: number
  conditionnementId: number
  quantite: number
  prix: number
}

function verifierSaisie(db: Db, s: SaisieCommande): LignePrete[] {
  const f = une<{ nom: string; actif: number }>(db, 'SELECT nom, actif FROM fournisseurs WHERE id = ?', s.fournisseurId)
  if (!f) throw new ErreurMetier('Choisissez le fournisseur à qui vous commandez')
  if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est désactivé : choisissez un autre fournisseur`)
  if (s.lignes.length === 0) throw new ErreurMetier('Ajoutez au moins un article à la commande')

  const vus = new Set<number>()
  return s.lignes.map((l, i) => {
    const a = une<{ produitId: number; produit: string; conditionnement: string; unite: string }>(
      db,
      `SELECT p.id AS produitId, p.nom AS produit, c.nom AS conditionnement, p.unite
       FROM conditionnements c JOIN produits p ON p.id = c.produit_id
       WHERE c.id = ? AND c.actif = 1 AND p.actif = 1`,
      l.conditionnementId
    )
    if (!a) throw new ErreurMetier(`Ligne ${i + 1} : article introuvable ou désactivé, retirez-le de la commande`)
    const nom = `${a.produit} — ${a.conditionnement}`
    // Une ligne par produit : le reste à recevoir se calcule produit par produit.
    if (vus.has(a.produitId)) {
      throw new ErreurMetier(`${a.produit} est déjà dans la commande : modifiez sa ligne`)
    }
    vus.add(a.produitId)

    const fractionnaire = UNITES_FRACTIONNAIRES.includes(a.unite)
    if (!Number.isFinite(l.quantite) || l.quantite <= 0 || (!fractionnaire && !Number.isInteger(l.quantite))) {
      throw new ErreurMetier(
        fractionnaire
          ? `${nom} : indiquez une quantité commandée supérieure à zéro`
          : `${nom} : indiquez une quantité commandée entière, supérieure à zéro`
      )
    }
    if (l.prix !== null && (!Number.isInteger(l.prix) || l.prix <= 0)) {
      throw new ErreurMetier(`${nom} : le prix prévu est un montant en francs, sans virgule, ou laissez-le vide`)
    }
    return { produitId: a.produitId, conditionnementId: l.conditionnementId, quantite: l.quantite, prix: l.prix ?? 0 }
  })
}

function ecrireLignes(db: Db, commandeId: number, lignes: LignePrete[]): void {
  for (const l of lignes) {
    executer(
      db,
      `INSERT INTO lignes_commande_achat (commande_id, produit_id, conditionnement_id, quantite_commandee, prix_achat_prevu)
       VALUES (?, ?, ?, ?, ?)`,
      commandeId,
      l.produitId,
      l.conditionnementId,
      l.quantite,
      l.prix
    )
  }
}

const COMMENTAIRE = (c: string | null | undefined): string | null => c?.trim() || null

export function creerCommande(db: Db, utilisateurId: number, s: SaisieCommande): { id: number; numero: string } {
  return avecTransaction(db, () => {
    const lignes = verifierSaisie(db, s)
    const numero = prochainNumero(db, 'CA')
    const id = executer(
      db,
      `INSERT INTO commandes_achat (numero, fournisseur_id, statut, utilisateur_id, commentaire)
       VALUES (?, ?, 'brouillon', ?, ?)`,
      numero,
      s.fournisseurId,
      utilisateurId,
      COMMENTAIRE(s.commentaire)
    ).id
    ecrireLignes(db, id, lignes)
    return { id, numero }
  })
}

export function modifierCommande(db: Db, id: number, s: SaisieCommande): void {
  avecTransaction(db, () => {
    const c = enTete(db, id)
    if (c.statut !== 'brouillon') {
      throw new ErreurMetier(`La commande ${c.numero} a été envoyée : annulez-la et faites-en une autre`)
    }
    const lignes = verifierSaisie(db, s)
    executer(
      db,
      'UPDATE commandes_achat SET fournisseur_id = ?, commentaire = ? WHERE id = ?',
      s.fournisseurId,
      COMMENTAIRE(s.commentaire),
      id
    )
    // Un brouillon n'est pas encore un document : personne ne l'a reçu, ses lignes se remplacent.
    executer(db, 'DELETE FROM lignes_commande_achat WHERE commande_id = ?', id)
    ecrireLignes(db, id, lignes)
  })
}

export function envoyerCommande(db: Db, id: number): void {
  avecTransaction(db, () => {
    const c = enTete(db, id)
    if (c.statut !== 'brouillon') throw new ErreurMetier(`La commande ${c.numero} est déjà envoyée`)
    executer(db, "UPDATE commandes_achat SET statut = 'envoyee' WHERE id = ?", id)
  })
}

function motifObligatoire(motif: string, action: string): string {
  const m = motif?.trim().replace(/\s+/g, ' ')
  if (!m) throw new ErreurMetier(`Indiquez le motif ${action}`)
  return m
}

export function annulerCommande(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = motifObligatoire(motif, 'de l’annulation')
  avecTransaction(db, () => {
    const c = enTete(db, id)
    if (c.statut === 'annulee') throw new ErreurMetier(`La commande ${c.numero} est déjà annulée`)
    if (c.statut !== 'brouillon' && c.statut !== 'envoyee') {
      throw new ErreurMetier(
        `La commande ${c.numero} a déjà été livrée : clôturez-la si le reste ne viendra pas`
      )
    }
    executer(db, "UPDATE commandes_achat SET statut = 'annulee' WHERE id = ?", id)
    journaliser(db, {
      utilisateurId,
      action: 'annulation_commande',
      entite: 'commandes_achat',
      entiteId: id,
      avant: { numero: c.numero, statut: c.statut },
      apres: { motif: m }
    })
  })
}

export function cloturerCommande(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = motifObligatoire(motif, 'de la clôture')
  avecTransaction(db, () => {
    const c = enTete(db, id)
    if (c.statut !== 'recue_partiel') {
      throw new ErreurMetier(
        c.statut === 'recue'
          ? `La commande ${c.numero} est déjà entièrement reçue`
          : `Seule une commande reçue en partie se clôture : annulez la commande ${c.numero} si rien n’est arrivé`
      )
    }
    const reste = lignesCommande(db, id)
      .filter((l) => l.resteBase > 0)
      .map((l) => ({ produit: l.produit, resteBase: l.resteBase }))
    executer(db, "UPDATE commandes_achat SET statut = 'recue' WHERE id = ?", id)
    journaliser(db, {
      utilisateurId,
      action: 'cloture_commande',
      entite: 'commandes_achat',
      entiteId: id,
      avant: { numero: c.numero, reste },
      apres: { motif: m }
    })
  })
}

// ─── Lien avec la réception ───────────────────────────────────────────────────

/** Vérifie, avant toute écriture de la réception, que la commande peut être livrée. */
export function verifierCommandeALivrer(db: Db, commandeId: number, fournisseurId: number): void {
  const c = enTete(db, commandeId)
  if (c.fournisseurId !== fournisseurId) {
    throw new ErreurMetier(`La commande ${c.numero} est passée à un autre fournisseur`)
  }
  if (c.statut === 'brouillon') {
    throw new ErreurMetier(`La commande ${c.numero} n’a pas été envoyée : marquez-la comme envoyée d’abord`)
  }
  if (c.statut !== 'envoyee' && c.statut !== 'recue_partiel') {
    throw new ErreurMetier(
      c.statut === 'annulee'
        ? `La commande ${c.numero} est annulée : recevez sans commande`
        : `La commande ${c.numero} est déjà reçue : recevez sans commande`
    )
  }
}

/** Appelée dans la transaction de la réception, une fois ses lignes écrites. */
export function majStatutApresReception(db: Db, commandeId: number): void {
  const complete = lignesCommande(db, commandeId).every((l) => l.resteBase === 0)
  executer(db, 'UPDATE commandes_achat SET statut = ? WHERE id = ?', complete ? 'recue' : 'recue_partiel', commandeId)
}
