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
  'materiel:ticketTest': { requete: CibleImprimante; reponse: void }
  'materiel:ouvrirTiroir': { requete: Omit<CibleImprimante, 'pageDeCodes'>; reponse: void }
  'materiel:ouvrirEcranClient': { requete: void; reponse: { secondEcran: boolean } }
}
