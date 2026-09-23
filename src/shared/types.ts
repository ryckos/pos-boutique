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
}

export interface ProduitStock {
  id: number
  nom: string
  unite: string
  stockActuel: number
  seuilAlerte: number
  valeurStock: number
  enAlerte: boolean
}

/** Ce que l'écran client (11,6″) affiche. */
export interface LignePanierClient {
  designation: string
  quantite: number
  total: number
}

export interface PanierClient {
  lignes: LignePanierClient[]
  total: number
  message?: string
}
