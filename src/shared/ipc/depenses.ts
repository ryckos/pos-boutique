/** Propriétaire : Dev B. Dépenses de la boutique (B13, REGLES_METIER § 10). */

/** `caisse` = payée au tiroir (après A8 de Dev A) ; `fonds_propres` = sans effet sur la caisse. */
export type SourceDepense = 'caisse' | 'fonds_propres'

export interface CategorieDepense {
  id: number
  nom: string
  actif: boolean
}

export interface Depense {
  id: number
  /** DEP-AAAA-NNNNNN. */
  numero: string
  /** AAAA-MM-JJ. */
  date: string
  categorieId: number
  categorie: string
  libelle: string
  /** FCFA. */
  montant: number
  source: SourceDepense
  /** N° du reçu ou de la facture, null si aucun. */
  reference: string | null
  utilisateur: string
  /** AAAA-MM-JJ HH:MM:SS ; null = dépense valable. */
  annuleLe: string | null
  annulePar: string | null
  motifAnnulation: string | null
}

export interface SaisieDepense {
  categorieId: number
  libelle: string
  /** FCFA entiers, > 0. */
  montant: number
  source: SourceDepense
  /** AAAA-MM-JJ ; aujourd'hui par défaut ; jamais dans le futur. */
  date?: string | null
  reference?: string | null
}

export interface ListeDepenses {
  /** Période, AAAA-MM-JJ incluses ; 30 derniers jours par défaut. */
  du: string
  au: string
  /** Plus récentes d'abord, annulées comprises. */
  depenses: Depense[]
  /** Somme des dépenses non annulées de la liste, en FCFA. */
  total: number
  /** Non annulées seulement, du plus gros montant au plus petit. */
  parCategorie: { categorieId: number; categorie: string; total: number }[]
}

export interface ContratDepenses {
  /** Actives par ordre alphabétique (« Autre » en dernier), puis les désactivées si demandé. Gérant. */
  'depenses:categories': { requete: { inclureInactives?: boolean }; reponse: CategorieDepense[] }
  /** Nom unique parmi toutes les catégories (majuscules et espaces ignorés). Gérant. */
  'depenses:creerCategorie': { requete: { nom: string }; reponse: CategorieDepense }
  /** Les dépenses déjà saisies gardent leur catégorie. Gérant. */
  'depenses:desactiverCategorie': { requete: { id: number }; reponse: void }
  'depenses:liste': {
    requete: { du?: string | null; au?: string | null; categorieId?: number | null }
    reponse: ListeDepenses
  }
  /** Numéro DEP attribué ici. Source « caisse » refusée tant que A8 n'est pas livré. Gérant. */
  'depenses:enregistrer': { requete: SaisieDepense; reponse: Depense }
  /** Motif obligatoire, journalisé ; la dépense reste visible mais ne compte plus. Gérant. */
  'depenses:annuler': { requete: { id: number; motif: string }; reponse: void }
}
