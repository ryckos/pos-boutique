/**
 * Propriétaire : Dev A.
 *
 * Canaux de la caisse. Prévus ensuite : 'caisse:cloturerSession', 'caisse:rapportX' (A4).
 * Voir docs/DEV_A_COMPTOIR.md.
 */

/** Modes acceptés à la caisse pour l'instant. Le crédit arrive avec la fiche client (A11). */
export type ModePaiementCaisse = 'especes' | 'tmoney' | 'flooz'

export interface SessionCaisse {
  id: number
  /** Espèces déclarées à l'ouverture, en FCFA. */
  fondOuverture: number
  /** 'AAAA-MM-JJ HH:MM:SS', heure locale. */
  dateOuverture: string
}

/** Ce que l'écran envoie : des identifiants et des quantités, jamais de prix ni de coût. */
export interface RequeteVente {
  lignes: { conditionnementId: number; quantite: number }[]
  paiements: { mode: ModePaiementCaisse; montant: number; reference?: string }[]
  /** Espèces données par le client (≥ la part payée en espèces). Absent : montant exact. */
  montantRecu?: number
}

export interface VenteEnregistree {
  venteId: number
  numeroTicket: string
  totalTtc: number
  monnaieRendue: number
  /**
   * Produits dont le stock calculé devient négatif. La vente n'est jamais bloquée (décision en
   * attente D-A1) : l'écran affiche une alerte.
   */
  alertesStock: { produitId: number; designation: string; stockApres: number }[]
}

export interface ContratCaisse {
  'caisse:sessionCourante': { requete: void; reponse: SessionCaisse | null }
  'caisse:ouvrirSession': { requete: { fondOuverture: number }; reponse: SessionCaisse }
  'caisse:enregistrerVente': { requete: RequeteVente; reponse: VenteEnregistree }
  /**
   * Imprime le ticket d'une vente déjà enregistrée (jamais dans la transaction de vente) et ouvre
   * le tiroir si elle comporte des espèces. Original à la première impression réussie, DUPLICATA
   * ensuite : c'est le serveur qui décide. Un échec lève une erreur, la vente reste enregistrée.
   */
  'caisse:imprimerTicket': { requete: { venteId: number }; reponse: { duplicata: boolean } }
  /** Même chose par le numéro du ticket (T-AAAA-NNNNNN). Caissière : sa session ; gérant : tous. */
  'caisse:reimprimerTicket': { requete: { numeroTicket: string }; reponse: { duplicata: boolean } }
}
