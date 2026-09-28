/** Propriétaire : Dev B. Écran stock (B4) et stock initial de démarrage (B6). */
import type { PartRepartition } from '../stock'

// ─── Écran stock (B4) ────────────────────────────────────────────────────────

/** Rupture : stock ≤ 0. Stock bas : stock ≤ seuil d'alerte (REGLES_METIER § 3.3). */
export type NiveauStock = 'rupture' | 'stock_bas' | 'normal'

export interface LigneStock {
  produitId: number
  nom: string
  /** Nom du rayon (premier niveau), null si non classé. */
  rayon: string | null
  unite: string
  /** En unités de base ; peut être négatif (D-A1). */
  stock: number
  seuil: number
  /** Coût moyen pondéré par unité de base. */
  cump: number
  /** stock × CUMP, en FCFA entiers. */
  valeur: number
  niveau: NiveauStock
  /** « 1 × Carton de 24 + 7 × Lot de 3 + 1 × Unité », à titre indicatif ; null si sans intérêt. */
  repartition: PartRepartition[] | null
  /** Date de la dernière vente (AAAA-MM-JJ HH:MM:SS), null si jamais vendu. */
  derniereVente: string | null
  /** Du stock, mais aucune vente depuis `dormantJours` jours. */
  dormant: boolean
}

export interface EtatStock {
  lignes: LigneStock[]
  /** Somme des valeurs, en FCFA. */
  valeurTotale: number
  nbRuptures: number
  nbStockBas: number
  nbDormants: number
  /** Seuil des produits dormants (paramètre `dormant_jours`). */
  dormantJours: number
}

// ─── Stock initial (B6) ──────────────────────────────────────────────────────

/**
 * - `a_faire` : jamais compté, sans réception : on peut saisir son stock initial.
 * - `fait` : stock initial enregistré (annulable tant qu'aucune réception n'est arrivée).
 * - `non_concerne` : le produit a déjà reçu une livraison, son stock et son CUMP en viennent.
 */
export type EtatStockInitial = 'a_faire' | 'fait' | 'non_concerne'

export interface LigneStockInitial {
  produitId: number
  nom: string
  /** Nom du rayon (premier niveau), null si non classé. */
  rayon: string | null
  etat: EtatStockInitial
  /** Stock actuel en unités de base. */
  stockActuel: number
  /** Quantité et coût enregistrés au stock initial (état `fait`), sinon null. */
  quantite: number | null
  coutUnitaire: number | null
  /** Coût proposé : prix d'achat indicatif venu de l'import (B3), sinon null. */
  coutPropose: number | null
  /** Prix de vente de l'Unité, pour repérer un coût incohérent. */
  prixUnite: number
}

export interface EtatStockInitialBoutique {
  lignes: LigneStockInitial[]
  nbFaits: number
  nbAFaire: number
  /** Somme quantité × coût des stocks initiaux enregistrés, en FCFA. */
  valeurTotale: number
}

export interface ConditionnementComptage {
  id: number
  nom: string
  quantiteBase: number
}

export interface FicheStockInitial {
  produitId: number
  nom: string
  etat: EtatStockInitial
  suiviPeremption: boolean
  stockActuel: number
  coutPropose: number | null
  prixUnite: number
  /** Conditionnements actifs, du plus grand au plus petit (on compte les cartons d'abord). */
  conditionnements: ConditionnementComptage[]
}

export interface SaisieStockInitial {
  produitId: number
  /** Nombre compté par conditionnement ; converti en unités de base par le service. */
  comptage: Array<{ conditionnementId: number; nombre: number }>
  /** FCFA entiers par unité de base : initialise le CUMP. */
  coutUnitaire: number
  /** Obligatoire si le produit suit la péremption (AAAA-MM-JJ). */
  datePeremption?: string | null
  numeroLot?: string | null
}

export interface ContratStock {
  /** Stock de tous les produits actifs, valeur, alertes, dormants. Gérant (valeur au CUMP). */
  'stock:etat': { requete: void; reponse: EtatStock }
  /** Tous les produits actifs avec leur état de stock initial. Gérant. */
  'stock:stockInitial': { requete: void; reponse: EtatStockInitialBoutique }
  'stock:ficheStockInitial': { requete: { produitId: number }; reponse: FicheStockInitial }
  /**
   * Enregistre le stock compté d'un produit, en une transaction : mouvement `ajustement_inventaire`
   * (document `stock_initial`), lot si péremption, CUMP = coût saisi. Gérant.
   */
  'stock:enregistrerStockInitial': {
    requete: SaisieStockInitial
    reponse: { quantiteBase: number; valeur: number }
  }
  /** Contre-passe le stock initial d'un produit (motif obligatoire, journalisé). Gérant. */
  'stock:annulerStockInitial': { requete: { produitId: number; motif: string }; reponse: void }
}
