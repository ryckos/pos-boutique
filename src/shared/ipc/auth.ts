/** Propriétaire : Dev B. */
import type { UtilisateurConnecte } from '../types'

export interface ContratAuth {
  'auth:connexion': { requete: { pin: string }; reponse: UtilisateurConnecte }
  'auth:deconnexion': { requete: void; reponse: void }
  'auth:utilisateurCourant': { requete: void; reponse: UtilisateurConnecte | null }
}
