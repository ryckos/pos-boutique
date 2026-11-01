/**
 * Propriétaire : Dev A. Rapports de ventes et de caisse (A14, REGLES_METIER § 11.3).
 * Tous les canaux sont réservés au gérant (et à l'admin). Période : mois en cours par défaut.
 */
import type { PeriodeRapport } from './rapports-gestion'

/** Une tranche d'une heure (heure locale), additionnée sur toute la période. */
export interface VentesHeure {
  /** 0 à 23. */
  heure: number
  nbTickets: number
  /** Σ total TTC des tickets de la tranche (les retours ne sont pas des ventes). */
  chiffreAffaires: number
  /** chiffreAffaires / nbTickets, arrondi au franc. */
  panierMoyen: number
}

export interface RapportVentesParHeure {
  du: string
  au: string
  /** Seulement les tranches qui ont des ventes, de la plus matinale à la plus tardive. */
  lignes: VentesHeure[]
  nbTickets: number
  chiffreAffaires: number
}

export interface VentesCaissier {
  utilisateurId: number
  caissier: string
  nbTickets: number
  ventesTtc: number
  /** Retours saisis par cette personne, négatif ou 0. */
  retoursTtc: number
  /** ventesTtc + retoursTtc. */
  chiffreAffaires: number
  /** ventesTtc / nbTickets, arrondi au franc. */
  panierMoyen: number
  /** Remises accordées sur les tickets terminés (lignes + ticket). */
  remises: number
  nbAnnules: number
  montantAnnules: number
}

export interface RapportVentesParCaissier {
  du: string
  au: string
  lignes: VentesCaissier[]
}

export type CritereClassement = 'chiffreAffaires' | 'marge' | 'quantite'

export interface RequeteClassementProduits extends PeriodeRapport {
  /** Défaut : chiffreAffaires. */
  critere?: CritereClassement
  /** Taille du top et du flop, 10 par défaut. */
  limite?: number
}

export interface ProduitClasse {
  produitId: number
  produit: string
  /** Unités de base vendues, retours déduits (un carton de 24 = 24). */
  quantiteBase: number
  /** Σ total_ligne : avant la remise sur le ticket, qui n'est pas répartie par produit. */
  chiffreAffaires: number
  marge: number
}

export interface RapportClassementProduits {
  du: string
  au: string
  critere: CritereClassement
  /** Les plus vendus d'abord. */
  top: ProduitClasse[]
  /** Parmi les produits vendus, les moins vendus d'abord. */
  flop: ProduitClasse[]
  /** Produits qui ont au moins une vente dans la période. */
  nbProduits: number
}

export interface SessionHistorique {
  id: number
  caissier: string
  dateOuverture: string
  /** null = session encore ouverte. */
  dateFermeture: string | null
  fondOuverture: number
  /** Photographies de la clôture ; null tant que la session est ouverte. */
  montantTheorique: number | null
  montantCompte: number | null
  ecart: number | null
  commentaire: string | null
}

export interface RapportSessions {
  du: string
  au: string
  /** Les plus récentes d'abord. */
  lignes: SessionHistorique[]
  /** Σ des écarts des sessions clôturées. */
  totalEcarts: number
  nbCloturees: number
}

export interface ContratRapportsVentes {
  'rapports-ventes:parHeure': { requete: PeriodeRapport; reponse: RapportVentesParHeure }
  'rapports-ventes:parCaissier': { requete: PeriodeRapport; reponse: RapportVentesParCaissier }
  'rapports-ventes:produits': { requete: RequeteClassementProduits; reponse: RapportClassementProduits }
  'rapports-ventes:sessions': { requete: PeriodeRapport; reponse: RapportSessions }
}
