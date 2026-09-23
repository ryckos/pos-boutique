/** Propriétaire : Dev B. Gestion des comptes — tous les canaux sont réservés à l'admin. */
import type { Role } from '../types'

export interface CompteUtilisateur {
  id: number
  nom: string
  role: Role
  actif: boolean
  /** Code donné par l'admin, pas encore remplacé par la personne. */
  codeProvisoire: boolean
  /** Date de création, heure locale (« AAAA-MM-JJ HH:MM:SS »). */
  creeLe: string
}

export interface ContratUtilisateurs {
  /** Tous les comptes, actifs d'abord. */
  'utilisateurs:lister': { requete: void; reponse: CompteUtilisateur[] }
  /** Le code donné est provisoire : la personne choisit le sien à sa première connexion. */
  'utilisateurs:creer': { requete: { nom: string; pin: string; role: Role }; reponse: { id: number } }
  /** Code oublié : nouveau code provisoire, compte débloqué. Pas sur son propre compte. */
  'utilisateurs:reinitialiserCode': { requete: { id: number; pin: string }; reponse: void }
  'utilisateurs:changerRole': { requete: { id: number; role: Role }; reponse: void }
  /** Jamais de suppression : le compte est désactivé, avec un motif obligatoire. */
  'utilisateurs:desactiver': { requete: { id: number; motif: string }; reponse: void }
}
