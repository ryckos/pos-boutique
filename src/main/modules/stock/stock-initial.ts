/**
 * Stock initial de démarrage (tâche B6). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 9.1) : produit par produit, enregistré aussitôt ; une seule fois par
 * produit et seulement sans réception ; la quantité saisie est le stock réel (le mouvement
 * compense les ventes déjà faites) ; le coût saisi initialise le CUMP ; date de péremption
 * obligatoire si le produit la suit ; correction par contre-passation, motif obligatoire.
 */
import type {
  EtatStockInitial,
  EtatStockInitialBoutique,
  FicheStockInitial,
  LigneStockInitial,
  SaisieStockInitial
} from '@shared/ipc/stock'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { contrePasser, enregistrerMouvement, stockProduit } from '../../core/mouvements'

export const DOCUMENT_STOCK_INITIAL = 'stock_initial'

/** Mouvements de stock initial encore en vigueur (non contre-passés) d'un produit. */
const SQL_MOUVEMENTS_EN_VIGUEUR = `
  SELECT m.id, m.quantite, m.cout_unitaire AS coutUnitaire, m.lot_id AS lotId
  FROM mouvements_stock m
  WHERE m.produit_id = ? AND m.type = 'ajustement_inventaire' AND m.document_type = '${DOCUMENT_STOCK_INITIAL}'
    AND NOT EXISTS (SELECT 1 FROM mouvements_stock a WHERE a.mouvement_origine_id = m.id)
  ORDER BY m.id`

interface ProduitLu {
  id: number
  nom: string
  rayon: string | null
  actif: number
  suiviPeremption: number
  coutPropose: number | null
  prixUnite: number | null
  aReception: number
  aStockInitial: number
}

const SQL_PRODUITS = `
  SELECT p.id, p.nom, COALESCE(parent.nom, c.nom) AS rayon, p.actif,
         p.suivi_peremption AS suiviPeremption, p.prix_achat_indicatif AS coutPropose,
         (SELECT prix_vente FROM conditionnements u WHERE u.produit_id = p.id AND u.est_defaut = 1) AS prixUnite,
         EXISTS (SELECT 1 FROM mouvements_stock m WHERE m.produit_id = p.id AND m.type = 'reception') AS aReception,
         EXISTS (${SQL_MOUVEMENTS_EN_VIGUEUR.replace('m.produit_id = ?', 'm.produit_id = p.id')}) AS aStockInitial
  FROM produits p
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN categories parent ON parent.id = c.parent_id`

function etatDe(p: ProduitLu): EtatStockInitial {
  if (p.aReception) return 'non_concerne'
  return p.aStockInitial ? 'fait' : 'a_faire'
}

function lireProduit(db: Db, produitId: number): ProduitLu {
  const p = une<ProduitLu>(db, `${SQL_PRODUITS} WHERE p.id = ?`, produitId)
  if (!p) throw new ErreurMetier('Produit introuvable : rechargez la liste')
  if (!p.actif) throw new ErreurMetier(`« ${p.nom} » est désactivé : il n’a pas de stock initial`)
  return p
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

export function etatStockInitial(db: Db): EtatStockInitialBoutique {
  const produits = toutes<ProduitLu>(db, `${SQL_PRODUITS} WHERE p.actif = 1 ORDER BY p.nom COLLATE NOCASE`)
  const lignes: LigneStockInitial[] = produits.map((p) => {
    const etat = etatDe(p)
    // Le premier mouvement est le comptage ; un second éventuel remet à zéro ce qui précédait.
    const comptage =
      etat === 'fait'
        ? une<{ quantite: number; coutUnitaire: number }>(db, SQL_MOUVEMENTS_EN_VIGUEUR, p.id)
        : undefined
    return {
      produitId: p.id,
      nom: p.nom,
      rayon: p.rayon,
      etat,
      stockActuel: stockProduit(db, p.id),
      quantite: comptage?.quantite ?? null,
      coutUnitaire: comptage?.coutUnitaire ?? null,
      coutPropose: p.coutPropose,
      prixUnite: p.prixUnite ?? 0
    }
  })
  const faits = lignes.filter((l) => l.etat === 'fait')
  return {
    lignes,
    nbFaits: faits.length,
    nbAFaire: lignes.filter((l) => l.etat === 'a_faire').length,
    valeurTotale: Math.round(faits.reduce((s, l) => s + (l.quantite ?? 0) * (l.coutUnitaire ?? 0), 0))
  }
}

export function ficheStockInitial(db: Db, produitId: number): FicheStockInitial {
  const p = lireProduit(db, produitId)
  return {
    produitId: p.id,
    nom: p.nom,
    etat: etatDe(p),
    suiviPeremption: p.suiviPeremption === 1,
    stockActuel: stockProduit(db, p.id),
    coutPropose: p.coutPropose,
    prixUnite: p.prixUnite ?? 0,
    conditionnements: toutes(
      db,
      `SELECT id, nom, quantite_base AS quantiteBase FROM conditionnements
       WHERE produit_id = ? AND actif = 1 ORDER BY quantite_base DESC, id`,
      p.id
    )
  }
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

function exigerDate(v: string | null | undefined): string {
  const d = v?.trim() ?? ''
  const valide = DATE_ISO.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d
  if (!valide) throw new ErreurMetier('Indiquez la date de péremption des articles comptés')
  return d
}

export function enregistrerStockInitial(
  db: Db,
  utilisateurId: number,
  s: SaisieStockInitial
): { quantiteBase: number; valeur: number } {
  if (!Number.isInteger(s.coutUnitaire) || s.coutUnitaire <= 0) {
    throw new ErreurMetier('Coût d’achat par unité : un montant en francs, sans virgule, supérieur à zéro')
  }
  return avecTransaction(db, () => {
    const p = lireProduit(db, s.produitId)
    const etat = etatDe(p)
    if (etat === 'non_concerne') {
      throw new ErreurMetier(`« ${p.nom} » a déjà reçu une livraison : son stock vient des réceptions`)
    }
    if (etat === 'fait') {
      throw new ErreurMetier(
        `Le stock initial de « ${p.nom} » est déjà enregistré : annulez-le pour le refaire`
      )
    }

    // Quantités relues en base : l'interface ne donne que des nombres de conditionnements.
    const detail: string[] = []
    let quantiteBase = 0
    const vus = new Set<number>()
    for (const { conditionnementId, nombre } of s.comptage) {
      if (!Number.isFinite(nombre) || nombre < 0) {
        throw new ErreurMetier('Chaque quantité comptée est un nombre positif ou zéro')
      }
      if (nombre === 0) continue
      if (vus.has(conditionnementId)) throw new ErreurMetier('Un conditionnement est compté deux fois')
      vus.add(conditionnementId)
      const c = une<{ nom: string; quantiteBase: number }>(
        db,
        'SELECT nom, quantite_base AS quantiteBase FROM conditionnements WHERE id = ? AND produit_id = ? AND actif = 1',
        conditionnementId,
        p.id
      )
      if (!c) throw new ErreurMetier('Conditionnement introuvable pour ce produit : rechargez la fiche')
      quantiteBase += nombre * c.quantiteBase
      detail.push(`${nombre} ${c.nom}`)
    }
    // Arrondi d'affichage des quantités fractionnaires (kg) : jamais de 2,9999999.
    quantiteBase = Math.round(quantiteBase * 1000) / 1000
    if (quantiteBase <= 0) {
      throw new ErreurMetier('Rien n’est compté : laissez ce produit « à faire » s’il n’y en a pas en rayon')
    }

    let lotId: number | null = null
    if (p.suiviPeremption) {
      const date = exigerDate(s.datePeremption)
      const numero = s.numeroLot?.trim() || null
      lotId = executer(
        db,
        `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire) VALUES (?, ?, ?, ?)`,
        p.id,
        numero,
        date,
        s.coutUnitaire
      ).id
    }

    const motif = `Stock initial : ${detail.join(' + ')}`
    const commun = {
      produitId: p.id,
      type: 'ajustement_inventaire' as const,
      coutUnitaire: s.coutUnitaire,
      documentType: DOCUMENT_STOCK_INITIAL,
      motif,
      utilisateurId
    }
    // La quantité comptée est le stock réel. Le comptage est un mouvement à lui seul (porté par le
    // lot s'il y en a un, pour le FEFO) ; ce qui a bougé avant (ventes faites avant le comptage) est
    // remis à zéro par un second mouvement, lisible à part dans l'historique.
    const stockAvant = stockProduit(db, p.id)
    enregistrerMouvement(db, { ...commun, lotId, quantite: quantiteBase })
    if (stockAvant !== 0) {
      enregistrerMouvement(db, {
        ...commun,
        quantite: -stockAvant,
        motif: 'Stock initial : remise à zéro des mouvements antérieurs au comptage'
      })
    }

    // Seuls la réception et le stock initial écrivent le CUMP (REGLES_METIER § 4.3).
    executer(
      db,
      "UPDATE produits SET cout_moyen_pondere = ?, modifie_le = datetime('now','localtime') WHERE id = ?",
      s.coutUnitaire,
      p.id
    )

    const valeur = Math.round(quantiteBase * s.coutUnitaire)
    journaliser(db, {
      utilisateurId,
      action: 'stock_initial',
      entite: 'produits',
      entiteId: p.id,
      apres: { quantite: quantiteBase, coutUnitaire: s.coutUnitaire, detail: motif, stockAvant }
    })
    return { quantiteBase, valeur }
  })
}

export function annulerStockInitial(db: Db, utilisateurId: number, produitId: number, motif: string): void {
  const m = motif.trim()
  if (!m) throw new ErreurMetier('Indiquez pourquoi le stock initial est annulé')
  avecTransaction(db, () => {
    const p = lireProduit(db, produitId)
    const etat = etatDe(p)
    if (etat === 'non_concerne') {
      throw new ErreurMetier(`« ${p.nom} » a déjà reçu une livraison : corrigez son stock par un inventaire`)
    }
    const mouvements = toutes<{ id: number; quantite: number }>(db, SQL_MOUVEMENTS_EN_VIGUEUR, p.id)
    if (etat !== 'fait' || mouvements.length === 0) {
      throw new ErreurMetier(`« ${p.nom} » n’a pas de stock initial à annuler`)
    }
    for (const mv of mouvements) contrePasser(db, mv.id, `Annulation du stock initial : ${m}`, utilisateurId)
    journaliser(db, {
      utilisateurId,
      action: 'annulation_stock_initial',
      entite: 'produits',
      entiteId: p.id,
      avant: { quantite: mouvements[0].quantite },
      apres: { motif: m, stock: stockProduit(db, p.id) }
    })
  })
}
