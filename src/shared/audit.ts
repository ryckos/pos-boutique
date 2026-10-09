/**
 * Lecture du journal d'audit (B14) : chaque action et chaque valeur en français lisible, jamais de
 * code technique ni de JSON à l'écran. Propriétaire : Dev B. Règles pures, testées.
 */
import { formaterDelai, formaterFCFA, formaterQuantite } from './format'
import { LIBELLES_MOUVEMENT } from './stock'
import type { TypeMouvement } from './types'

export interface DetailAudit {
  libelle: string
  valeur: string
}

/** Toutes les actions journalisées (REGLES_METIER § 1.4). */
export const LIBELLES_ACTION: Record<string, string> = {
  connexion: 'Connexion',
  deconnexion: 'Déconnexion',
  echec_connexion_verrouillage: 'Compte verrouillé (codes faux)',
  modification_prix: 'Modification d’un prix de vente',
  desactivation_produit: 'Désactivation d’un produit',
  import_catalogue: 'Import du catalogue',
  stock_initial: 'Stock initial',
  annulation_stock_initial: 'Annulation d’un stock initial',
  remise: 'Remise',
  annulation_ligne: 'Ligne retirée du ticket',
  annulation_ticket: 'Annulation d’un ticket',
  impression_ticket: 'Impression d’un ticket',
  ouverture_tiroir_hors_vente: 'Ouverture du tiroir hors vente',
  ouverture_session_caisse: 'Ouverture de caisse',
  cloture_session_caisse: 'Clôture de caisse',
  impression_rapport_z: 'Impression du rapport Z',
  modification_parametre: 'Modification d’un paramètre',
  creation_utilisateur: 'Création d’un compte',
  modification_role: 'Changement de rôle',
  desactivation_utilisateur: 'Désactivation d’un compte',
  modification_pin: 'Changement de code personnel',
  reinitialisation_pin: 'Réinitialisation d’un code',
  desactivation_fournisseur: 'Désactivation d’un fournisseur',
  annulation_commande: 'Annulation d’une commande',
  cloture_commande: 'Clôture d’une commande',
  annulation_reglement_fournisseur: 'Annulation d’un règlement fournisseur',
  annulation_sortie_stock: 'Annulation d’une sortie de stock',
  refus_avoir_fournisseur: 'Avoir fournisseur refusé',
  validation_inventaire: 'Validation d’un inventaire',
  annulation_inventaire: 'Annulation d’un inventaire',
  annulation_depense: 'Annulation d’une dépense',
  restauration_sauvegarde: 'Restauration d’une sauvegarde'
}

const LIBELLES_CHAMP: Record<string, string> = {
  motif: 'Motif',
  commentaire: 'Commentaire',
  numero: 'Numéro',
  numeroTicket: 'Ticket',
  statut: 'État',
  reste: 'Reste non livré',
  verrouillage: 'Verrouillage n°',
  delaiSecondes: 'Délai',
  nom: 'Nom',
  role: 'Rôle',
  codeProvisoire: 'Code provisoire',
  actif: 'Actif',
  produit: 'Produit',
  conditionnement: 'Conditionnement',
  designation: 'Article',
  prixVente: 'Prix de vente',
  stockRestant: 'Stock restant',
  stockAvant: 'Stock avant',
  stock: 'Stock après',
  quantite: 'Quantité',
  coutUnitaire: 'Coût par unité',
  detail: 'Comptage',
  montant: 'Montant',
  montantAttendu: 'Avoir attendu',
  valeur: 'Valeur',
  abandon: 'Ticket abandonné',
  portee: 'Portée',
  autoriseeParId: 'Autorisée par',
  caissierId: 'Caissière ou caissier',
  fondOuverture: 'Fond de caisse',
  especesTheoriques: 'Espèces attendues',
  montantCompte: 'Espèces comptées',
  ecart: 'Écart',
  duplicata: 'Duplicata',
  date: 'Date',
  categorie: 'Catégorie',
  libelle: 'Libellé',
  source: 'Payée par',
  fournisseur: 'Fournisseur',
  type: 'Type',
  rayon: 'Rayon',
  comptes: 'Produits comptés',
  ecarts: 'Écarts',
  nonComptes: 'Non comptés',
  manquants: 'Manquants',
  surplus: 'Surplus',
  fichier: 'Fichier',
  crees: 'Produits créés',
  ignorees: 'Lignes ignorées',
  nouvellesCategories: 'Nouveaux rayons'
}

const MONTANTS = new Set([
  'prixVente',
  'montant',
  'montantAttendu',
  'valeur',
  'coutUnitaire',
  'fondOuverture',
  'especesTheoriques',
  'montantCompte',
  'ecart',
  'manquants',
  'surplus'
])
const QUANTITES = new Set(['quantite', 'stockRestant', 'stockAvant', 'stock', 'reste'])

const ROLES: Record<string, string> = { caissier: 'Caissier', gerant: 'Gérant', admin: 'Administrateur' }
const STATUTS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  recue_partiel: 'Reçue en partie',
  recue: 'Reçue',
  annulee: 'Annulée'
}
const SOURCES: Record<string, string> = { fonds_propres: 'Fonds propres', caisse: 'Caisse (tiroir)' }
const PORTEES: Record<string, string> = { ligne: 'Une ligne', ticket: 'Tout le ticket' }

const PARAMETRES: Record<string, string> = {
  boutique_nom: 'Nom de la boutique',
  boutique_adresse: 'Adresse',
  boutique_nif: 'NIF',
  ticket_pied: 'Pied du ticket',
  tva_defaut: 'TVA proposée',
  plafond_remise_caissier: 'Plafond de remise sans gérant',
  peremption_seuil_jours: 'Péremptions à surveiller',
  dormant_jours: 'Produit dormant après',
  imprimante_methode: 'Imprimante : raccordement',
  imprimante_cible: 'Imprimante : nom ou port',
  imprimante_page_codes: 'Imprimante : page de codes'
}

/** « stockApres » → « Stock apres » : dernier recours pour un champ que ce fichier ne connaît pas encore. */
function enMots(cle: string): string {
  const mots = cle
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return mots.charAt(0).toUpperCase() + mots.slice(1)
}

export function libelleAction(action: string): string {
  return LIBELLES_ACTION[action] ?? enMots(action)
}

const VIDE = '—'

function valeurParametre(cle: string | null, v: unknown): string {
  if (v === null || v === undefined || v === '') {
    return cle === 'plafond_remise_caissier' ? 'Non défini (gérant obligatoire)' : VIDE
  }
  if (typeof v === 'number') {
    if (cle === 'tva_defaut') return `${v} %`
    if (cle === 'plafond_remise_caissier') return formaterFCFA(v)
    if (cle === 'peremption_seuil_jours' || cle === 'dormant_jours') return `${v} jours`
  }
  return String(v)
}

/**
 * @param nomDe nom d'un utilisateur à partir de son identifiant (champs se terminant par `Id`).
 */
function valeurChamp(cle: string, v: unknown, nomDe: (id: number) => string): string {
  if (v === null || v === undefined || v === '') return VIDE
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return v.length === 0 ? VIDE : v.map(String).join(', ')
  if (typeof v === 'number') {
    if (cle.endsWith('Id')) return nomDe(v)
    if (MONTANTS.has(cle)) return formaterFCFA(Math.round(v))
    if (QUANTITES.has(cle)) return formaterQuantite(v)
    if (cle === 'delaiSecondes') return formaterDelai(v * 1000)
    return String(v)
  }
  if (typeof v === 'string') {
    if (cle === 'role') return ROLES[v] ?? v
    if (cle === 'statut') return STATUTS[v] ?? v
    if (cle === 'source') return SOURCES[v] ?? v
    if (cle === 'portee') return PORTEES[v] ?? v
    if (cle === 'type') return LIBELLES_MOUVEMENT[v as TypeMouvement] ?? v
    return v
  }
  // Un objet imbriqué : ses valeurs à la suite, sans accolades.
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${LIBELLES_CHAMP[k] ?? enMots(k)} : ${valeurChamp(k, x, nomDe)}`)
    .join(' ; ')
}

function detailsDe(valeur: unknown, nomDe: (id: number) => string): DetailAudit[] {
  if (valeur === null || valeur === undefined) return []
  if (typeof valeur !== 'object' || Array.isArray(valeur)) {
    return [{ libelle: 'Valeur', valeur: valeurChamp('', valeur, nomDe) }]
  }
  return Object.entries(valeur as Record<string, unknown>).map(([cle, v]) => ({
    libelle: LIBELLES_CHAMP[cle] ?? enMots(cle),
    valeur: valeurChamp(cle, v, nomDe)
  }))
}

/** Lit un JSON du journal ; un texte qui n'en est pas un est rendu tel quel. */
export function lireJson(texte: string | null): unknown {
  if (texte === null) return null
  try {
    return JSON.parse(texte)
  } catch {
    return texte
  }
}

/** Ce qui était avant l'action et ce qu'elle a fait, en lignes « libellé : valeur ». */
export function detailsAudit(
  e: { action: string; entite: string | null; avant: unknown; apres: unknown },
  nomDe: (id: number) => string
): { avant: DetailAudit[]; apres: DetailAudit[] } {
  // Un paramètre est journalisé comme une simple valeur : son nom est dans `entite`.
  if (e.action === 'modification_parametre') {
    const libelle = (e.entite && PARAMETRES[e.entite]) ?? enMots(e.entite ?? 'parametre')
    return {
      avant: [{ libelle, valeur: valeurParametre(e.entite, e.avant) }],
      apres: [{ libelle, valeur: valeurParametre(e.entite, e.apres) }]
    }
  }
  return { avant: detailsDe(e.avant, nomDe), apres: detailsDe(e.apres, nomDe) }
}
