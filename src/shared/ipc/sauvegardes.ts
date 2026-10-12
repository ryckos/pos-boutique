/**
 * Propriétaire : Dev B. Sauvegardes de la base (B16, REGLES_METIER § 14).
 * Les sauvegardes sont des fichiers, pas des lignes en base : la liste est lue dans le dossier.
 */

/** Pourquoi la sauvegarde a été faite (dernier mot du nom du fichier). */
export type MotifSauvegarde = 'cloture' | 'mise_a_jour' | 'demarrage' | 'manuelle' | 'avant_restauration'

export interface Sauvegarde {
  /** Nom du fichier, ex. « boutique_2026-10-12_183005_cloture.db ». Sert d'identifiant. */
  nom: string
  /** « AAAA-MM-JJ HH:MM:SS », heure locale. */
  date: string
  motif: MotifSauvegarde
  /** Taille en octets. */
  taille: number
}

/**
 * Résultat de la copie sur la clé : `faite` ; `non_reglee` (aucun dossier choisi) ; `absente` (clé non
 * branchée) ; `echec` (clé pleine, protégée en écriture…). Seule `faite` met la clé à jour.
 */
export type CopieExterne = 'faite' | 'non_reglee' | 'absente' | 'echec'

export interface ResultatSauvegarde {
  sauvegarde: Sauvegarde
  copieExterne: CopieExterne
}

export interface EtatSauvegardes {
  /** null si aucune sauvegarde n'existe encore. */
  derniere: Sauvegarde | null
  /** Vrai si la dernière sauvegarde a plus de 2 jours, ou s'il n'y en a aucune. */
  enRetard: boolean
  /** Dossier choisi pour la clé USB ; null s'il n'est pas réglé. */
  dossierExterne: string | null
  /** Vrai si ce dossier existe en ce moment (clé branchée). */
  dossierExternePresent: boolean
  /** Dernier échec d'une sauvegarde automatique depuis le démarrage, en français ; null sinon. */
  dernierEchec: string | null
}

export interface ContratSauvegardes {
  /** Gérant. */
  'sauvegardes:etat': { requete: void; reponse: EtatSauvegardes }
  /** Gérant. Les plus récentes d'abord. */
  'sauvegardes:liste': { requete: void; reponse: Sauvegarde[] }
  /** Gérant : « Sauvegarder maintenant ». Attend la fin de la sauvegarde (quelques secondes). */
  'sauvegardes:creer': { requete: void; reponse: ResultatSauvegarde }
}
