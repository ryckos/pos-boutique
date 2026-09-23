/** Canaux système. ZONE PARTAGÉE. */
export interface ContratSysteme {
  'systeme:infos': {
    requete: void
    reponse: { version: string; electron: string; cheminBase: string; modeDev: boolean }
  }
}
