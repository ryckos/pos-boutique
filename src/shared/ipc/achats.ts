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
  /** Commande livrée par cette réception ; son statut est recalculé (REGLES_METIER § 4.7). */
  commandeId?: number | null
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
  /** Numéro de la commande livrée, null pour une réception sans commande. */
  commande?: string | null
  lignes: LigneReception[]
}

/** Une ligne de la liste des réceptions validées. */
export type ResumeReception = Omit<Reception, 'lignes' | 'commentaire' | 'fournisseurId'> & {
  nbLignes: number
}

// ─── Commandes fournisseur (REGLES_METIER § 4.7) ──────────────────────────────

export type StatutCommande = 'brouillon' | 'envoyee' | 'recue_partiel' | 'recue' | 'annulee'

export interface SaisieLigneCommande {
  conditionnementId: number
  /** Nombre de conditionnements commandés (3 cartons). */
  quantite: number
  /** Prix prévu d'UN conditionnement, en FCFA ; null = non indiqué. */
  prix: number | null
}

export interface SaisieCommande {
  fournisseurId: number
  commentaire?: string | null
  lignes: SaisieLigneCommande[]
}

export interface LigneCommande {
  produitId: number
  conditionnementId: number
  produit: string
  conditionnement: string
  /** Unité de base du produit : 'piece', 'kg'… */
  unite: string
  /** Unités de base dans un conditionnement (24 pour un carton de 24). */
  quantiteCond: number
  quantite: number
  prix: number | null
  /** Total prévu de la ligne, null si le prix n'est pas indiqué. */
  total: number | null
  /** En unités de base : commandé, reçu par les réceptions liées, reste (jamais négatif). */
  commandeBase: number
  recuBase: number
  resteBase: number
}

export interface Commande {
  id: number
  numero: string
  fournisseurId: number
  fournisseur: string
  statut: StatutCommande
  /** AAAA-MM-JJ. */
  dateCommande: string
  utilisateur: string
  commentaire: string | null
  /** Somme des lignes dont le prix est indiqué. */
  totalPrevu: number
  lignes: LigneCommande[]
  /** Réceptions liées, les plus anciennes d'abord. */
  receptions: { id: number; numero: string; dateReception: string; total: number }[]
}

export type ResumeCommande = Omit<Commande, 'lignes' | 'receptions' | 'commentaire'> & {
  nbLignes: number
}

/** Produit en rupture ou en stock bas, proposé pour une commande (sans quantité calculée). */
export interface ProduitEnAlerte {
  produitId: number
  produit: string
  unite: string
  stock: number
  seuil: number
  niveau: 'rupture' | 'stock_bas'
  /** Conditionnement acheté la dernière fois (tout fournisseur), sinon l'Unité. */
  conditionnementId: number
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
  /** Réceptions validées, les plus récentes d'abord (200 au plus). Gérant. */
  'achats:listeReceptions': { requete: void; reponse: ResumeReception[] }

  /** Brouillon enregistré en base, numéro CA attribué tout de suite. Gérant. */
  'achats:creerCommande': { requete: SaisieCommande; reponse: { id: number; numero: string } }
  /** Seul un brouillon se modifie ; les lignes sont remplacées. Gérant. */
  'achats:modifierCommande': { requete: SaisieCommande & { id: number }; reponse: void }
  /** brouillon → envoyee. Gérant. */
  'achats:envoyerCommande': { requete: { id: number }; reponse: void }
  /** Commande non livrée (brouillon ou envoyée) ; motif obligatoire, journalisé. Gérant. */
  'achats:annulerCommande': { requete: { id: number; motif: string }; reponse: void }
  /** Commande reçue en partie dont le reste ne viendra pas → recue ; motif journalisé. Gérant. */
  'achats:cloturerCommande': { requete: { id: number; motif: string }; reponse: void }
  'achats:commande': { requete: { id: number }; reponse: Commande }
  /** Toutes les commandes, les plus récentes d'abord (200 au plus). Gérant. */
  'achats:listeCommandes': { requete: void; reponse: ResumeCommande[] }
  /** Commandes envoyées ou reçues en partie d'un fournisseur, à lier à une réception. Gérant. */
  'achats:commandesOuvertes': { requete: { fournisseurId: number }; reponse: ResumeCommande[] }
  /** Produits actifs en rupture ou en stock bas (v_alertes_stock), les ruptures d'abord. Gérant. */
  'achats:produitsEnAlerte': { requete: void; reponse: ProduitEnAlerte[] }
}
