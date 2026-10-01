/** Propriétaire : Dev B. Réceptions de marchandise (B8). */

/** Ce qu'il faut savoir d'un conditionnement pour le recevoir. */
export interface ArticleReception {
  produitId: number
  conditionnementId: number
  produit: string
  conditionnement: string
  /** Unités de base contenues dans un conditionnement (24 pour un carton de 24). */
  quantiteBase: number
  /** Unité de base du produit : 'piece', 'kg'… ; décimales permises au poids et au volume. */
  unite: string
  /** Lot et date de péremption exigés à la réception. */
  suiviPeremption: boolean
  /** Prix de vente de l'Unité, pour l'alerte « coût ≥ prix de vente ». */
  prixUnite: number
  /** Prix proposé pour UN conditionnement : dernier prix payé, sinon prix indicatif × quantité, sinon null. */
  prixPropose: number | null
}

export interface SaisieLigneReception {
  conditionnementId: number
  /** Nombre de conditionnements reçus (3 cartons). */
  quantite: number
  /** Prix d'achat d'UN conditionnement, en FCFA (6 000 le carton). */
  prix: number
  numeroLot?: string | null
  /** AAAA-MM-JJ. */
  datePeremption?: string | null
}

export interface SaisieReception {
  fournisseurId: number
  commentaire?: string | null
  lignes: SaisieLigneReception[]
}

export interface LigneReception {
  produitId: number
  produit: string
  conditionnement: string
  quantite: number
  prix: number
  quantiteBase: number
  /** Coût par unité de base (prix / quantité du conditionnement). */
  coutBase: number
  total: number
  numeroLot: string | null
  datePeremption: string | null
}

export interface Reception {
  id: number
  numero: string
  fournisseurId: number
  fournisseur: string
  /** AAAA-MM-JJ HH:MM:SS. */
  dateReception: string
  /** AAAA-MM-JJ ; null pour une réception antérieure au suivi des échéances. */
  dateEcheance: string | null
  total: number
  utilisateur: string
  commentaire: string | null
  lignes: LigneReception[]
}

export interface ContratAchats {
  /** Conditionnement actif d'un produit actif, sinon null. Gérant. */
  'achats:articleReception': { requete: { conditionnementId: number }; reponse: ArticleReception | null }
  /**
   * Une seule transaction : lignes, lots, mouvements `reception`, CUMP, dette et numéro RC
   * (REGLES_METIER § 4.2). Gérant.
   */
  'achats:validerReception': {
    requete: SaisieReception
    reponse: { id: number; numero: string; total: number; dateEcheance: string }
  }
  'achats:reception': { requete: { id: number }; reponse: Reception }
}
