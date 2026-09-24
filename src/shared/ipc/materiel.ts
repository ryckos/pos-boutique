/** Propriétaire : Dev A. Imprimante, tiroir-caisse, écran client. */

export type MethodeImpression = 'spooler' | 'share'
export type PageDeCodes = 'cp437' | 'cp858' | 'cp1252'

export interface CibleImprimante {
  methode: MethodeImpression
  /** Nom de l'imprimante Windows (spooler) ou nom de partage (share). */
  cible: string
  pageDeCodes: PageDeCodes
}

export interface ContratMateriel {
  'materiel:imprimantes': { requete: void; reponse: string[] }
  /**
   * Réglages de l'imprimante, gardés dans un fichier local tant que `parametres:*` (Dev B, B5)
   * n'est pas livré. Lecture : toute personne connectée ; écriture : gérant, journalisée.
   */
  'materiel:lireReglages': { requete: void; reponse: CibleImprimante }
  'materiel:enregistrerReglages': { requete: CibleImprimante; reponse: CibleImprimante }
  'materiel:ticketTest': { requete: CibleImprimante; reponse: void }
  'materiel:ouvrirTiroir': { requete: Omit<CibleImprimante, 'pageDeCodes'>; reponse: void }
  'materiel:ouvrirEcranClient': { requete: void; reponse: { secondEcran: boolean } }
}
