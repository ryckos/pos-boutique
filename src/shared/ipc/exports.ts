/**
 * Propriétaire : Dev B. Exports Excel (B15, REGLES_METIER § 11.2).
 * Un écran exporte ce qu'il affiche, filtres compris : il envoie son tableau, le principal écrit le
 * fichier. Canal générique, utilisable par tous les écrans (Dev A compris).
 */

/**
 * `texte` : tel quel, jamais interprété (un code-barres garde ses zéros, « =… » n'est pas une formule) ;
 * `nombre` : quantité ; `montant` : FCFA entiers, affichés « 1 000 F » ; `date` : « AAAA-MM-JJ » ou
 * « AAAA-MM-JJ HH:MM:SS », écrite en vraie date Excel.
 */
export type TypeColonneExport = 'texte' | 'nombre' | 'montant' | 'date'

export interface ColonneExport {
  titre: string
  type: TypeColonneExport
  /** Largeur en caractères ; calculée sur le contenu si absente. */
  largeur?: number
}

export interface FeuilleExport {
  /** Nom de l'onglet ; raccourci à 31 caractères et nettoyé par le principal. */
  nom: string
  colonnes: ColonneExport[]
  /** Une valeur par colonne ; null = cellule vide. */
  lignes: (string | number | null)[][]
}

export interface DemandeExport {
  /** Nom proposé, sans dossier ; « .xlsx » ajouté s'il manque. Ex. « Pertes_2026-10-01_2026-10-09 ». */
  nomFichier: string
  /** Première ligne de chaque feuille, suivie de « exporté le … par … ». Ex. « Pertes du 01/10/2026 au 09/10/2026 ». */
  titre: string
  feuilles: FeuilleExport[]
}

export interface ContratExports {
  /** Ouvre « Enregistrer sous » ; `enregistre: false` si la personne annule. Toute session connectée. */
  'exports:excel': { requete: DemandeExport; reponse: { enregistre: boolean } }
}
