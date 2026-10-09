/** Propriétaire : Dev B. Journal des opérations (B14, REGLES_METIER § 1.4). Admin seulement. */
import type { DetailAudit } from '../audit'

export interface EntreeJournal {
  id: number
  /** AAAA-MM-JJ HH:MM:SS, heure de la boutique. */
  horodatage: string
  /** Nom de la personne connectée (pour un verrouillage : le compte visé). */
  utilisateur: string
  /** Code de l'action, pour le filtre seulement ; l'écran affiche `libelle`. */
  action: string
  libelle: string
  /** État avant l'action, en lignes lisibles ; vide si l'action n'en garde pas. */
  avant: DetailAudit[]
  /** Ce que l'action a fait (motif, nouvelle valeur…), en lignes lisibles. */
  apres: DetailAudit[]
}

export interface FiltreJournal {
  /** AAAA-MM-JJ incluses ; 7 derniers jours par défaut, jamais de fin dans le futur. */
  du?: string | null
  au?: string | null
  utilisateurId?: number | null
  action?: string | null
  /** « Afficher plus » : les entrées plus anciennes que celle-ci. */
  avantId?: number | null
}

export interface PageJournal {
  du: string
  au: string
  /** Les plus récentes d'abord, 200 au plus. */
  entrees: EntreeJournal[]
  /** D'autres entrées plus anciennes répondent au même filtre. */
  suite: boolean
}

export interface ChoixJournal {
  /** Tous les comptes, désactivés compris, par ordre alphabétique. */
  utilisateurs: { id: number; nom: string; actif: boolean }[]
  /** Les actions présentes dans le journal, par ordre alphabétique de libellé. */
  actions: { action: string; libelle: string }[]
}

export interface ContratAudit {
  'audit:journal': { requete: FiltreJournal; reponse: PageJournal }
  'audit:choix': { requete: void; reponse: ChoixJournal }
}
