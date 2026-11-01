/**
 * Types du domaine, partagés entre le processus principal et l'interface.
 * ZONE PARTAGÉE : toute modification passe par une PR relue par les deux développeurs.
 */

export type Role = 'caissier' | 'gerant' | 'admin'

export type ModePaiement = 'especes' | 'tmoney' | 'flooz' | 'carte' | 'credit' | 'autre'

/** Types de mouvements de stock — miroir exact du CHECK de la table mouvements_stock. */
export type TypeMouvement =
  | 'reception'
  | 'vente'
  | 'retour_client'
  | 'retour_fournisseur'
  | 'ajustement_inventaire'
  | 'perte_peremption'
  | 'casse'
  | 'vol'
  | 'contre_passation'

export interface UtilisateurConnecte {
  id: number
  nom: string
  role: Role
}

/**
 * Un article tel que la caisse le voit : UN conditionnement d'UN produit.
 * C'est ce que renvoie un scan de code-barres ou un bouton tactile.
 */
export interface ArticleCatalogue {
  conditionnementId: number
  produitId: number
  /** Ex : "Tomate concentrée — Carton de 24" */
  designation: string
  /** Ex : "Carton de 24" */
  conditionnement: string
  /** Nombre d'unités de base contenues (ex : 24). C'est ce qui sort du stock. */
  quantiteBase: number
  /** Prix de vente TTC du conditionnement, en FCFA entiers. */
  prixVente: number
  tauxTva: number
  suiviPeremption: boolean
  /** Coût d'achat d'UN conditionnement (CUMP × quantiteBase), pour la marge. */
  coutConditionnement: number
  codeBarres: string | null
  codePlu: string | null
  /**
   * Rayon du produit (catégorie de premier niveau : « Alimentation » pour un produit rangé dans
   * « Alimentation › Conserves »), pour les onglets de la grille. null si le produit n'est pas classé.
   * Toujours renseigné par les canaux catalogue:* ; optionnel pour ne pas casser les objets de test.
   */
  categorie?: string | null
  /**
   * Promotion appliquée par la caisse (A16) : `prixVente` est alors le prix promotionnel et `prixNormal`
   * celui du catalogue. Jamais renseigné par le catalogue lui-même ; le service refait ce calcul en base.
   */
  prixNormal?: number
  promotion?: { id: number; nom: string }
}

/** Ce que l'écran client (11,6″) affiche. */
export interface LignePanierClient {
  designation: string
  quantite: number
  /** Remise déduite. */
  total: number
  /** Remise sur la ligne (A5), affichée au client. */
  remise?: number
  /** Promotion en cours sur cette ligne (A16) : nom et total qu'elle coûterait au prix normal. */
  promotion?: { nom: string; totalNormal: number }
}

export interface PanierClient {
  lignes: LignePanierClient[]
  /** Remise sur le ticket entier (A5). */
  remiseTicket?: number
  total: number
  message?: string
  /** Nom de la boutique, ajouté par le processus principal (paramètre `boutique_nom`). */
  boutique?: string
  /** Présent juste après un encaissement : l'écran montre « Merci » et la monnaie quelques secondes. */
  fin?: FinVenteClient
}

/** Ce que le client voit à la fin de sa vente (A13, UI_UX § 5.5). */
export interface FinVenteClient {
  total: number
  /** Espèces remises par le client, absent en mobile money ou à crédit. */
  recu?: number
  monnaieRendue: number
  /** Part laissée à crédit et date limite (AAAA-MM-JJ). */
  credit?: { montant: number; echeance: string }
}
