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
  /** Reste dû des réceptions dont l'échéance est dépassée, en FCFA (B10). */
  enRetard?: number
  /** Plus proche échéance d'une réception non soldée (AAAA-MM-JJ), null s'il n'y en a pas (B10). */
  prochaineEcheance?: string | null
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

// ─── Règlements et dettes (REGLES_METIER § 4.5, B10) ──────────────────────────

export type ModeReglement = 'especes' | 'tmoney' | 'flooz' | 'virement' | 'autre'

export interface SaisieReglement {
  fournisseurId: number
  /** Réception payée ; absent ou null = règlement global, imputé sur les plus anciennes. */
  receptionId?: number | null
  /** FCFA entier > 0, au plus le reste dû. */
  montant: number
  mode: ModeReglement
  /** N° de transaction ou de virement, texte libre. */
  reference?: string | null
  /** AAAA-MM-JJ, jamais dans le futur ; aujourd'hui par défaut. */
  date?: string | null
}

export type EtatEcheance = 'soldee' | 'a_payer' | 'en_retard'

export interface EcheanceReception {
  receptionId: number
  numero: string
  /** AAAA-MM-JJ HH:MM:SS. */
  dateReception: string
  /** AAAA-MM-JJ ; null pour une réception antérieure aux échéances figées. */
  dateEcheance: string | null
  total: number
  regle: number
  reste: number
  etat: EtatEcheance
  joursRetard: number
}

export interface ReglementFournisseur {
  id: number
  /** AAAA-MM-JJ. */
  date: string
  montant: number
  mode: ModeReglement
  reference: string | null
  /** Numéro RC de la réception payée, null pour un règlement global. */
  reception: string | null
  utilisateur: string
  /** Date et heure de l'annulation, null si le règlement compte. */
  annuleLe: string | null
  annulePar: string | null
  motifAnnulation: string | null
}

export interface DettesFournisseur {
  fournisseurId: number
  nom: string
  actif: boolean
  soldeDu: number
  enRetard: number
  /** Réceptions non soldées (par échéance), puis soldées des 90 derniers jours (plus récentes d'abord). */
  echeances: EcheanceReception[]
  /** Tous les règlements, annulés compris, les plus récents d'abord. */
  reglements: ReglementFournisseur[]
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
  /** Hors caisse ; refusé au-delà du reste dû (REGLES_METIER § 4.5). Gérant. */
  'fournisseurs:enregistrerReglement': { requete: SaisieReglement; reponse: { id: number } }
  /** Motif obligatoire, journalisé ; le règlement reste visible mais ne compte plus. Gérant. */
  'fournisseurs:annulerReglement': { requete: { id: number; motif: string }; reponse: void }
  /** Solde, échéancier par réception et règlements d'un fournisseur. Gérant. */
  'fournisseurs:dettes': { requete: { fournisseurId: number }; reponse: DettesFournisseur }
}
