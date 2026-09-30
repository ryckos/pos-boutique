/** Propriétaire : Dev B. Fiches fournisseurs (B7). */

export interface Fournisseur {
  id: number
  nom: string
  contact: string | null
  telephone: string | null
  adresse: string | null
  /** Délai accordé pour payer une réception, en jours ; 0 = comptant. */
  delaiPaiementJours: number
  actif: boolean
  /** Réceptions − règlements, en FCFA (REGLES_METIER § 4.5). */
  soldeDu: number
  /** Date de la dernière réception (AAAA-MM-JJ HH:MM:SS), null si aucune. */
  derniereReception: string | null
}

export interface SaisieFournisseur {
  nom: string
  contact?: string | null
  telephone?: string | null
  adresse?: string | null
  delaiPaiementJours: number
}

export interface ContratFournisseurs {
  /** Actifs puis désactivés, chacun par ordre alphabétique. Gérant. */
  'fournisseurs:liste': { requete: void; reponse: Fournisseur[] }
  'fournisseurs:creer': { requete: SaisieFournisseur; reponse: { id: number } }
  'fournisseurs:modifier': { requete: SaisieFournisseur & { id: number }; reponse: void }
  /** Motif obligatoire, journalisé ; refusée tant que le fournisseur a un solde dû. Gérant. */
  'fournisseurs:desactiver': { requete: { id: number; motif: string }; reponse: void }
}
