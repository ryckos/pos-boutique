/**
 * Propriétaire : Dev A.
 *
 * Canaux de la caisse : session, vente, ticket (A2, A3), clôture et rapports X / Z (A4),
 * mouvements de caisse (A8), ventes d'une période (A14). Voir docs/DEV_A_COMPTOIR.md.
 */
import type { MotifMouvementCaisse, MotifSaisiAuTiroir, SensMouvementCaisse } from '../caisse'
import type { LigneRetournable, ModeRemboursement, MotifRetour, SortRetour } from '../retour'
import type { ArticleCatalogue } from '../types'
import type { PeriodeRapport } from './rapports-gestion'

/** Modes encaissés au comptoir (argent reçu). */
export type ModePaiementCaisse = 'especes' | 'tmoney' | 'flooz'

/**
 * Modes d'une vente : ceux du comptoir, plus la part laissée à crédit à un client et la part payée par
 * avoir en boutique (A11). Ces deux dernières exigent un `clientId`.
 */
export type ModePaiementVente = ModePaiementCaisse | 'credit' | 'avoir'

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
  paiements: { mode: ModePaiementVente; montant: number; reference?: string }[]
  /** Espèces données par le client (≥ la part payée en espèces). Absent : montant exact. */
  montantRecu?: number
  /** Client de la vente ; obligatoire avec un paiement `credit` ou `avoir` (A11). */
  clientId?: number
  /** Échéance de la part à crédit, 'AAAA-MM-JJ' ; absente = dans 30 jours (DELAI_CREDIT_JOURS). */
  echeance?: string
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
  /** Part laissée à crédit (A11), null sans crédit. */
  credit: { client: string; montant: number; echeance: string; encoursApres: number } | null
  /** Part payée par avoir en boutique (A11, § 7.2), null sinon. */
  avoir: { client: string; montant: number; soldeApres: number } | null
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
  /** Ventes par mode de paiement (tickets terminés, sans les retours). Crédit : 0 jusqu'à A11. */
  totauxParMode: { especes: number; tmoney: number; flooz: number; credit: number; avoir: number }
  totalVentes: number
  /** Retours client remboursés sur cette caisse (A7), montants positifs, par mode. */
  remboursements: {
    nombre: number
    especes: number
    tmoney: number
    flooz: number
    /** Rendu en avoir en boutique (A11) : rien ne sort du tiroir. */
    avoir: number
    total: number
  }
  fondOuverture: number
  ventesEspeces: number
  mouvements: LigneMouvementCaisse[]
  /** Fond + ventes en espèces − remboursements en espèces + entrées − sorties. */
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
  /** Part à crédit effacée : la créance du client est annulée (A11) ; 0 sans crédit. */
  creditAnnule: number
  /** Part payée par avoir, rendue au solde du client (A11, § 7.2) ; 0 sans avoir. */
  avoirRetabli: number
  /** Le tiroir s'est-il ouvert (seulement s'il y a des espèces à rendre) ? */
  tiroirOuvert: boolean
}

/** Une ligne du ticket d'origine, telle que la fenêtre de retour la montre (A7). */
export interface LigneTicketRetour extends LigneRetournable {
  /** `lignes_vente.id` de la ligne vendue : c'est ce que la requête de retour renvoie. */
  ligneId: number
  designation: string
  prixUnitaire: number
  /** Sur un retour complet de la ligne : ce qui reste à rendre (montantPaye − déjà rendu). */
  totalLigne: number
}

/** Le ticket d'origine d'un retour (A7). */
export interface TicketRetour {
  venteId: number
  numeroTicket: string
  horodatage: string
  caissier: string
  totalTtc: number
  lignes: LigneTicketRetour[]
  /** Paiements d'origine : le mode proposé par défaut pour le remboursement. */
  paiements: { mode: string; montant: number; reference: string | null }[]
  /** Retours déjà faits sur ce ticket : numéros R-… */
  retoursPrecedents: string[]
  /** Pourquoi on ne peut rien retourner sur ce ticket ; null si on le peut. */
  raisonRefus: string | null
  /** Ticket payé en partie par avoir : le client à créditer, le remboursement ne se fait alors qu'en avoir. */
  clientAvoir: { id: number; nom: string } | null
}

export interface RequeteRetour {
  /** Numéro complet, ou « 158 » pour T-<année>-000158. */
  numeroTicket: string
  /** Lignes rendues, en nombre de conditionnements de la ligne vendue. */
  lignes: { ligneId: number; quantite: number }[]
  motif: MotifRetour
  /** Obligatoire pour « Autre ». */
  precision?: string
  sort: SortRetour
  remboursement: { mode: ModeRemboursement; reference?: string }
  /** Remboursement en avoir : le client à qui il est destiné (A11, REGLES_METIER § 7.2). */
  clientId?: number
  /** Caissière : le code du gérant. Absent pour un gérant connecté. */
  autorisation?: AutorisationGerant
}

export interface RetourEnregistre {
  venteId: number
  /** R-AAAA-NNNNNN */
  numeroRetour: string
  numeroTicketOrigine: string
  /** Montant rendu au client, positif. */
  montant: number
  mode: ModeRemboursement
  /** L'avoir créé (remboursement en avoir), null sinon. */
  avoir: { numero: string; montant: number; client: string; soldeClient: number } | null
  /** Le tiroir s'est-il ouvert (seulement pour un remboursement en espèces) ? */
  tiroirOuvert: boolean
}

/** Coordonnées du client recopiées sur une facture ou une proforma (A10). Le nom seul est obligatoire. */
export interface ClientDocument {
  nom: string
  telephone?: string
  adresse?: string
  nif?: string
}

/** Une facture (A10) : numéro F-AAAA-NNNNNN et ticket dont elle est faite. */
export interface FactureCreee {
  factureId: number
  numero: string
  numeroTicket: string
}

/** Sortie d'un document A4 : PDF enregistré où l'on veut, ou fenêtre d'impression de Windows. */
export type SortieDocument = 'enregistrer' | 'imprimer'

/** Proforma depuis le panier (A10) : les mêmes données qu'une vente, sans paiement. */
export interface RequeteProforma {
  lignes: RequeteVente['lignes']
  remiseGlobale?: number
  /** Remises au-delà du plafond de la caissière : jeton de `caisse:autoriserRemise` (non consommé). */
  jetonRemise?: string
  /** Facultatif : une proforma peut être faite pour « client de passage ». */
  client?: ClientDocument
}

export interface ProformaCreee {
  proformaId: number
  /** PF-AAAA-NNNNNN */
  numero: string
  totalTtc: number
  /** AAAA-MM-JJ */
  valideJusquAu: string
}

/** Une ligne de proforma à recharger dans le panier, avec l'article tel qu'il se vend aujourd'hui. */
export interface LigneProformaReprise {
  conditionnementId: number
  designation: string
  quantite: number
  remise: number
  /** Prix du conditionnement sur la proforma. */
  prixProforma: number
  /** L'article d'aujourd'hui ; null s'il n'est plus en vente (désactivé). */
  article: ArticleCatalogue | null
  /** Le prix du jour diffère de celui de la proforma. */
  prixChange: boolean
}

export interface ProformaReprise {
  proformaId: number
  numero: string
  horodatage: string
  valideJusquAu: string
  /** La date de validité est dépassée (la reprise reste possible, aux prix du jour). */
  expiree: boolean
  client: ClientDocument | null
  remiseGlobale: number
  totalTtc: number
  lignes: LigneProformaReprise[]
}

export interface RequeteCloture {
  /** Absent : la session ouverte de la personne connectée. Le gérant peut clôturer celle d'un autre. */
  sessionId?: number
  montantCompte: number
  /** Obligatoire si l'écart n'est pas nul. */
  commentaire?: string
}

/**
 * Ventes d'une période (A14, REGLES_METIER § 11), dates incluses. Tickets et retours au statut
 * `terminee`, chacun à sa propre date ; les montants des retours sont négatifs et viennent en moins.
 */
export interface VentesPeriode {
  du: string
  au: string
  nbTickets: number
  nbRetours: number
  /** TTC des tickets, remises déduites, FCFA. */
  ventesTtc: number
  /** TTC rendu par les retours, négatif, FCFA. */
  retoursTtc: number
  /** Ventes + retours, TTC, FCFA. */
  chiffreAffaires: number
  chiffreAffairesHt: number
  tva: number
  /** Coût des marchandises vendues, moins celui des retours, FCFA (arrondi une seule fois). */
  cout: number
  /** Marge brute = chiffre d'affaires TTC − coût (règle § 11). */
  marge: number
  /** La même sur le HT, pour information. */
  margeHt: number
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
  /** Le ticket d'origine d'un retour, ce qui reste retournable ligne par ligne (A7). */
  'caisse:consulterRetour': { requete: { numeroTicket: string }; reponse: TicketRetour }
  /**
   * Retour client sur la caisse ouverte de la personne connectée (gérant, ou caissière avec le code
   * du gérant), puis ouverture du tiroir HORS transaction si le remboursement est en espèces. Le
   * ticket de retour s'imprime ensuite par `caisse:imprimerTicket`.
   */
  'caisse:enregistrerRetour': { requete: RequeteRetour; reponse: RetourEnregistre }
  /**
   * Facture A4 d'un ticket encaissé (A10), une par ticket : ni vente, ni stock, ni caisse. Refus si le
   * ticket est annulé, entièrement retourné ou déjà facturé.
   */
  'caisse:facturer': { requete: { numeroTicket: string; client: ClientDocument }; reponse: FactureCreee }
  /** La facture d'un ticket (numéro complet ou court), ou par son propre numéro F-… ; null s'il n'y en a pas. */
  'caisse:trouverFacture': { requete: { numero: string }; reponse: FactureCreee | null }
  /**
   * PDF de la facture, enregistré ou imprimé, HORS transaction. La première sortie réussie de chaque
   * sorte est l'original ; les suivantes portent « COPIE ». `fait` = false si l'utilisateur a annulé.
   */
  'caisse:editerFacture': {
    requete: { factureId: number; sortie: SortieDocument }
    reponse: { fait: boolean; copie: boolean }
  }
  /**
   * Proforma (devis) depuis le panier : prix et TVA relus en base, ni vente, ni stock, ni paiement, pas
   * besoin de caisse ouverte. Valable 30 jours.
   */
  'caisse:creerProforma': { requete: RequeteProforma; reponse: ProformaCreee }
  /** Une proforma par son numéro (complet, ou « 12 » pour PF-<année>-000012), à reprendre dans la caisse. */
  'caisse:lireProforma': { requete: { numero: string }; reponse: ProformaReprise }
  /** PDF de la proforma, enregistré ou imprimé, HORS transaction. `fait` = false si annulé. */
  'caisse:editerProforma': {
    requete: { proformaId: number; sortie: SortieDocument }
    reponse: { fait: boolean }
  }
  /** Chiffre d'affaires et marge d'une période (gérant). Mois en cours par défaut. */
  'caisse:ventesPeriode': { requete: PeriodeRapport; reponse: VentesPeriode }
}
