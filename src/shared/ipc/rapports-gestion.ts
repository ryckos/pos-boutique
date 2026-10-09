/** Propriétaire : Dev B. Rapports de gestion (B14, REGLES_METIER § 11). Gérant. */

/**
 * Causes de perte, dans l'ordre d'affichage. `don` = casse au libellé « Don » ; `avoir_fournisseur` =
 * avoir refusé, ou reçu en dessous de l'attendu (la différence).
 */
export type CausePerte = 'peremption' | 'casse' | 'don' | 'vol' | 'demarque_inventaire' | 'avoir_fournisseur'

/** Période d'un rapport, AAAA-MM-JJ incluses ; mois en cours par défaut. */
export interface PeriodeRapport {
  du?: string | null
  au?: string | null
}

export interface PerteCause {
  cause: CausePerte
  libelle: string
  /** FCFA. */
  valeur: number
}

export interface PerteProduit {
  cause: CausePerte
  produitId: number
  produit: string
  unite: string
  /** Unités de base sorties ; null pour un avoir manquant (c'est de l'argent, pas du stock). */
  quantite: number | null
  /** FCFA. */
  valeur: number
}

export interface RapportPertes {
  du: string
  au: string
  /** Toutes les causes, dans l'ordre de `CausePerte`, même à 0. */
  causes: PerteCause[]
  /** Par cause puis par produit, de la plus grosse valeur à la plus petite. */
  produits: PerteProduit[]
  /** Somme des causes, en FCFA. */
  total: number
  /** Surplus d'inventaire de la période (FCFA) : à part, jamais déduit des pertes. */
  surplusInventaire: number
}

export interface ValeurRayon {
  /** « Non classé » si le produit n'en a pas. */
  rayon: string
  nbProduits: number
  /** FCFA, au CUMP actuel. */
  valeur: number
}

export interface RapportValeurStock {
  /** Produits actifs, au CUMP actuel ; même total que l'écran Stock. */
  total: number
  /** De la plus grosse valeur à la plus petite. */
  rayons: ValeurRayon[]
}

export interface AchatsFournisseurPeriode {
  fournisseurId: number
  fournisseur: string
  actif: boolean
  nbReceptions: number
  /** Total des réceptions de la période, FCFA. */
  livre: number
  /** Avoirs reçus pendant la période, FCFA. */
  avoirsRecus: number
  /** Règlements non annulés de la période, FCFA. */
  regle: number
  /** Solde dû aujourd'hui (négatif = avoir à valoir), FCFA. */
  resteDu: number
}

export interface RapportAchats {
  du: string
  au: string
  /** Fournisseurs avec une opération dans la période ou un solde non nul, du plus gros livré au plus petit. */
  fournisseurs: AchatsFournisseurPeriode[]
  totalLivre: number
  totalAvoirsRecus: number
  totalRegle: number
  totalResteDu: number
}

export interface RapportResultat {
  du: string
  au: string
  /** Dépenses non annulées, FCFA. */
  depenses: number
  /** Pertes de la période (même total que `rapports:pertes`), FCFA ; pour information. */
  pertes: number
  /** Marge brute des ventes ; null tant que `caisse:ventesPeriode` (Dev A) n'est pas livré. */
  marge: number | null
  /** Marge − dépenses (REGLES_METIER § 11) ; null tant que la marge est inconnue. */
  resultat: number | null
}

export interface ContratRapportsGestion {
  'rapports:pertes': { requete: PeriodeRapport; reponse: RapportPertes }
  'rapports:valeurStock': { requete: void; reponse: RapportValeurStock }
  'rapports:achats': { requete: PeriodeRapport; reponse: RapportAchats }
  'rapports:resultat': { requete: PeriodeRapport; reponse: RapportResultat }
}
