/**
 * Propriétaire : Dev A.
 *
 * Canaux de la caisse : session, vente, ticket (A2, A3), clôture et rapports X / Z (A4).
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

/** Une session ouverte, vue par le gérant qui choisit laquelle clôturer. */
export interface SessionOuverteResume extends SessionCaisse {
  utilisateurId: number
  caissier: string
}

/** Une entrée ou une sortie d'espèces hors vente (table mouvements_caisse). */
export interface LigneMouvementCaisse {
  sens: 'entree' | 'sortie'
  /** Ex : « Dépense (taxi-moto) ». */
  libelle: string
  montant: number
}

/**
 * Rapport d'une session (règle 6.9) : X tant qu'elle est ouverte, Z une fois clôturée. Tout est
 * recalculé en base ; montantCompte, ecart et commentaire sont ceux figés à la clôture.
 */
export interface RapportCaisse {
  sessionId: number
  utilisateurId: number
  caissier: string
  statut: 'ouverte' | 'fermee'
  dateOuverture: string
  dateFermeture: string | null
  nombreTickets: number
  /** Ventes par mode de paiement (tickets terminés). Crédit : 0 jusqu'à A11. */
  totauxParMode: { especes: number; tmoney: number; flooz: number; credit: number }
  totalVentes: number
  fondOuverture: number
  ventesEspeces: number
  mouvements: LigneMouvementCaisse[]
  /** Fond + ventes en espèces + entrées − sorties. */
  especesTheoriques: number
  montantCompte: number | null
  /** Compté − théorique (négatif = manque). */
  ecart: number | null
  commentaire: string | null
}

export interface RequeteCloture {
  /** Absent : la session ouverte de la personne connectée. Le gérant peut clôturer celle d'un autre. */
  sessionId?: number
  montantCompte: number
  /** Obligatoire si l'écart n'est pas nul. */
  commentaire?: string
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
  /** Gérant : toutes les sessions ouvertes, pour clôturer celle d'une caissière absente. */
  'caisse:sessionsOuvertes': { requete: void; reponse: SessionOuverteResume[] }
  /**
   * Rapport X (session ouverte) ou Z (session clôturée). Absent : la session ouverte de la personne
   * connectée. Caissière : sa session ouverte ou sa dernière session clôturée ; gérant : toutes.
   */
  'caisse:rapportSession': { requete: { sessionId?: number }; reponse: RapportCaisse }
  'caisse:cloturerSession': { requete: RequeteCloture; reponse: RapportCaisse }
  /**
   * Imprime le X (session ouverte) ou le Z (session clôturée), après la clôture et hors transaction.
   * Z : original à la première impression réussie, DUPLICATA ensuite. Un échec lève une erreur, la
   * clôture reste enregistrée.
   */
  'caisse:imprimerRapport': {
    requete: { sessionId: number; type: 'X' | 'Z' }
    reponse: { duplicata: boolean }
  }
}
