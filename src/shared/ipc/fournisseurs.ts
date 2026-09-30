/** Propriétaire : Dev B. Fiches fournisseurs (B7). */
import type { ResumeReception } from './achats'

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

/** Dernier prix payé à ce fournisseur pour un conditionnement (toute l'histoire). */
export interface PrixAchatFournisseur {
  produitId: number
  produit: string
  conditionnement: string
  quantiteBase: number
  /** Prix d'UN conditionnement, en FCFA. */
  dernierPrix: number
  /** AAAA-MM-JJ HH:MM:SS. */
  dateDernierPrix: string
  /** Prix payé à la réception précédente de ce fournisseur, null si un seul achat. */
  prixPrecedent: number | null
  /** dernier − précédent, en FCFA ; null si un seul achat. */
  ecart: number | null
  /** Écart en %, à une décimale (+10 pour 6 000 → 6 600) ; null si un seul achat. */
  ecartPourcent: number | null
  /** Coût par unité de base du dernier prix (6 600 / 24 → 275). */
  coutBase: number
  nbReceptions: number
}

export interface AchatsFournisseur {
  fournisseurId: number
  nom: string
  /** Période des livraisons, AAAA-MM-JJ ; 90 derniers jours par défaut. */
  du: string
  au: string
  /** Réceptions de la période, les plus récentes d'abord. */
  receptions: ResumeReception[]
  totalPeriode: number
  /** Par produit puis du plus petit au plus grand conditionnement ; sans filtre de période. */
  prix: PrixAchatFournisseur[]
}

export interface ContratFournisseurs {
  /** Actifs puis désactivés, chacun par ordre alphabétique. Gérant. */
  'fournisseurs:liste': { requete: void; reponse: Fournisseur[] }
  'fournisseurs:creer': { requete: SaisieFournisseur; reponse: { id: number } }
  'fournisseurs:modifier': { requete: SaisieFournisseur & { id: number }; reponse: void }
  /** Motif obligatoire, journalisé ; refusée tant que le fournisseur a un solde dû. Gérant. */
  'fournisseurs:desactiver': { requete: { id: number; motif: string }; reponse: void }
  /** Livraisons d'une période et derniers prix d'achat (REGLES_METIER § 4.6). Gérant. */
  'fournisseurs:achats': {
    requete: { fournisseurId: number; du?: string | null; au?: string | null }
    reponse: AchatsFournisseur
  }
}
