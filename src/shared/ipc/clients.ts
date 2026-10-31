/**
 * Propriétaire : Dev A.
 *
 * Fiches clients et encours de crédit (A11, REGLES_METIER § 7). Voir docs/DEV_A_COMPTOIR.md.
 */

import type { ModeEncaissement, Tranche } from '../recouvrement'

export type StatutCreance = 'ouverte' | 'soldee' | 'annulee'

export interface Client {
  id: number
  nom: string
  telephone: string | null
  adresse: string | null
  nif: string | null
  /** FCFA ; 0 = aucun crédit autorisé. */
  plafondCredit: number
  actif: boolean
  /** Restant dû des créances non annulées, FCFA. */
  encours: number
  /** Part de l'encours dont l'échéance est dépassée, FCFA. */
  enRetard: number
  /** Solde des avoirs en boutique à dépenser, FCFA (REGLES_METIER § 7.2). */
  soldeAvoir: number
}

/** Un avoir en boutique : crédit nominatif né d'un retour client. */
export interface AvoirClient {
  id: number
  /** AV-AAAA-NNNNNN */
  numero: string
  /** 'AAAA-MM-JJ HH:MM:SS' */
  creeLe: string
  montantInitial: number
  utilise: number
  solde: number
  /** Numéro du retour (R-…) qui l'a créé. */
  numeroRetour: string
}

export interface SaisieClient {
  nom: string
  telephone?: string | null
  adresse?: string | null
  nif?: string | null
  /** Gérant seulement ; absent = 0 à la création, inchangé à la modification. */
  plafondCredit?: number
}

export interface CreanceClient {
  id: number
  venteId: number
  numeroTicket: string
  /** 'AAAA-MM-JJ HH:MM:SS' */
  creeLe: string
  montantInitial: number
  encaisse: number
  /** Réduit par un retour client sur ce ticket (A12, REGLES_METIER § 6.8). */
  reduit: number
  restantDu: number
  /** 'AAAA-MM-JJ' */
  dateEcheance: string | null
  statut: StatutCreance
  /** Échéance dépassée et restant dû > 0. */
  enRetard: boolean
}

export interface FicheClient extends Client {
  /** Les plus récentes d'abord. */
  creances: CreanceClient[]
  /** Avoirs en boutique, les plus récents d'abord (soldés compris). */
  avoirs: AvoirClient[]
}

/** Encaissement d'une créance (A12). Sans `creanceId`, la plus ancienne est payée en premier. */
export interface RequeteEncaissement {
  clientId: number
  /** Francs entiers, au plus le restant dû du client (ou de la créance choisie). */
  montant: number
  mode: ModeEncaissement
  /** Obligatoire en TMoney et Flooz. */
  reference?: string
  creanceId?: number
}

export interface PartEncaissement {
  creanceId: number
  numeroTicket: string
  montant: number
  restantApres: number
}

export interface EncaissementEnregistre {
  /** EC-AAAA-NNNNNN */
  numeroRecu: string
  client: string
  montant: number
  mode: ModeEncaissement
  parts: PartEncaissement[]
  /** Ce que le client doit encore après ce paiement, toutes créances confondues. */
  restantClient: number
  /** Le reçu est-il sorti de l'imprimante ? Faux = paiement enregistré, imprimante en panne. */
  recuImprime: boolean
  /** Le tiroir s'est-il ouvert (espèces seulement) ? */
  tiroirOuvert: boolean
}

/** Une ligne de l'historique d'un client, de la plus ancienne à la plus récente. */
export interface LigneHistoriqueClient {
  /** 'AAAA-MM-JJ HH:MM:SS' */
  date: string
  type: 'credit' | 'encaissement' | 'annulation' | 'reduction'
  /** Texte lisible : « Vente à crédit T-… », « Paiement EC-… (TMoney) »… */
  libelle: string
  /** Positif = le client doit plus ; négatif = il doit moins. */
  variation: number
  /** Ce que le client devait après cette ligne. */
  soldeApres: number
  /** Sur un encaissement : son reçu, et s'il peut encore être annulé (gérant, caisse ouverte). */
  numeroRecu: string | null
  annulable: boolean
}

export interface LigneBalanceAgee {
  clientId: number
  client: string
  telephone: string | null
  jusqu30: number
  de31a60: number
  plus60: number
  total: number
  /** Part dont l'échéance est dépassée. */
  enRetard: number
}

export interface BalanceAgee {
  lignes: LigneBalanceAgee[]
  totaux: { jusqu30: number; de31a60: number; plus60: number; total: number; enRetard: number }
}

export interface CreanceRelance {
  numeroTicket: string
  restantDu: number
  /** 'AAAA-MM-JJ' */
  dateEcheance: string
  joursRetard: number
}

/** Un client à relancer : au moins une échéance dépassée. */
export interface LigneRelance {
  clientId: number
  client: string
  telephone: string | null
  /** Restant dû des créances échues. */
  montantEchu: number
  /** Restant dû total du client. */
  total: number
  /** Retard de la créance échue la plus ancienne. */
  joursRetard: number
  tranche: Tranche
  creances: CreanceRelance[]
}

export interface ContratClients {
  /** Par nom ou téléphone ; actifs seulement, sauf `inclureInactifs` (gérant). 50 au plus. */
  'clients:rechercher': { requete: { texte?: string; inclureInactifs?: boolean }; reponse: Client[] }
  'clients:lire': { requete: { clientId: number }; reponse: FicheClient }
  /** Caissière : plafond 0 seulement. */
  'clients:creer': { requete: SaisieClient; reponse: Client }
  /** Caissière : coordonnées seulement, le plafond est réservé au gérant. */
  'clients:modifier': { requete: { clientId: number; saisie: SaisieClient }; reponse: Client }
  /** Gérant, motif obligatoire ; refusé tant que le client doit de l'argent. */
  'clients:desactiver': { requete: { clientId: number; motif: string }; reponse: void }
  /** Caissière ou gérant : paiement d'un client sur sa caisse ouverte, reçu et tiroir (espèces) HORS transaction. */
  'clients:encaisserCreance': { requete: RequeteEncaissement; reponse: EncaissementEnregistre }
  /** Gérant : annule un reçu de la caisse encore ouverte, motif obligatoire ; la dette est rétablie. */
  'clients:annulerEncaissement': { requete: { numeroRecu: string; motif: string }; reponse: void }
  /** Créances, paiements, annulations et retours d'un client, avec le solde après chaque ligne. */
  'clients:historique': { requete: { clientId: number }; reponse: LigneHistoriqueClient[] }
  /** Gérant : le restant dû de chaque client par ancienneté de la créance. */
  'clients:balanceAgee': { requete: void; reponse: BalanceAgee }
  /** Gérant : les clients dont une échéance est dépassée, du plus en retard au moins en retard. */
  'clients:listeRelance': { requete: void; reponse: LigneRelance[] }
  /** Gérant : imprime la liste de relance (imprimante en panne = erreur à afficher, rien n'est perdu). */
  'clients:imprimerRelance': { requete: void; reponse: void }
}
