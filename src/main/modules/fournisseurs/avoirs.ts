/**
 * Avoirs des retours fournisseur (tâche B11). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 8, validées par Dev B le 2026-10-06) : un retour attend un avoir ;
 * reçu (montant réel, peut différer), il se déduit de la dette comme un règlement global ;
 * refusé avec motif journalisé ; annulé avec la sortie tant qu'il est encore attendu.
 */
import type { AvoirFournisseur, SaisieAvoirRecu } from '@shared/ipc/fournisseurs'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

export interface NouveauRetour {
  fournisseurId: number
  produitId: number
  lotId: number | null
  quantite: number
  coutUnitaire: number
  montantAttendu: number
  utilisateurId: number
}

/** Appelée par la sortie de stock, dans sa transaction. Renvoie l'id du retour (document du mouvement). */
export function creerRetour(db: Db, r: NouveauRetour): number {
  return executer(
    db,
    `INSERT INTO retours_fournisseur
       (fournisseur_id, produit_id, lot_id, quantite, cout_unitaire, montant_attendu, cree_par)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    r.fournisseurId,
    r.produitId,
    r.lotId,
    r.quantite,
    r.coutUnitaire,
    r.montantAttendu,
    r.utilisateurId
  ).id
}

interface RetourLu {
  statut: string
  fournisseur: string
  actif: number
  produit: string
  montantAttendu: number
}

function lireRetour(db: Db, id: number): RetourLu {
  const r = une<RetourLu>(
    db,
    `SELECT a.statut, f.nom AS fournisseur, f.actif, p.nom AS produit, a.montant_attendu AS montantAttendu
     FROM retours_fournisseur a
     JOIN fournisseurs f ON f.id = a.fournisseur_id
     JOIN produits p ON p.id = a.produit_id
     WHERE a.id = ?`,
    id
  )
  if (!r) throw new ErreurMetier('Avoir introuvable : rechargez la liste')
  if (r.statut !== 'attendu') throw new ErreurMetier('Cet avoir n’est plus attendu : rechargez la liste')
  return r
}

/** Le montant reçu se déduit de la dette ; un excédent reste à valoir sur les prochains achats. */
export function noterAvoirRecu(db: Db, utilisateurId: number, s: SaisieAvoirRecu): void {
  if (!Number.isInteger(s.montant) || s.montant <= 0) {
    throw new ErreurMetier('Le montant est un nombre de francs, sans virgule, supérieur à zéro')
  }
  avecTransaction(db, () => {
    const r = lireRetour(db, s.id)
    if (!r.actif) throw new ErreurMetier(`« ${r.fournisseur} » est désactivé`)
    const jour = une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
    const date = s.date?.trim() || jour
    const valide = DATE_ISO.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
    if (!valide) throw new ErreurMetier('Indiquez la date de l’avoir')
    if (date > jour) throw new ErreurMetier('La date de l’avoir ne peut pas être dans le futur')
    executer(
      db,
      `UPDATE retours_fournisseur
       SET statut = 'recu', montant_recu = ?, date_avoir = ?, reference = ?, clos_par = ?,
           clos_le = datetime('now','localtime')
       WHERE id = ?`,
      s.montant,
      date,
      s.reference?.trim() || null,
      utilisateurId,
      s.id
    )
  })
}

export function refuserAvoir(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = motif?.trim().replace(/\s+/g, ' ')
  if (!m) throw new ErreurMetier('Indiquez le motif du refus')
  avecTransaction(db, () => {
    const r = lireRetour(db, id)
    executer(
      db,
      `UPDATE retours_fournisseur
       SET statut = 'refuse', motif_cloture = ?, clos_par = ?, clos_le = datetime('now','localtime')
       WHERE id = ?`,
      m,
      utilisateurId,
      id
    )
    journaliser(db, {
      utilisateurId,
      action: 'refus_avoir_fournisseur',
      entite: 'retours_fournisseur',
      entiteId: id,
      avant: { fournisseur: r.fournisseur, produit: r.produit, montantAttendu: r.montantAttendu },
      apres: { motif: m }
    })
  })
}

/** Appelée par l'annulation de la sortie, dans sa transaction (elle-même journalisée). */
export function annulerRetour(db: Db, utilisateurId: number, id: number, motif: string): void {
  const r = une<{ statut: string; fournisseur: string }>(
    db,
    `SELECT a.statut, f.nom AS fournisseur FROM retours_fournisseur a
     JOIN fournisseurs f ON f.id = a.fournisseur_id WHERE a.id = ?`,
    id
  )
  if (!r) throw new ErreurMetier('Retour fournisseur introuvable : rechargez la liste')
  if (r.statut === 'recu') {
    throw new ErreurMetier(`L’avoir de « ${r.fournisseur} » est déjà reçu : cette sortie ne s’annule plus`)
  }
  if (r.statut !== 'attendu')
    throw new ErreurMetier('Ce retour est déjà clos : cette sortie ne s’annule plus')
  executer(
    db,
    `UPDATE retours_fournisseur
     SET statut = 'annule', motif_cloture = ?, clos_par = ?, clos_le = datetime('now','localtime')
     WHERE id = ?`,
    motif,
    utilisateurId,
    id
  )
}

/** Avoirs reçus d'un fournisseur (pour l'imputer sur ses réceptions). */
export function avoirsRecus(db: Db, fournisseurId: number): number[] {
  return toutes<{ m: number }>(
    db,
    `SELECT montant_recu AS m FROM retours_fournisseur WHERE fournisseur_id = ? AND statut = 'recu'`,
    fournisseurId
  ).map((a) => a.m)
}

/** Attendus d'abord, puis les autres ; les plus récents d'abord. */
export function avoirsFournisseur(db: Db, fournisseurId: number): AvoirFournisseur[] {
  return toutes<AvoirFournisseur>(
    db,
    `SELECT a.id, a.cree_le AS dateRetour, p.nom AS produit, a.quantite, p.unite,
            CASE WHEN l.id IS NOT NULL THEN COALESCE(
              l.numero_lot, 'périme le ' || strftime('%d/%m/%Y', l.date_peremption)
            ) END AS lot,
            a.montant_attendu AS montantAttendu, a.statut, a.montant_recu AS montantRecu,
            a.date_avoir AS dateAvoir, a.reference, a.motif_cloture AS motifCloture,
            u.nom AS utilisateur, c.nom AS closPar
     FROM retours_fournisseur a
     JOIN produits p ON p.id = a.produit_id
     JOIN utilisateurs u ON u.id = a.cree_par
     LEFT JOIN utilisateurs c ON c.id = a.clos_par
     LEFT JOIN lots l ON l.id = a.lot_id
     WHERE a.fournisseur_id = ?
     ORDER BY a.statut = 'attendu' DESC, a.cree_le DESC, a.id DESC`,
    fournisseurId
  )
}
