/**
 * Inventaires (tâche B12). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 9) : gérant ; un seul inventaire en cours ; total ou par rayon ; chaque
 * comptage est enregistré aussitôt, théorique photographié à cet instant, un recomptage remplace le
 * précédent ; motif obligatoire pour un écart ; la validation crée un ajustement par écart au CUMP
 * (manquant pris sur les lots les plus anciens, surplus sans lot) et fige l'inventaire ; les produits
 * non comptés ne bougent pas. Annulation d'un inventaire en cours : motif, aucun mouvement.
 */
import type {
  InventaireDetail,
  LigneDemarque,
  LigneInventaire,
  PartComptage,
  ProduitInventaire,
  RapportDemarque,
  ResumeInventaire,
  SaisieComptage,
  TypeInventaire
} from '@shared/ipc/inventaires'
import type { ConditionnementComptage } from '@shared/ipc/stock'
import {
  EPSILON_ECART,
  LIBELLES_MOTIF_ECART,
  arrondirQuantite,
  repartirManquant,
  valeurEcart,
  type MotifEcart
} from '@shared/inventaires'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { enregistrerMouvement, stockProduit } from '../../core/mouvements'
import { prochainNumero } from '../../core/numerotation'

export const DOCUMENT_INVENTAIRE = 'inventaire'

// ─── Lecture ──────────────────────────────────────────────────────────────────

interface EnteteLue {
  id: number
  numero: string
  type: TypeInventaire
  categorieId: number | null
  rayon: string | null
  statut: ResumeInventaire['statut']
  dateDebut: string
  dateValidation: string | null
  ouvertPar: string
  validePar: string | null
  nbComptes: number
  motifAnnulation: string | null
}

const SQL_ENTETES = `
  SELECT i.id, i.numero, i.type, i.categorie_id AS categorieId, c.nom AS rayon, i.statut,
         i.date_debut AS dateDebut, i.date_validation AS dateValidation,
         u.nom AS ouvertPar, v.nom AS validePar, i.motif_annulation AS motifAnnulation,
         (SELECT COUNT(*) FROM lignes_inventaire l WHERE l.inventaire_id = i.id) AS nbComptes
  FROM inventaires i
  JOIN utilisateurs u ON u.id = i.utilisateur_id
  LEFT JOIN utilisateurs v ON v.id = i.valide_par_id
  LEFT JOIN categories c ON c.id = i.categorie_id`

function lireEntete(db: Db, id: number): EnteteLue {
  const e = une<EnteteLue>(db, `${SQL_ENTETES} WHERE i.id = ?`, id)
  if (!e) throw new ErreurMetier('Inventaire introuvable : rechargez la liste')
  return e
}

function exigerEnCours(e: EnteteLue): void {
  if (e.statut === 'valide') throw new ErreurMetier(`L’inventaire ${e.numero} est validé : il ne change plus`)
  if (e.statut === 'annule') throw new ErreurMetier(`L’inventaire ${e.numero} est annulé`)
}

/** Mouvements d'ajustement d'un inventaire validé, regroupés par produit. */
function rapportValide(db: Db, inventaireId: number): RapportDemarque {
  const lignes = toutes<LigneDemarque>(
    db,
    `SELECT m.produit_id AS produitId, p.nom AS produit, p.unite,
            SUM(m.quantite) AS ecart, MAX(m.cout_unitaire) AS cump,
            l.motif_ecart AS motif, l.commentaire
     FROM mouvements_stock m
     JOIN produits p ON p.id = m.produit_id
     LEFT JOIN lignes_inventaire l ON l.inventaire_id = m.document_id AND l.produit_id = m.produit_id
     WHERE m.type = 'ajustement_inventaire' AND m.document_type = '${DOCUMENT_INVENTAIRE}' AND m.document_id = ?
     GROUP BY m.produit_id
     ORDER BY p.nom COLLATE NOCASE`,
    inventaireId
  ).map((l) => ({ ...l, ecart: arrondirQuantite(l.ecart), valeur: valeurEcart(l.ecart, l.cump) }))
  return rapportDe(lignes)
}

function rapportDe(lignes: LigneDemarque[]): RapportDemarque {
  const manquants = -lignes.filter((l) => l.valeur < 0).reduce((s, l) => s + l.valeur, 0)
  const surplus = lignes.filter((l) => l.valeur > 0).reduce((s, l) => s + l.valeur, 0)
  return {
    lignes: [...lignes].sort((a, b) => a.valeur - b.valeur || a.produit.localeCompare(b.produit)),
    manquants,
    surplus,
    net: surplus - manquants
  }
}

function resumeDe(db: Db, e: EnteteLue): ResumeInventaire {
  return {
    id: e.id,
    numero: e.numero,
    type: e.type,
    rayon: e.rayon,
    statut: e.statut,
    dateDebut: e.dateDebut,
    dateValidation: e.dateValidation,
    ouvertPar: e.ouvertPar,
    validePar: e.validePar,
    nbComptes: e.nbComptes,
    demarque: e.statut === 'valide' ? rapportValide(db, e.id).manquants : null,
    motifAnnulation: e.motifAnnulation
  }
}

interface ProduitLu {
  produitId: number
  nom: string
  rayon: string | null
  unite: string
  cump: number
  actif: number
}

const SQL_PRODUITS = `
  SELECT p.id AS produitId, p.nom, COALESCE(parent.nom, c.nom) AS rayon, p.unite,
         p.cout_moyen_pondere AS cump, p.actif
  FROM produits p
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN categories parent ON parent.id = c.parent_id`

/** Le rayon choisi et ses sous-rayons ; tout le catalogue pour un inventaire total. */
const SQL_DANS_PERIMETRE = `(? IS NULL OR p.categorie_id = ?
  OR p.categorie_id IN (SELECT id FROM categories WHERE parent_id = ?))`

function conditionnements(db: Db, produitId: number): ConditionnementComptage[] {
  return toutes<ConditionnementComptage>(
    db,
    `SELECT id, nom, quantite_base AS quantiteBase FROM conditionnements
     WHERE produit_id = ? AND actif = 1 ORDER BY quantite_base DESC, id`,
    produitId
  )
}

interface LigneLue {
  produitId: number
  quantiteTheorique: number
  quantiteComptee: number
  ecart: number
  detail: string | null
  motif: MotifEcart | null
  commentaire: string | null
  compteLe: string
}

function lignesDe(db: Db, inventaireId: number): Map<number, LigneLue> {
  const lignes = toutes<LigneLue>(
    db,
    `SELECT produit_id AS produitId, quantite_theorique AS quantiteTheorique,
            quantite_comptee AS quantiteComptee, ecart, detail_comptage AS detail,
            motif_ecart AS motif, commentaire, compte_le AS compteLe
     FROM lignes_inventaire WHERE inventaire_id = ?`,
    inventaireId
  )
  return new Map(lignes.map((l) => [l.produitId, l]))
}

function ligneDe(l: LigneLue, cump: number): LigneInventaire {
  const ecart = arrondirQuantite(l.ecart)
  return {
    produitId: l.produitId,
    quantiteTheorique: l.quantiteTheorique,
    quantiteComptee: l.quantiteComptee,
    ecart,
    detail: l.detail ? (JSON.parse(l.detail) as PartComptage[]) : [],
    motif: l.motif,
    commentaire: l.commentaire,
    compteLe: l.compteLe,
    valeurEcart: valeurEcart(ecart, cump)
  }
}

export function detailInventaire(db: Db, id: number): InventaireDetail {
  const e = lireEntete(db, id)
  const lignes = lignesDe(db, id)
  const enCours = e.statut === 'en_cours'
  const produitsLus = enCours
    ? toutes<ProduitLu>(
        db,
        `${SQL_PRODUITS} WHERE p.actif = 1 AND ${SQL_DANS_PERIMETRE} ORDER BY p.nom COLLATE NOCASE`,
        e.categorieId,
        e.categorieId,
        e.categorieId
      )
    : toutes<ProduitLu>(
        db,
        `${SQL_PRODUITS} WHERE p.id IN (SELECT produit_id FROM lignes_inventaire WHERE inventaire_id = ?)
         ORDER BY p.nom COLLATE NOCASE`,
        id
      )
  const produits: ProduitInventaire[] = produitsLus.map((p) => {
    const l = lignes.get(p.produitId)
    return {
      produitId: p.produitId,
      nom: p.nom,
      rayon: p.rayon,
      unite: p.unite,
      stock: stockProduit(db, p.produitId),
      cump: p.cump,
      conditionnements: conditionnements(db, p.produitId),
      ligne: l ? ligneDe(l, p.cump) : null
    }
  })
  return {
    ...resumeDe(db, e),
    produits,
    nbNonComptes: enCours ? produits.filter((p) => !p.ligne).length : 0,
    rapport: e.statut === 'valide' ? rapportValide(db, id) : null
  }
}

export function inventaireEnCours(db: Db): InventaireDetail | null {
  const e = une<{ id: number }>(db, "SELECT id FROM inventaires WHERE statut = 'en_cours' ORDER BY id DESC")
  return e ? detailInventaire(db, e.id) : null
}

export function listerInventaires(db: Db): ResumeInventaire[] {
  return toutes<EnteteLue>(db, `${SQL_ENTETES} ORDER BY i.id DESC`).map((e) => resumeDe(db, e))
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

export function ouvrirInventaire(
  db: Db,
  utilisateurId: number,
  demande: { type: TypeInventaire; categorieId?: number | null }
): InventaireDetail {
  const id = avecTransaction(db, () => {
    const ouvert = une<{ numero: string }>(db, "SELECT numero FROM inventaires WHERE statut = 'en_cours'")
    if (ouvert) {
      throw new ErreurMetier(`L’inventaire ${ouvert.numero} est en cours : validez-le ou annulez-le d’abord`)
    }
    let categorieId: number | null = null
    if (demande.type === 'partiel') {
      const c = une<{ id: number; actif: number }>(
        db,
        'SELECT id, actif FROM categories WHERE id = ?',
        demande.categorieId ?? null
      )
      if (!c || !c.actif) throw new ErreurMetier('Choisissez le rayon à compter')
      categorieId = c.id
    } else if (demande.type !== 'total') {
      throw new ErreurMetier('Choisissez un inventaire total ou un rayon')
    }
    const numero = prochainNumero(db, 'INV')
    return executer(
      db,
      `INSERT INTO inventaires (numero, type, categorie_id, utilisateur_id, date_debut)
       VALUES (?, ?, ?, ?, datetime('now','localtime'))`,
      numero,
      demande.type,
      categorieId,
      utilisateurId
    ).id
  })
  return detailInventaire(db, id)
}

export function compterProduit(db: Db, s: SaisieComptage): LigneInventaire {
  return avecTransaction(db, () => {
    const e = lireEntete(db, s.inventaireId)
    exigerEnCours(e)
    const p = une<ProduitLu>(
      db,
      `${SQL_PRODUITS} WHERE p.id = ? AND ${SQL_DANS_PERIMETRE}`,
      s.produitId,
      e.categorieId,
      e.categorieId,
      e.categorieId
    )
    if (!p) {
      const existe = une<{ nom: string }>(db, 'SELECT nom FROM produits WHERE id = ?', s.produitId)
      if (!existe) throw new ErreurMetier('Produit introuvable : scannez-le à nouveau')
      throw new ErreurMetier(
        `« ${existe.nom} » n’est pas du rayon ${e.rayon ?? ''} : il ne se compte pas ici`
      )
    }
    if (!p.actif) throw new ErreurMetier(`« ${p.nom} » est désactivé : il ne se compte plus`)

    // Quantités relues en base : l'interface ne donne que des nombres de conditionnements.
    const fractionnaire = UNITES_FRACTIONNAIRES.includes(p.unite)
    const detail: PartComptage[] = []
    let quantite = 0
    const vus = new Set<number>()
    for (const { conditionnementId, nombre } of s.comptage) {
      if (!Number.isFinite(nombre) || nombre < 0) {
        throw new ErreurMetier('Chaque quantité comptée est un nombre positif ou zéro')
      }
      if (!fractionnaire && !Number.isInteger(nombre)) {
        throw new ErreurMetier('Chaque quantité comptée est un nombre entier')
      }
      if (vus.has(conditionnementId)) throw new ErreurMetier('Un conditionnement est compté deux fois')
      vus.add(conditionnementId)
      const c = une<{ nom: string; quantiteBase: number }>(
        db,
        'SELECT nom, quantite_base AS quantiteBase FROM conditionnements WHERE id = ? AND produit_id = ? AND actif = 1',
        conditionnementId,
        p.produitId
      )
      if (!c) throw new ErreurMetier('Conditionnement introuvable pour ce produit : rechargez l’inventaire')
      if (nombre === 0) continue
      quantite += nombre * c.quantiteBase
      detail.push({ conditionnementId, conditionnement: c.nom, nombre })
    }
    quantite = arrondirQuantite(quantite)

    // Le théorique est photographié maintenant : une vente faite après ce comptage ne fausse pas
    // l'écart, elle reste dans le stock une fois l'ajustement passé.
    const theorique = stockProduit(db, p.produitId)
    const ecart = arrondirQuantite(quantite - theorique)
    const commentaire = s.commentaire?.trim().replace(/\s+/g, ' ') || null
    let motif: MotifEcart | null = null
    if (Math.abs(ecart) > EPSILON_ECART) {
      if (!s.motif || !(s.motif in LIBELLES_MOTIF_ECART)) {
        throw new ErreurMetier(`Il y a un écart sur « ${p.nom} » : choisissez-en le motif`)
      }
      motif = s.motif
    }

    executer(
      db,
      `INSERT INTO lignes_inventaire
         (inventaire_id, produit_id, quantite_theorique, quantite_comptee, detail_comptage,
          motif_ecart, commentaire, compte_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
       ON CONFLICT (inventaire_id, produit_id) DO UPDATE SET
         quantite_theorique = excluded.quantite_theorique,
         quantite_comptee = excluded.quantite_comptee,
         detail_comptage = excluded.detail_comptage,
         motif_ecart = excluded.motif_ecart,
         commentaire = excluded.commentaire,
         compte_le = excluded.compte_le`,
      e.id,
      p.produitId,
      theorique,
      quantite,
      JSON.stringify(detail),
      motif,
      motif ? commentaire : null
    )
    return ligneDe(lignesDe(db, e.id).get(p.produitId)!, p.cump)
  })
}

/** Lots en stock d'un produit, la date la plus ancienne d'abord (périmés compris). */
function lotsEnStock(db: Db, produitId: number): Array<{ lotId: number; restant: number }> {
  return toutes(
    db,
    `SELECT v.id AS lotId, v.quantite_restante AS restant
     FROM v_stock_lots v
     WHERE v.produit_id = ? AND v.quantite_restante > ?
     ORDER BY v.date_peremption IS NULL, v.date_peremption, v.id`,
    produitId,
    EPSILON_ECART
  )
}

export function validerInventaire(db: Db, utilisateurId: number, id: number): RapportDemarque {
  return avecTransaction(db, () => {
    const e = lireEntete(db, id)
    exigerEnCours(e)
    const lignes = toutes<LigneLue & { cump: number }>(
      db,
      `SELECT l.produit_id AS produitId, l.ecart, l.motif_ecart AS motif, l.commentaire,
              p.cout_moyen_pondere AS cump
       FROM lignes_inventaire l JOIN produits p ON p.id = l.produit_id
       WHERE l.inventaire_id = ? ORDER BY l.id`,
      id
    )
    if (lignes.length === 0) {
      throw new ErreurMetier(
        'Aucun produit n’est compté : comptez au moins un produit, ou annulez l’inventaire'
      )
    }

    for (const l of lignes) {
      const ecart = arrondirQuantite(l.ecart)
      if (Math.abs(ecart) <= EPSILON_ECART) continue
      // Garde-fou : le motif a été exigé au comptage.
      if (!l.motif) throw new Error(`Écart sans motif sur le produit ${l.produitId}`)
      const libelle = `Inventaire ${e.numero} : ${LIBELLES_MOTIF_ECART[l.motif]}${l.commentaire ? ` (${l.commentaire})` : ''}`
      // Un manquant est pris sur les lots les plus anciens (le FEFO reste juste) ; un surplus entre
      // sans lot (on ne sait pas de quel arrivage il vient).
      const parts =
        ecart < 0
          ? repartirManquant(-ecart, lotsEnStock(db, l.produitId))
          : [{ lotId: null, quantite: -ecart }]
      for (const part of parts) {
        enregistrerMouvement(db, {
          produitId: l.produitId,
          lotId: part.lotId,
          type: 'ajustement_inventaire',
          quantite: -part.quantite,
          coutUnitaire: l.cump,
          documentType: DOCUMENT_INVENTAIRE,
          documentId: id,
          motif: libelle,
          utilisateurId
        })
      }
    }

    const nbNonComptes = detailInventaire(db, id).nbNonComptes
    executer(
      db,
      `UPDATE inventaires SET statut = 'valide', date_validation = datetime('now','localtime'),
              valide_par_id = ? WHERE id = ?`,
      utilisateurId,
      id
    )
    const rapport = rapportValide(db, id)
    journaliser(db, {
      utilisateurId,
      action: 'validation_inventaire',
      entite: 'inventaires',
      entiteId: id,
      apres: {
        numero: e.numero,
        rayon: e.rayon,
        comptes: lignes.length,
        ecarts: rapport.lignes.length,
        nonComptes: nbNonComptes,
        manquants: rapport.manquants,
        surplus: rapport.surplus
      }
    })
    return rapport
  })
}

export function annulerInventaire(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = motif.trim().replace(/\s+/g, ' ')
  if (!m) throw new ErreurMetier('Indiquez pourquoi l’inventaire est annulé')
  avecTransaction(db, () => {
    const e = lireEntete(db, id)
    exigerEnCours(e)
    executer(db, "UPDATE inventaires SET statut = 'annule', motif_annulation = ? WHERE id = ?", m, id)
    journaliser(db, {
      utilisateurId,
      action: 'annulation_inventaire',
      entite: 'inventaires',
      entiteId: id,
      apres: { numero: e.numero, rayon: e.rayon, comptes: e.nbComptes, motif: m }
    })
  })
}
