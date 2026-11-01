/**
 * Propriétaire : Dev A. Promotions programmées (A16, REGLES_METIER § 5.2).
 * Le gérant gère les promotions ; la caisse (caissière comprise) ne reçoit que celles du jour.
 */
import type { TypePromotion } from '../promotions'

export type EtatPromotion = 'a_venir' | 'en_cours' | 'terminee' | 'arretee'

export interface Promotion {
  id: number
  nom: string
  type: TypePromotion
  valeur: number
  /** Une promotion vise un produit ou une catégorie. */
  produitId: number | null
  produit: string | null
  categorieId: number | null
  /** Nom du rayon, sous-rayons compris dans la promotion. */
  categorie: string | null
  /** AAAA-MM-JJ, début et fin inclus. */
  dateDebut: string
  dateFin: string
  etat: EtatPromotion
}

export interface SaisiePromotion {
  nom: string
  type: TypePromotion
  valeur: number
  produitId?: number | null
  categorieId?: number | null
  dateDebut: string
  dateFin: string
}

/** Une promotion du jour, avec les produits qu'elle touche (catégories et sous-catégories déjà résolues). */
export interface PromotionEnCours {
  id: number
  nom: string
  type: TypePromotion
  valeur: number
  produitIds: number[]
}

export interface ContratPromotions {
  /** Toutes les promotions, les plus récentes d'abord. Gérant. */
  'promotions:lister': { requete: void; reponse: Promotion[] }
  /** Promotions valables aujourd'hui (date de l'ordinateur) : la caisse en déduit les prix affichés. */
  'promotions:enCours': { requete: void; reponse: PromotionEnCours[] }
  /** Gérant, journalisé. */
  'promotions:creer': { requete: SaisiePromotion; reponse: { id: number } }
  /** Gérant, journalisé. Seulement une promotion à venir ou en cours. */
  'promotions:modifier': { requete: { id: number } & SaisiePromotion; reponse: void }
  /** Gérant, journalisé : la promotion s'arrête aujourd'hui, elle ne se supprime pas. */
  'promotions:arreter': { requete: { id: number }; reponse: void }
}
