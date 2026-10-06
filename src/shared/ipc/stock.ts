/** Propriétaire : Dev B. Écran stock (B4), stock initial (B6), péremptions (B9), sorties (B11). */
import type { MotifSortie, PartRepartition } from '../stock'
import type { TypeMouvement } from '../types'

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

/** Un mouvement de l'historique d'un produit, lisible par le gérant. */
export interface MouvementHistorique {
  id: number
  /** AAAA-MM-JJ HH:MM:SS, heure locale. */
  horodatage: string
  type: TypeMouvement
  /** En unités de base, signée (+ entrée, − sortie). */
  quantite: number
  /** Stock du produit juste après ce mouvement. */
  stockApres: number
  /** « Ticket T-2026-000123 », « Stock initial »… ; null si aucun document. */
  document: string | null
  /** Numéro du lot d'arrivage (sinon sa date de péremption), null si sans lot. */
  lot: string | null
  motif: string | null
  utilisateur: string
}

export interface HistoriqueProduit {
  produitId: number
  nom: string
  stockActuel: number
  repartition: PartRepartition[] | null
  /** Période affichée, AAAA-MM-JJ, bornes comprises. */
  du: string
  au: string
  /** Stock au début de la période (somme des mouvements antérieurs). */
  stockDebut: number
  /** Du plus ancien au plus récent. */
  mouvements: MouvementHistorique[]
  /** Stock à la fin de la période (= stock actuel si la période va jusqu'à aujourd'hui). */
  stockFin: number
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

// ─── Péremptions (B9) ────────────────────────────────────────────────────────

/** Un lot d'arrivage en stock qui périme bientôt, ou déjà périmé (REGLES_METIER § 5.1). */
export interface LotPerimable {
  lotId: number
  produitId: number
  produit: string
  numeroLot: string | null
  /** AAAA-MM-JJ. */
  datePeremption: string
  /** Négatif = périmé depuis autant de jours. */
  joursRestants: number
  /** En unités de base. */
  restant: number
  unite: string
  /** Prix d'achat du lot, FCFA par unité de base. */
  prixAchat: number
  /** restant × prix d'achat, FCFA. */
  valeur: number
  /** 3 jours ou moins (périmés compris) : ligne rouge ; sinon ambre. */
  urgent: boolean
}

export interface TableauPeremptions {
  /** Paramètre `peremption_seuil_jours`. */
  horizonJours: number
  /** Du plus proche au plus lointain. */
  lots: LotPerimable[]
  /** Somme des valeurs en jeu, FCFA. */
  valeurTotale: number
}

// ─── Sorties de stock et retours fournisseur (B11) ───────────────────────────

/** Un lot en stock du produit, pour choisir d'où sort la marchandise. */
export interface LotSortie {
  lotId: number
  numeroLot: string | null
  /** AAAA-MM-JJ, null si le lot n'est pas daté. */
  datePeremption: string | null
  restant: number
  /** Prix d'achat du lot, FCFA par unité de base. */
  prixAchat: number
  /** Fournisseur de la réception qui a créé le lot, null pour un stock initial. */
  fournisseurId: number | null
}

/** Dernier coût payé à un fournisseur actif pour ce produit. */
export interface PrixRetour {
  fournisseurId: number
  fournisseur: string
  /** FCFA par unité de base (prix du conditionnement / quantité de base). */
  coutUnitaire: number
  /** AAAA-MM-JJ HH:MM:SS de la réception. */
  date: string
}

export interface FicheSortie {
  produitId: number
  nom: string
  unite: string
  /** Stock du produit, en unités de base. */
  stock: number
  cump: number
  suiviPeremption: boolean
  /** Lots en stock, date la plus proche d'abord (périmés compris) : le premier est proposé. */
  lots: LotSortie[]
  /** Fournisseurs actifs qui ont livré ce produit, le plus récent d'abord. */
  prixFournisseurs: PrixRetour[]
  /** Fournisseur proposé pour un retour : celui du lot proposé, sinon le dernier qui a livré. */
  fournisseurPropose: number | null
}

export interface SaisieSortie {
  produitId: number
  /** Lot d'où sort la marchandise ; absent ou null = sortie sans lot. */
  lotId?: number | null
  /** En unités de base, au plus le stock du lot (ou du produit sans lot). */
  quantite: number
  motif: MotifSortie
  commentaire?: string | null
  /** Retour fournisseur (motifs « Défectueux ou casse » et « Périmé » seulement). */
  retour?: {
    fournisseurId: number
    /** FCFA entier > 0 ; absent = quantité × coût de retour, recalculé par le service. */
    montantAttendu?: number | null
  } | null
}

export type StatutAvoir = 'attendu' | 'recu' | 'refuse' | 'annule'

export interface SortieStock {
  mouvementId: number
  /** AAAA-MM-JJ HH:MM:SS. */
  horodatage: string
  produitId: number
  produit: string
  unite: string
  type: TypeMouvement
  /** « Défectueux ou casse : boîtes bombées »… */
  motif: string | null
  /** Quantité sortie, positive, en unités de base. */
  quantite: number
  lot: string | null
  /** Quantité × coût du mouvement (CUMP), FCFA. */
  valeur: number
  utilisateur: string
  retour: { id: number; fournisseur: string; montantAttendu: number; statut: StatutAvoir } | null
  /** Annulée par contre-passation : motif de l'annulation, sinon null. */
  motifAnnulation: string | null
}

export interface ContratStock {
  /** Lots en stock qui périment sous `peremption_seuil_jours` jours, périmés compris. Gérant. */
  'stock:peremptions': { requete: void; reponse: TableauPeremptions }
  /**
   * Retire du stock tout ou partie d'un lot : mouvement `perte_peremption` sur ce lot, motif
   * « Périmé » (et le commentaire). Au plus le restant du lot. Gérant.
   */
  'stock:retirerLot': {
    requete: { lotId: number; quantite: number; commentaire?: string | null }
    reponse: { restant: number }
  }
  /** Stock de tous les produits actifs, valeur, alertes, dormants. Gérant (valeur au CUMP). */
  'stock:etat': { requete: void; reponse: EtatStock }
  /**
   * Historique d'un produit sur une période (par défaut les 30 derniers jours) : « pourquoi il reste
   * 41 boîtes ». Gérant.
   */
  'stock:historiqueProduit': {
    requete: { produitId: number; du?: string | null; au?: string | null }
    reponse: HistoriqueProduit
  }
  /** Stock, lots et prix fournisseurs d'un produit, pour préparer une sortie. Gérant. */
  'stock:ficheSortie': { requete: { produitId: number }; reponse: FicheSortie }
  /**
   * Sortie de stock (REGLES_METIER § 8) : un mouvement chiffré au CUMP ; avec un retour
   * fournisseur, mouvement `retour_fournisseur` et avoir attendu. Gérant.
   */
  'stock:enregistrerSortie': {
    requete: SaisieSortie
    reponse: { mouvementId: number; retourId: number | null; montantAttendu: number | null }
  }
  /** Sorties d'une période (30 derniers jours par défaut), les plus récentes d'abord. Gérant. */
  'stock:sorties': { requete: { du?: string | null; au?: string | null }; reponse: SortieStock[] }
  /**
   * Annule une sortie par contre-passation (motif obligatoire, journalisé). Avec un retour, l'avoir
   * doit être encore attendu : il passe à « annulé ». Gérant.
   */
  'stock:annulerSortie': { requete: { mouvementId: number; motif: string }; reponse: void }
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
