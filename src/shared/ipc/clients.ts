/**
 * Propriétaire : Dev A.
 *
 * Fiches clients et encours de crédit (A11, REGLES_METIER § 7). Voir docs/DEV_A_COMPTOIR.md.
 */

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
}
