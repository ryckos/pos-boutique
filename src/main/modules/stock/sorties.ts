/**
 * Sorties de stock et retours fournisseur (tâche B11). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 8, validées par Dev B le 2026-10-06) : motif obligatoire ; quantité en
 * unités de base, au plus le stock du lot (ou du produit) ; mouvement chiffré au CUMP. Un retour
 * fournisseur sort en `retour_fournisseur` et attend un avoir au prix payé à ce fournisseur.
 * Correction par contre-passation, motif obligatoire, journalisée.
 */
import type {
  FicheSortie,
  LotSortie,
  PrixRetour,
  SaisieSortie,
  SortieStock,
  StatutAvoir
} from '@shared/ipc/stock'
import { MOTIFS_SORTIE, avoirAttendu, coutRetour } from '@shared/stock'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import type { Db } from '../../db/connexion'
import { avecTransaction, toutes, une } from '../../db/requetes'
import { contrePasser, enregistrerMouvement, stockProduit } from '../../core/mouvements'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { annulerRetour, creerRetour } from '../fournisseurs/avoirs'
import { lireDate } from './historique'

/** Document des sorties sans retour ; un retour a pour document la ligne de `retours_fournisseur`. */
export const DOCUMENT_SORTIE = 'sortie'
export const DOCUMENT_RETOUR_FOURNISSEUR = 'retour_fournisseur'
export const JOURS_SORTIES_PAR_DEFAUT = 30

/** En deçà, un reste au poids n'est qu'une erreur d'arrondi des nombres à virgule. */
const EPSILON = 1e-9

/**
 * Les sorties annulables : celles de cet écran et les retraits du tableau des péremptions (sans
 * document). Une casse issue d'un retour client (document `vente`, Dev A) n'en fait pas partie.
 */
const FILTRE_SORTIES = `m.type IN ('casse', 'vol', 'perte_peremption', 'retour_fournisseur')
  AND (m.document_type IS NULL OR m.document_type IN ('${DOCUMENT_SORTIE}', '${DOCUMENT_RETOUR_FOURNISSEUR}'))`

interface ProduitLu {
  nom: string
  unite: string
  cump: number
  suiviPeremption: number
  actif: number
}

function lireProduit(db: Db, produitId: number): ProduitLu {
  const p = une<ProduitLu>(
    db,
    `SELECT nom, unite, cout_moyen_pondere AS cump, suivi_peremption AS suiviPeremption, actif
     FROM produits WHERE id = ?`,
    produitId
  )
  if (!p) throw new ErreurMetier('Produit introuvable : scannez-le à nouveau')
  return p
}

function lotsEnStock(db: Db, produitId: number): LotSortie[] {
  return toutes<LotSortie>(
    db,
    `SELECT v.id AS lotId, l.numero_lot AS numeroLot, l.date_peremption AS datePeremption,
            v.quantite_restante AS restant, l.prix_achat_unitaire AS prixAchat, r.fournisseur_id AS fournisseurId
     FROM v_stock_lots v
     JOIN lots l ON l.id = v.id
     LEFT JOIN receptions r ON r.id = l.reception_id
     WHERE v.produit_id = ? AND v.quantite_restante > ?
     ORDER BY l.date_peremption IS NULL, l.date_peremption, l.id`,
    produitId,
    EPSILON
  )
}

/** Dernier coût par unité de base payé à chaque fournisseur actif pour ce produit. */
function prixFournisseurs(db: Db, produitId: number): PrixRetour[] {
  return toutes<PrixRetour>(
    db,
    `SELECT fournisseurId, fournisseur, coutUnitaire, date FROM (
       SELECT f.id AS fournisseurId, f.nom AS fournisseur,
              lr.quantite_recue * lr.prix_achat_unitaire / lr.quantite_base_totale AS coutUnitaire,
              r.date_reception AS date,
              ROW_NUMBER() OVER (PARTITION BY f.id ORDER BY r.date_reception DESC, lr.id DESC) AS rang
       FROM lignes_reception lr
       JOIN receptions r ON r.id = lr.reception_id
       JOIN fournisseurs f ON f.id = r.fournisseur_id
       WHERE lr.produit_id = ? AND f.actif = 1
     ) WHERE rang = 1
     ORDER BY date DESC, fournisseurId`,
    produitId
  )
}

export function ficheSortie(db: Db, produitId: number): FicheSortie {
  const p = lireProduit(db, produitId)
  if (!p.actif) throw new ErreurMetier(`« ${p.nom} » est désactivé`)
  const lots = lotsEnStock(db, produitId)
  const prix = prixFournisseurs(db, produitId)
  const fournisseurLot = lots[0]?.fournisseurId ?? null
  const fournisseurPropose =
    fournisseurLot !== null && prix.some((x) => x.fournisseurId === fournisseurLot)
      ? fournisseurLot
      : (prix[0]?.fournisseurId ?? null)
  return {
    produitId,
    nom: p.nom,
    unite: p.unite,
    stock: stockProduit(db, produitId),
    cump: p.cump,
    suiviPeremption: p.suiviPeremption === 1,
    lots,
    prixFournisseurs: prix,
    fournisseurPropose
  }
}

export function enregistrerSortie(
  db: Db,
  utilisateurId: number,
  s: SaisieSortie
): { mouvementId: number; retourId: number | null; montantAttendu: number | null } {
  const motif = MOTIFS_SORTIE[s.motif]
  if (!motif) throw new ErreurMetier('Choisissez le motif de la sortie')
  if (s.retour && !motif.retourPossible) {
    throw new ErreurMetier(`Un retour fournisseur ne se fait que pour un produit défectueux ou périmé`)
  }

  return avecTransaction(db, () => {
    // Stock, lot, CUMP et prix d'achat sont relus en base : l'écran a pu afficher un état dépassé.
    const p = lireProduit(db, s.produitId)
    if (!p.actif) throw new ErreurMetier(`« ${p.nom} » est désactivé`)
    const q = s.quantite
    if (!Number.isFinite(q) || q <= 0) throw new ErreurMetier('Indiquez la quantité qui sort du stock')
    if (!UNITES_FRACTIONNAIRES.includes(p.unite) && !Number.isInteger(q)) {
      throw new ErreurMetier('La quantité est un nombre entier')
    }

    const lotId = s.lotId ?? null
    let lot: LotSortie | null = null
    if (lotId !== null) {
      lot = lotsEnStock(db, s.produitId).find((l) => l.lotId === lotId) ?? null
      if (!lot) throw new ErreurMetier(`Ce lot de « ${p.nom} » n’a plus de stock : choisissez-en un autre`)
      if (q > lot.restant + EPSILON) {
        throw new ErreurMetier(`Il ne reste que ${lot.restant} dans ce lot : sortez au plus cette quantité`)
      }
    } else {
      const stock = stockProduit(db, s.produitId)
      if (stock <= EPSILON) throw new ErreurMetier(`« ${p.nom} » n’a pas de stock à sortir`)
      if (q > stock + EPSILON) {
        throw new ErreurMetier(`Il ne reste que ${stock} en stock : sortez au plus cette quantité`)
      }
    }

    const commentaire = s.commentaire?.trim().replace(/\s+/g, ' ')
    const libelle = commentaire ? `${motif.libelle} : ${commentaire}` : motif.libelle

    let retourId: number | null = null
    let montantAttendu: number | null = null
    if (s.retour) {
      const f = une<{ nom: string; actif: number }>(
        db,
        'SELECT nom, actif FROM fournisseurs WHERE id = ?',
        s.retour.fournisseurId
      )
      if (!f) throw new ErreurMetier('Choisissez le fournisseur du retour')
      if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est désactivé : choisissez un autre fournisseur`)
      const cout = coutRetour(s.retour.fournisseurId, {
        lot,
        prixFournisseurs: prixFournisseurs(db, s.produitId),
        cump: p.cump
      })
      montantAttendu = s.retour.montantAttendu ?? avoirAttendu(q, cout)
      if (!Number.isInteger(montantAttendu) || montantAttendu <= 0) {
        throw new ErreurMetier('L’avoir attendu est un nombre de francs, sans virgule, supérieur à zéro')
      }
      retourId = creerRetour(db, {
        fournisseurId: s.retour.fournisseurId,
        produitId: s.produitId,
        lotId,
        quantite: q,
        coutUnitaire: cout,
        montantAttendu,
        utilisateurId
      })
    }

    const mouvementId = enregistrerMouvement(db, {
      produitId: s.produitId,
      lotId,
      type: s.retour ? 'retour_fournisseur' : motif.type,
      quantite: -q,
      coutUnitaire: p.cump,
      documentType: s.retour ? DOCUMENT_RETOUR_FOURNISSEUR : DOCUMENT_SORTIE,
      documentId: retourId,
      motif: libelle,
      utilisateurId
    })
    return { mouvementId, retourId, montantAttendu }
  })
}

const SQL_SORTIES = `
  SELECT m.id AS mouvementId, m.horodatage, m.produit_id AS produitId, p.nom AS produit, p.unite,
         m.type, m.motif, -m.quantite AS quantite,
         CASE WHEN l.id IS NOT NULL THEN COALESCE(
           l.numero_lot, 'périme le ' || strftime('%d/%m/%Y', l.date_peremption)
         ) END AS lot,
         CAST(ROUND(-m.quantite * m.cout_unitaire) AS INTEGER) AS valeur,
         u.nom AS utilisateur,
         a.id AS retourId, f.nom AS retourFournisseur, a.montant_attendu AS retourMontant,
         a.statut AS retourStatut, c.motif AS motifAnnulation
  FROM mouvements_stock m
  JOIN produits p ON p.id = m.produit_id
  JOIN utilisateurs u ON u.id = m.utilisateur_id
  LEFT JOIN lots l ON l.id = m.lot_id
  LEFT JOIN retours_fournisseur a ON m.document_type = '${DOCUMENT_RETOUR_FOURNISSEUR}' AND a.id = m.document_id
  LEFT JOIN fournisseurs f ON f.id = a.fournisseur_id
  LEFT JOIN mouvements_stock c ON c.mouvement_origine_id = m.id
  WHERE ${FILTRE_SORTIES} AND m.horodatage >= ? AND m.horodatage < date(?, '+1 day')
  ORDER BY m.horodatage DESC, m.id DESC`

type LigneSortie = Omit<SortieStock, 'retour'> & {
  retourId: number | null
  retourFournisseur: string | null
  retourMontant: number | null
  retourStatut: StatutAvoir | null
}

export function listerSorties(db: Db, periode: { du?: string | null; au?: string | null } = {}): SortieStock[] {
  const aujourdhui = une<{ d: string }>(db, "SELECT date('now','localtime') AS d")!.d
  const au = lireDate(periode.au, 'fin') ?? aujourdhui
  const du =
    lireDate(periode.du, 'début') ??
    une<{ d: string }>(db, 'SELECT date(?, ?) AS d', au, `-${JOURS_SORTIES_PAR_DEFAUT} days`)!.d
  if (du > au) throw new ErreurMetier('La date de début doit précéder la date de fin')

  return toutes<LigneSortie>(db, SQL_SORTIES, du, au).map(
    ({ retourId, retourFournisseur, retourMontant, retourStatut, ...m }) => ({
      ...m,
      retour:
        retourId !== null
          ? { id: retourId, fournisseur: retourFournisseur!, montantAttendu: retourMontant!, statut: retourStatut! }
          : null
    })
  )
}

export function annulerSortie(db: Db, utilisateurId: number, mouvementId: number, motif: string): void {
  const m = motif?.trim().replace(/\s+/g, ' ')
  if (!m) throw new ErreurMetier('Indiquez le motif de l’annulation')
  avecTransaction(db, () => {
    const s = une<{
      produit: string
      type: string
      quantite: number
      motif: string | null
      documentType: string | null
      documentId: number | null
      cout: number
    }>(
      db,
      `SELECT p.nom AS produit, m.type, m.quantite, m.motif, m.document_type AS documentType,
              m.document_id AS documentId, m.cout_unitaire AS cout
       FROM mouvements_stock m JOIN produits p ON p.id = m.produit_id
       WHERE m.id = ? AND ${FILTRE_SORTIES}`,
      mouvementId
    )
    if (!s) throw new ErreurMetier('Sortie introuvable : rechargez la liste')
    if (une(db, 'SELECT id FROM mouvements_stock WHERE mouvement_origine_id = ?', mouvementId)) {
      throw new ErreurMetier('Cette sortie est déjà annulée')
    }
    if (s.documentType === DOCUMENT_RETOUR_FOURNISSEUR && s.documentId !== null) {
      annulerRetour(db, utilisateurId, s.documentId, m)
    }
    contrePasser(db, mouvementId, m, utilisateurId)
    journaliser(db, {
      utilisateurId,
      action: 'annulation_sortie_stock',
      entite: 'mouvements_stock',
      entiteId: mouvementId,
      avant: {
        produit: s.produit,
        type: s.type,
        quantite: -s.quantite,
        motif: s.motif,
        valeur: Math.round(-s.quantite * s.cout)
      },
      apres: { motif: m }
    })
  })
}
