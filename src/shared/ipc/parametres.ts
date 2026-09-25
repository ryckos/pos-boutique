/**
 * Propriétaire : Dev B. Paramètres de la boutique (table `parametres`, clés dans REGLES_METIER § 13).
 * Consommé par Dev A : en-tête et pied du ticket, réglages de l'imprimante, plafond de remise.
 */
import type { MethodeImpression } from './materiel'

/**
 * Les paramètres, défauts déjà appliqués et nombres déjà convertis : l'appelant n'a aucune clé
 * à connaître. `null` = pas encore renseigné et sans défaut (à l'appelant de décider quoi faire).
 */
export interface ParametresBoutique {
  /** En-tête du ticket. */
  boutiqueNom: string | null
  boutiqueAdresse: string | null
  /** Numéro d'identification fiscale (factures). */
  boutiqueNif: string | null
  /** Pied du ticket. Défaut : « Merci de votre visite ! ». */
  ticketPied: string
  /** Taux proposé à la création d'un produit : 18 ou 0. */
  tvaDefaut: number
  /** Remise maximale sans gérant, en FCFA. `null` tant que la cliente n'a pas tranché (D-A3). */
  plafondRemiseCaissier: number | null
  /** Horizon du tableau des péremptions, en jours. Défaut : 15. */
  peremptionSeuilJours: number
  /** Seuil des produits dormants, en jours. Défaut : 60. */
  dormantJours: number
  /** Défaut : 'spooler'. */
  imprimanteMethode: MethodeImpression
  /** Nom de l'imprimante Windows ou du partage. */
  imprimanteCible: string | null
  /** Page de codes validée en Phase 0. `null` tant qu'elle n'est pas reportée (D-A2). */
  imprimantePageCodes: string | null
}

export interface ContratParametres {
  /** Tous les rôles (la caissière imprime des tickets). */
  'parametres:lire': { requete: void; reponse: ParametresBoutique }
  /**
   * Enregistre les paramètres fournis (les autres ne bougent pas), tout ou rien, et renvoie les
   * paramètres à jour. Admin ; le gérant peut aussi modifier les trois champs `imprimante*`.
   * `null` efface la valeur (retour au défaut). Chaque changement est journalisé.
   */
  'parametres:ecrire': { requete: Partial<ParametresBoutique>; reponse: ParametresBoutique }
}
