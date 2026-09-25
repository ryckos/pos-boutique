/** Propriétaire : Dev B. Consommé par Dev A (écran de caisse). */
import type { AlertePrix } from '../catalogue'
import type { ArticleCatalogue, ProduitStock } from '../types'

/** Rayon (parentId null) ou sous-rayon d'un rayon. Un seul niveau de sous-catégorie. */
export interface Categorie {
  id: number
  nom: string
  parentId: number | null
  actif: boolean
  /** Produits actifs rangés directement dans cette catégorie. */
  nbProduits: number
}

/** Unité de base du produit : ce en quoi s'expriment son stock, son seuil et son CUMP. */
export type UniteBase = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'paquet'

/** Ce que la caisse vend sous le nom « Unité » (×1, nom figé, toujours actif). */
export interface SaisieUnite {
  prixVente: number
  codeBarres: string | null
  codePlu: string | null
  boutonTactile: boolean
  ordreBouton: number
}

/** Lot, pack, carton… Sans `id` : à créer. La quantité d'un conditionnement existant ne change pas. */
export interface SaisieConditionnement extends SaisieUnite {
  id?: number
  nom: string
  quantiteBase: number
  actif: boolean
}

export interface SaisieProduit {
  nom: string
  categorieId: number | null
  unite: UniteBase
  /** 18 (TVA normale) ou 0 (exonéré, ex. le pain). */
  tauxTva: number
  suiviPeremption: boolean
  /** En unités de base. */
  seuilAlerte: number
  uniteVente: SaisieUnite
  conditionnements: SaisieConditionnement[]
}

export interface FicheProduit extends SaisieProduit {
  id: number
  actif: boolean
  /** Stock calculé, en unités de base (information, pour prévenir avant une désactivation). */
  stockActuel: number
  conditionnements: Array<SaisieConditionnement & { id: number }>
}

/** Une ligne de la liste « Produits ». */
export interface LigneProduit {
  id: number
  nom: string
  categorieId: number | null
  /** « Alimentation › Conserves », ou null si non classé. */
  categorie: string | null
  tauxTva: number
  prixUnite: number
  /** Conditionnements actifs, Unité comprise. */
  nbConditionnements: number
  stockActuel: number
  actif: boolean
}

/** Sort d'une ligne du fichier d'import (REGLES_METIER § 2.6). */
export type EtatLigneImport = 'a_creer' | 'cree' | 'ignoree' | 'erreur'

export interface LigneRapportImport {
  /** Numéro de la ligne dans Excel (celle des titres comprise), pour la retrouver dans le fichier. */
  ligne: number
  nom: string
  etat: EtatLigneImport
  /** Pourquoi la ligne est ignorée ou en erreur ; null sinon. */
  motif: string | null
}

/** Résultat de la vérification (rien n'est écrit) ou de l'import (tout est écrit). */
export interface RapportImport {
  nomFichier: string
  lignes: LigneRapportImport[]
  /** Produits à créer (vérification) ou créés (import). */
  nbCrees: number
  nbIgnorees: number
  nbErreurs: number
  /** Rayons et sous-rayons absents du catalogue, créés par l'import (« Boissons › Jus »). */
  nouvellesCategories: string[]
  /** true une fois l'import enregistré. */
  importe: boolean
}

export interface ContratCatalogue {
  /** LE canal du scan : code-barres OU code PLU → un conditionnement, ou null si inconnu. */
  'catalogue:rechercherCode': { requete: { code: string }; reponse: ArticleCatalogue | null }
  /** Recherche par nom (touche F2 de la caisse, écrans de gestion). */
  'catalogue:rechercher': { requete: { texte: string }; reponse: ArticleCatalogue[] }
  /** Boutons tactiles de la caisse (produits sans code-barres, lots, cartons…). */
  'catalogue:grille': { requete: void; reponse: ArticleCatalogue[] }
  /**
   * Conditionnements actifs d'un produit (« changer le conditionnement » d'une ligne du ticket) :
   * l'Unité d'abord, puis par quantité croissante. Vide si le produit est inconnu ou désactivé.
   */
  'catalogue:conditionnementsProduit': { requete: { produitId: number }; reponse: ArticleCatalogue[] }
  /** Tous les produits, désactivés compris, par nom. Gérant. */
  'catalogue:listeProduits': { requete: void; reponse: LigneProduit[] }
  /** Fiche complète, conditionnements désactivés compris. Gérant. */
  'catalogue:ficheProduit': { requete: { id: number }; reponse: FicheProduit }
  /** Enregistre le produit et ses conditionnements en une fois. Les alertes de prix ne bloquent pas. */
  'catalogue:creerProduit': { requete: SaisieProduit; reponse: { id: number; alertesPrix: AlertePrix[] } }
  /** Tout changement de prix de vente est journalisé (`modification_prix`). Gérant. */
  'catalogue:modifierProduit': {
    requete: SaisieProduit & { id: number }
    reponse: { alertesPrix: AlertePrix[] }
  }
  /** Jamais de suppression. Motif obligatoire, journalisé ; autorisée même s'il reste du stock. */
  'catalogue:desactiverProduit': { requete: { id: number; motif: string }; reponse: void }
  /** Prochain code interne EAN-13 à préfixe 20, jamais encore utilisé. Gérant. */
  'catalogue:genererCodeInterne': { requete: void; reponse: { code: string } }
  /** Liste des produits avec leur stock calculé. */
  'catalogue:produitsStock': { requete: void; reponse: ProduitStock[] }
  /** Rayons suivis de leurs sous-rayons, par ordre alphabétique (désactivées comprises). */
  'catalogue:categories': { requete: void; reponse: Categorie[] }
  /** Sans parentId : un rayon. Avec : un sous-rayon de ce rayon. Gérant. */
  'catalogue:creerCategorie': { requete: { nom: string; parentId?: number | null }; reponse: { id: number } }
  'catalogue:renommerCategorie': { requete: { id: number; nom: string }; reponse: void }
  /** Jamais de suppression. Refusée si la catégorie contient des produits ou sous-catégories actifs. */
  'catalogue:desactiverCategorie': { requete: { id: number }; reponse: void }
  /** Fenêtre « Enregistrer sous » puis écriture du fichier modèle. false si annulé. Gérant. */
  'catalogue:telechargerModeleImport': { requete: void; reponse: { enregistre: boolean } }
  /** Fenêtre « Ouvrir » puis analyse du fichier, sans rien écrire. null si annulé. Gérant. */
  'catalogue:verifierImport': { requete: void; reponse: RapportImport | null }
  /**
   * Importe le dernier fichier vérifié (relu et revérifié) : tout ou rien. Refusé s'il reste une
   * ligne en erreur ou s'il n'y a rien à créer. Gérant.
   */
  'catalogue:importerCatalogue': { requete: void; reponse: RapportImport }
}
