/** Propriétaire : Dev B. Inventaires (B12, REGLES_METIER § 9). */
import type { MotifEcart, StatutInventaire } from '../inventaires'
import type { ConditionnementComptage } from './stock'

export type TypeInventaire = 'total' | 'partiel'

export interface ResumeInventaire {
  id: number
  /** INV-2026-000007. */
  numero: string
  type: TypeInventaire
  /** Rayon compté (inventaire partiel), null pour un inventaire total. */
  rayon: string | null
  statut: StatutInventaire
  /** AAAA-MM-JJ HH:MM:SS. */
  dateDebut: string
  dateValidation: string | null
  ouvertPar: string
  validePar: string | null
  nbComptes: number
  /** Inventaire validé : manquants au CUMP, FCFA (positif). Sinon null. */
  demarque: number | null
  motifAnnulation: string | null
}

/** Un conditionnement compté, tel que gardé dans `detail_comptage`. */
export interface PartComptage {
  conditionnementId: number
  conditionnement: string
  nombre: number
}

export interface LigneInventaire {
  produitId: number
  /** Stock calculé au moment du comptage, en unités de base. */
  quantiteTheorique: number
  /** Total compté converti en unités de base. */
  quantiteComptee: number
  /** comptée − théorique (colonne générée). */
  ecart: number
  detail: PartComptage[]
  motif: MotifEcart | null
  commentaire: string | null
  /** AAAA-MM-JJ HH:MM:SS. */
  compteLe: string
  /** Écart × CUMP, FCFA (négatif = manquant) : estimation tant que l'inventaire est en cours. */
  valeurEcart: number
}

export interface ProduitInventaire {
  produitId: number
  nom: string
  rayon: string | null
  unite: string
  /** Stock actuel, en unités de base (le théorique photographié est dans `ligne`). */
  stock: number
  cump: number
  /** Conditionnements actifs, du plus grand au plus petit. */
  conditionnements: ConditionnementComptage[]
  /** Comptage enregistré, null si pas encore compté. */
  ligne: LigneInventaire | null
}

export interface LigneDemarque {
  produitId: number
  produit: string
  unite: string
  /** Écart ajusté, en unités de base. */
  ecart: number
  /** CUMP au moment de la validation. */
  cump: number
  /** Écart × CUMP, FCFA (négatif = manquant). */
  valeur: number
  motif: MotifEcart | null
  commentaire: string | null
}

/** Rapport de démarque d'un inventaire validé (REGLES_METIER § 9). */
export interface RapportDemarque {
  /** Les écarts non nuls, du plus coûteux au moins coûteux. */
  lignes: LigneDemarque[]
  /** Valeur des manquants, FCFA (positif) : 2 savons × 150 → 300. */
  manquants: number
  /** Valeur des surplus, FCFA (positif). */
  surplus: number
  /** surplus − manquants, FCFA. */
  net: number
}

export interface InventaireDetail extends ResumeInventaire {
  /**
   * En cours : tous les produits actifs du périmètre, comptés ou non. Validé ou annulé : seulement
   * les produits comptés.
   */
  produits: ProduitInventaire[]
  /** Produits du périmètre pas encore comptés (en cours seulement, sinon 0). */
  nbNonComptes: number
  /** Inventaire validé seulement. */
  rapport: RapportDemarque | null
}

export interface SaisieComptage {
  inventaireId: number
  produitId: number
  /** Nombre compté par conditionnement ; converti en unités de base par le service. */
  comptage: Array<{ conditionnementId: number; nombre: number }>
  /** Obligatoire si l'écart n'est pas nul. */
  motif?: MotifEcart | null
  commentaire?: string | null
}

export interface ContratInventaires {
  /** Ouvre un inventaire total ou d'un rayon (sous-rayons compris) ; un seul en cours. Gérant. */
  'inventaires:ouvrir': {
    requete: { type: TypeInventaire; categorieId?: number | null }
    reponse: InventaireDetail
  }
  /** L'inventaire en cours, avec ses produits, ou null. Gérant. */
  'inventaires:enCours': { requete: void; reponse: InventaireDetail | null }
  'inventaires:detail': { requete: { id: number }; reponse: InventaireDetail }
  /** Tous les inventaires, le plus récent d'abord. Gérant. */
  'inventaires:liste': { requete: void; reponse: ResumeInventaire[] }
  /**
   * Enregistre aussitôt le comptage d'un produit (théorique photographié à cet instant) ; un
   * recomptage remplace le précédent. Gérant.
   */
  'inventaires:compter': { requete: SaisieComptage; reponse: LigneInventaire }
  /**
   * Valide : un ajustement par écart au CUMP (manquant pris sur les lots les plus anciens), puis
   * l'inventaire est figé. Les produits non comptés ne bougent pas. Gérant.
   */
  'inventaires:valider': { requete: { id: number }; reponse: RapportDemarque }
  /** Annule un inventaire en cours, sans mouvement (motif obligatoire, journalisé). Gérant. */
  'inventaires:annuler': { requete: { id: number; motif: string }; reponse: void }
}
