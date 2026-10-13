/**
 * Propriétaire : Dev A.
 *
 * Canaux de la caisse : session, vente, ticket (A2, A3), clôture et rapports X / Z (A4),
 * mouvements de caisse (A8). Voir docs/DEV_A_COMPTOIR.md.
 */
import type { MotifMouvementCaisse, MotifSaisiAuTiroir, SensMouvementCaisse } from '../caisse'

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
  /** `remise` : remise sur la ligne en FCFA (règle 6.6), absente = 0. */
  lignes: { conditionnementId: number; quantite: number; remise?: number }[]
  /** Remise sur le ticket entier en FCFA, absente = 0. */
  remiseGlobale?: number
  paiements: { mode: ModePaiementCaisse; montant: number; reference?: string }[]
  /** Espèces données par le client (≥ la part payée en espèces). Absent : montant exact. */
  montantRecu?: number
  /**
   * Remises au-delà du plafond de la caissière : jeton remis par `caisse:autoriserRemise`. La vente
   * reste au nom de la caissière ; le journal note le gérant.
   */
  jetonRemise?: string
}

/** Le gérant tape son code sur la caisse pour autoriser jusqu'à `montant` F de remises sur le ticket. */
export interface RequeteAccordRemise {
  utilisateurId: number
  code: string
  montant: number
}

/** Accord à usage unique, valable pour la caissière connectée et jusqu'à `montantMax`. */
export interface AccordRemiseDonne {
  jeton: string
  /** Nom du gérant, affiché sur le ticket en cours. */
  gerant: string
  montantMax: number
}

/**
 * Une ligne retirée du ticket avant encaissement (journal `annulation_ligne`, règle 6.6). Désignation
 * et prix sont relus en base.
 */
export interface LigneAnnulee {
  conditionnementId: number
  quantite: number
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
  /**
   * Produits suivis en péremption dont une part est sortie sans lot alors qu'un lot périmé a encore du
   * stock (A9) : la boîte vendue vient peut-être de ce lot. Jamais bloquant ; l'écran le signale.
   */
  alertesPeremption: { produitId: number; designation: string; lots: string[] }[]
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

/** Un mouvement de caisse tel que la liste de la caisse l'affiche. */
export interface MouvementCaisse {
  id: number
  sessionId: number
  sens: SensMouvementCaisse
  motif: MotifMouvementCaisse
  /** Ex : « Apport (monnaie de la banque) », « Annulation : Retrait (erreur) ». */
  libelle: string
  montant: number
  commentaire: string | null
  /** Document à l'origine du mouvement (dépense, règlement…), sinon null. */
  documentType: string | null
  documentId: number | null
  /** Qui l'a saisi. */
  auteur: string
  /** 'AAAA-MM-JJ HH:MM:SS', heure locale. */
  horodatage: string
  /** Sur un contre-mouvement : l'id du mouvement annulé. */
  mouvementOrigineId: number | null
  /** Sur un mouvement annulé : l'id de son contre-mouvement. */
  annuleParId: number | null
}

/** Apport ou retrait saisi par le gérant (règle 6.10). */
export interface RequeteMouvementCaisse {
  /** Absent : la seule caisse ouverte. Plusieurs caisses ouvertes : le gérant choisit. */
  sessionId?: number
  /** Ignoré pour un apport (entrée) et un retrait (sortie) ; obligatoire pour « Autre ». */
  sens?: SensMouvementCaisse
  motif: MotifSaisiAuTiroir
  montant: number
  /** Motif en clair, obligatoire : « monnaie de la banque », « versement à la banque »… */
  commentaire: string
}

/** Le mouvement est enregistré même si le tiroir n'a pas pu s'ouvrir (imprimante en panne). */
export interface MouvementEnregistre {
  mouvement: MouvementCaisse
  tiroirOuvert: boolean
}

/** Le gérant tape son code sur la caisse de la caissière (annulation d'un ticket, A6). */
export interface AutorisationGerant {
  utilisateurId: number
  code: string
}

/** Un ticket tel que la fenêtre d'annulation le montre (A6). */
export interface TicketConsulte {
  venteId: number
  numeroTicket: string
  horodatage: string
  caissier: string
  totalTtc: number
  lignes: { designation: string; quantite: number; totalLigne: number }[]
  /** Paiements d'origine (sans les paiements inverses d'une annulation). */
  paiements: { mode: string; montant: number; reference: string | null }[]
  /** Part payée en espèces : ce qu'on rend au client si on annule. */
  especesARendre: number
  statut: 'terminee' | 'annulee'
  motifAnnulation: string | null
  /** Pourquoi la personne connectée ne peut pas l'annuler ; null si elle le peut. */
  raisonRefus: string | null
}

export interface RequeteAnnulation {
  numeroTicket: string
  motif: string
  /** Caissière : le code du gérant. Absent pour un gérant connecté. */
  autorisation?: AutorisationGerant
}

export interface ResultatAnnulation {
  venteId: number
  numeroTicket: string
  /** Espèces à rendre au client (la part payée en espèces). */
  especesARendre: number
  /** Mobile money à renvoyer au client, avec la référence d'origine. */
  autresARendre: { mode: string; montant: number; reference: string | null }[]
  /** Le tiroir s'est-il ouvert (seulement s'il y a des espèces à rendre) ? */
  tiroirOuvert: boolean
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
  /** Gérants et admins actifs : ceux qui peuvent autoriser une remise au-delà du plafond. */
  'caisse:gerants': { requete: void; reponse: { id: number; nom: string }[] }
  /** Vérifie le code du gérant (verrouillage de la connexion) et remet un accord à usage unique. */
  'caisse:autoriserRemise': { requete: RequeteAccordRemise; reponse: AccordRemiseDonne }
  /**
   * Journalise une ligne supprimée, ou toutes les lignes d'un ticket abandonné, avant encaissement.
   * `abandon` : le ticket entier a été vidé. Rien n'est enregistré si la liste est vide.
   */
  'caisse:journaliserAnnulationLigne': {
    requete: { lignes: LigneAnnulee[]; abandon: boolean }
    reponse: void
  }
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
  /** Gérant : les mouvements d'une session, du plus ancien au plus récent. Absent : la seule ouverte. */
  'caisse:mouvementsSession': { requete: { sessionId?: number }; reponse: MouvementCaisse[] }
  /** Gérant : apport ou retrait, puis ouverture du tiroir HORS transaction. */
  'caisse:enregistrerMouvement': { requete: RequeteMouvementCaisse; reponse: MouvementEnregistre }
  /**
   * Gérant : annule un apport, un retrait ou un « Autre » par un contre-mouvement, puis ouvre le
   * tiroir. Les mouvements nés d'un document s'annulent depuis ce document.
   */
  /** Un ticket par son numéro, et si la personne connectée peut l'annuler (A6). */
  'caisse:consulterTicket': { requete: { numeroTicket: string }; reponse: TicketConsulte }
  /**
   * Annule un ticket d'une caisse ouverte (gérant, ou caissière avec le code du gérant), puis ouvre
   * le tiroir HORS transaction s'il y a des espèces à rendre.
   */
  'caisse:annulerTicket': { requete: RequeteAnnulation; reponse: ResultatAnnulation }
  'caisse:annulerMouvement': {
    requete: { mouvementId: number; motif: string }
    reponse: MouvementEnregistre
  }
}
