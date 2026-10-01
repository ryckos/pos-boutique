/**
 * Réceptions de marchandise (tâche B8). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 4.1 à 4.5) : l'utilisateur saisit ce qu'il a devant lui (3 cartons à
 * 6 000) ; à la validation, une seule transaction écrit les lignes telles quelles, un lot par ligne
 * périssable, un mouvement `reception` en unités de base, le nouveau CUMP, la dette (total et
 * échéance) et le numéro RC. Une réception validée ne se modifie pas : on corrige par un retour
 * fournisseur ou un inventaire.
 */
import type {
  ArticleReception,
  LigneReception,
  Reception,
  SaisieLigneReception,
  SaisieReception
} from '@shared/ipc/achats'
import { UNITES_FRACTIONNAIRES, convertirLigne, nouveauCump } from '@shared/achats'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { enregistrerMouvement, stockProduit } from '../../core/mouvements'
import { prochainNumero } from '../../core/numerotation'

export const DOCUMENT_RECEPTION = 'reception'

// ─── Lecture ──────────────────────────────────────────────────────────────────

const SQL_ARTICLE = `
  SELECT p.id AS produitId, c.id AS conditionnementId, p.nom AS produit, c.nom AS conditionnement,
         c.quantite_base AS quantiteBase, p.unite, p.suivi_peremption AS suiviPeremption,
         p.prix_achat_indicatif AS prixIndicatif,
         (SELECT u.prix_vente FROM conditionnements u WHERE u.produit_id = p.id AND u.est_defaut = 1) AS prixUnite,
         (SELECT l.prix_achat_unitaire FROM lignes_reception l
           WHERE l.conditionnement_id = c.id ORDER BY l.id DESC LIMIT 1) AS dernierPrix
  FROM conditionnements c
  JOIN produits p ON p.id = c.produit_id
  WHERE c.id = ? AND c.actif = 1 AND p.actif = 1`

interface ArticleLu {
  produitId: number
  conditionnementId: number
  produit: string
  conditionnement: string
  quantiteBase: number
  unite: string
  suiviPeremption: number
  prixIndicatif: number | null
  prixUnite: number | null
  dernierPrix: number | null
}

export function articleReception(db: Db, conditionnementId: number): ArticleReception | null {
  const a = une<ArticleLu>(db, SQL_ARTICLE, conditionnementId)
  if (!a) return null
  // Dernier prix payé pour ce conditionnement ; à défaut le prix indicatif de l'import, ramené
  // au conditionnement ; sinon rien : l'utilisateur tape le prix du bon de livraison.
  const prixPropose = a.dernierPrix ?? (a.prixIndicatif ? Math.round(a.prixIndicatif * a.quantiteBase) : null)
  return {
    produitId: a.produitId,
    conditionnementId: a.conditionnementId,
    produit: a.produit,
    conditionnement: a.conditionnement,
    quantiteBase: a.quantiteBase,
    unite: a.unite,
    suiviPeremption: a.suiviPeremption === 1,
    prixUnite: a.prixUnite ?? 0,
    prixPropose
  }
}

export function lireReception(db: Db, id: number): Reception {
  const r = une<Omit<Reception, 'lignes'>>(
    db,
    `SELECT r.id, r.numero, r.fournisseur_id AS fournisseurId, f.nom AS fournisseur,
            r.date_reception AS dateReception, r.date_echeance AS dateEcheance, r.total,
            u.nom AS utilisateur, r.commentaire
     FROM receptions r
     JOIN fournisseurs f ON f.id = r.fournisseur_id
     JOIN utilisateurs u ON u.id = r.utilisateur_id
     WHERE r.id = ?`,
    id
  )
  if (!r) throw new ErreurMetier('Réception introuvable : rechargez la liste')
  const lignes = toutes<Omit<LigneReception, 'coutBase' | 'total'> & { quantiteCond: number }>(
    db,
    `SELECT l.produit_id AS produitId, p.nom AS produit, COALESCE(c.nom, 'Unité') AS conditionnement,
            l.quantite_recue AS quantite, l.prix_achat_unitaire AS prix,
            l.quantite_base_totale AS quantiteBase, COALESCE(c.quantite_base, 1) AS quantiteCond,
            l.numero_lot AS numeroLot, l.date_peremption AS datePeremption
     FROM lignes_reception l
     JOIN produits p ON p.id = l.produit_id
     LEFT JOIN conditionnements c ON c.id = l.conditionnement_id
     WHERE l.reception_id = ?
     ORDER BY l.id`,
    id
  )
  return {
    ...r,
    lignes: lignes.map(({ quantiteCond, ...l }) => ({
      ...l,
      coutBase: l.prix / quantiteCond,
      total: Math.round(l.quantite * l.prix)
    }))
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Ligne vérifiée et relue en base, prête à écrire. */
interface LignePrete {
  article: ArticleLu
  saisie: SaisieLigneReception
  quantiteBase: number
  coutBase: number
  total: number
  numeroLot: string | null
  datePeremption: string | null
}

function verifierLigne(db: Db, s: SaisieLigneReception, rang: number): LignePrete {
  const a = une<ArticleLu>(db, SQL_ARTICLE, s.conditionnementId)
  if (!a)
    throw new ErreurMetier(`Ligne ${rang} : article introuvable ou désactivé, retirez-le de la réception`)
  const nom = `${a.produit} — ${a.conditionnement}`

  const fractionnaire = UNITES_FRACTIONNAIRES.includes(a.unite)
  if (!Number.isFinite(s.quantite) || s.quantite <= 0 || (!fractionnaire && !Number.isInteger(s.quantite))) {
    throw new ErreurMetier(
      fractionnaire
        ? `${nom} : indiquez une quantité reçue supérieure à zéro`
        : `${nom} : indiquez une quantité reçue entière, supérieure à zéro`
    )
  }
  if (!Number.isInteger(s.prix) || s.prix <= 0) {
    throw new ErreurMetier(
      `${nom} : le prix d’achat est un montant en francs, sans virgule, supérieur à zéro`
    )
  }

  let numeroLot: string | null = null
  let datePeremption: string | null = null
  if (a.suiviPeremption) {
    numeroLot = s.numeroLot?.trim() || null
    if (!numeroLot) throw new ErreurMetier(`${nom} : indiquez le numéro de lot inscrit sur l’emballage`)
    const d = s.datePeremption?.trim() ?? ''
    const valide = DATE_ISO.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d
    if (!valide) throw new ErreurMetier(`${nom} : indiquez la date de péremption`)
    const passee = une<{ passee: number }>(db, "SELECT ? < date('now','localtime') AS passee", d)!.passee
    if (passee) throw new ErreurMetier(`${nom} : la date de péremption est déjà passée, vérifiez-la`)
    datePeremption = d
  }

  const { quantiteBase, coutBase, total } = convertirLigne(s.quantite, s.prix, a.quantiteBase)
  return { article: a, saisie: s, quantiteBase, coutBase, total, numeroLot, datePeremption }
}

export function validerReception(
  db: Db,
  utilisateurId: number,
  s: SaisieReception
): { id: number; numero: string; total: number; dateEcheance: string } {
  if (s.lignes.length === 0) throw new ErreurMetier('Ajoutez au moins un article avant de valider')

  return avecTransaction(db, () => {
    const f = une<{ nom: string; actif: number; delai: number }>(
      db,
      'SELECT nom, actif, delai_paiement_jours AS delai FROM fournisseurs WHERE id = ?',
      s.fournisseurId
    )
    if (!f) throw new ErreurMetier('Choisissez le fournisseur qui livre')
    if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est désactivé : choisissez un autre fournisseur`)

    // Tout est vérifié avant la première écriture ; une erreur plus loin annule quand même tout.
    const lignes = s.lignes.map((l, i) => verifierLigne(db, l, i + 1))
    const total = lignes.reduce((t, l) => t + l.total, 0)

    // L'échéance part du jour de la réception avec le délai du jour, figé (§ 4.6).
    const { maintenant, dateEcheance } = une<{ maintenant: string; dateEcheance: string }>(
      db,
      `SELECT datetime('now','localtime') AS maintenant,
              date('now','localtime', '+' || ? || ' days') AS dateEcheance`,
      f.delai
    )!
    const numero = prochainNumero(db, 'RC')
    const receptionId = executer(
      db,
      `INSERT INTO receptions (numero, fournisseur_id, date_reception, date_echeance, total, utilisateur_id, commentaire)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      numero,
      s.fournisseurId,
      maintenant,
      dateEcheance,
      total,
      utilisateurId,
      s.commentaire?.trim() || null
    ).id

    for (const l of lignes) {
      const a = l.article
      executer(
        db,
        `INSERT INTO lignes_reception
           (reception_id, produit_id, conditionnement_id, quantite_recue, prix_achat_unitaire,
            quantite_base_totale, numero_lot, date_peremption)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        receptionId,
        a.produitId,
        a.conditionnementId,
        l.saisie.quantite,
        l.saisie.prix,
        l.quantiteBase,
        l.numeroLot,
        l.datePeremption
      )

      let lotId: number | null = null
      if (a.suiviPeremption) {
        // lots.prix_achat_unitaire est en francs entiers : il ne sert qu'à chiffrer la valeur en jeu
        // du tableau des péremptions, le CUMP garde le coût exact.
        lotId = executer(
          db,
          `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire, reception_id)
           VALUES (?, ?, ?, ?, ?)`,
          a.produitId,
          l.numeroLot,
          l.datePeremption,
          Math.round(l.coutBase),
          receptionId
        ).id
      }

      // Stock et CUMP relus à chaque ligne : deux lignes du même produit se cumulent dans l'ordre.
      const stockAvant = stockProduit(db, a.produitId)
      const { cump } = une<{ cump: number }>(
        db,
        'SELECT cout_moyen_pondere AS cump FROM produits WHERE id = ?',
        a.produitId
      )!
      enregistrerMouvement(db, {
        produitId: a.produitId,
        lotId,
        type: 'reception',
        quantite: l.quantiteBase,
        coutUnitaire: l.coutBase,
        documentType: DOCUMENT_RECEPTION,
        documentId: receptionId,
        utilisateurId
      })
      // Seuls la réception et le stock initial écrivent le CUMP (REGLES_METIER § 4.3).
      executer(
        db,
        "UPDATE produits SET cout_moyen_pondere = ?, modifie_le = datetime('now','localtime') WHERE id = ?",
        nouveauCump(stockAvant, cump, l.quantiteBase, l.coutBase),
        a.produitId
      )
    }

    return { id: receptionId, numero, total, dateEcheance }
  })
}
