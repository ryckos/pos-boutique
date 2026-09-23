/** Propriétaire : Dev B. Connexion en deux gestes : toucher son nom, puis taper son code (D-17). */
import type { UtilisateurConnecte } from '../types'

/** Ce que l'écran de connexion affiche d'un compte : son nom, rien d'autre. */
export interface CompteConnexion {
  id: number
  nom: string
}

/**
 * Code juste : la session est ouverte. Code provisoire (fixé par l'admin) : aucune session,
 * la personne doit d'abord choisir son code avec `auth:definirCodePersonnel`.
 */
export type ResultatConnexion = { utilisateur: UtilisateurConnecte } | { codeProvisoire: true }

export interface ContratAuth {
  /** Comptes actifs, par nom. Appelé avant toute connexion. */
  'auth:comptesConnexion': { requete: void; reponse: CompteConnexion[] }
  /** Refusé avec « Trop de codes faux. Réessayez dans 30 s. » quand ce compte est verrouillé. */
  'auth:connexion': { requete: { utilisateurId: number; pin: string }; reponse: ResultatConnexion }
  /** Remplace le code provisoire par le code choisi par la personne, puis ouvre la session. */
  'auth:definirCodePersonnel': {
    requete: { utilisateurId: number; codeProvisoire: string; nouveauCode: string }
    reponse: UtilisateurConnecte
  }
  /** « Mon code » : la personne connectée change son propre code (l'actuel est exigé). */
  'auth:changerMonCode': { requete: { codeActuel: string; nouveauCode: string }; reponse: void }
  'auth:deconnexion': { requete: void; reponse: void }
  'auth:utilisateurCourant': { requete: void; reponse: UtilisateurConnecte | null }
  /** Temps restant du verrouillage de ce compte en ms (0 = pas verrouillé). */
  'auth:etatVerrouillage': { requete: { utilisateurId: number }; reponse: { resteMs: number } }
  /** premierDemarrage = application installée et aucun compte : afficher l'assistant. */
  'auth:etatDemarrage': { requete: void; reponse: { premierDemarrage: boolean } }
  /** Assistant de premier démarrage : crée l'admin et le connecte. Refusé si un compte existe. */
  'auth:creerPremierAdmin': { requete: { nom: string; pin: string }; reponse: UtilisateurConnecte }
}
