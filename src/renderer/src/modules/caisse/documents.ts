/**
 * Propriétaire : Dev A.
 *
 * Logique pure des fenêtres « Faire une facture », « Proforma » et « Reprendre une proforma » (tâche
 * A10, règles 6.12 et 6.13). Le service revérifie tout : ticket facturable, prix, remises, plafond.
 */
import { formaterDate, formaterFCFA } from '@shared/format'
import type { ClientDocument, ProformaReprise } from '@shared/ipc/caisse'
import { panierVide, reducteurPanier, totalRemises, type Panier } from './panier'

/** Même borne que le service : un champ plus long serait refusé à l'enregistrement. */
export const LONGUEUR_MAX_CHAMP = 120

/** Saisie brute du formulaire client, champ par champ. */
export interface SaisieClient {
  nom: string
  telephone: string
  adresse: string
  nif: string
}

export const saisieClientVide: SaisieClient = { nom: '', telephone: '', adresse: '', nif: '' }

/**
 * Le client tel qu'il part au service : espaces retirés, champs vides absents. Null si rien n'est
 * saisi du tout (proforma pour un client de passage).
 */
export function nettoyerClient(saisie: SaisieClient): ClientDocument | null {
  const nom = saisie.nom.trim()
  const telephone = saisie.telephone.trim()
  const adresse = saisie.adresse.trim()
  const nif = saisie.nif.trim()
  if (!nom && !telephone && !adresse && !nif) return null
  return {
    nom,
    ...(telephone && { telephone }),
    ...(adresse && { adresse }),
    ...(nif && { nif })
  }
}

/**
 * Ce qui manque au client, ou null s'il convient. Facture : le nom est obligatoire. Proforma : le
 * client est facultatif, mais s'il est donné, il a un nom.
 */
export function manqueClient(saisie: SaisieClient, obligatoire: boolean): string | null {
  const client = nettoyerClient(saisie)
  if (!client) return obligatoire ? 'Saisissez le nom du client (ou de l’entreprise).' : null
  if (!client.nom) return 'Saisissez aussi le nom du client, ou videz les autres champs.'
  return null
}

/** Une facture se cherche par son numéro F-… ou par celui de son ticket. */
export const estNumeroFacture = (numero: string): boolean => numero.trim().toUpperCase().startsWith('F-')

/**
 * Le panier d'une proforma reprise (règle 6.13) : chaque article encore en vente, à sa quantité et
 * avec sa remise, puis la remise sur le ticket. Les montants sont ceux du jour : le service relira
 * tout à l'encaissement. Une remise plus grande que la ligne à son nouveau prix est ramenée par le
 * réducteur du panier. L'accord du gérant n'est pas repris : il ne vaut que pour une vente.
 * `alertes` dit tout ce qui diffère de la proforma, pour le bandeau de la caisse.
 */
export function panierDeProforma(reprise: ProformaReprise): { panier: Panier; alertes: string[] } {
  const alertes: string[] = []
  if (reprise.expiree) {
    alertes.push(
      `Proforma ${reprise.numero} périmée depuis le ${formaterDate(reprise.valideJusquAu)} : vente aux prix du jour.`
    )
  }
  let panier = panierVide
  for (const l of reprise.lignes) {
    if (!l.article) {
      alertes.push(`${l.designation} : n’est plus en vente, non repris au ticket.`)
      continue
    }
    const id = l.article.conditionnementId
    panier = reducteurPanier(panier, { type: 'ajouter', article: l.article })
    panier = reducteurPanier(panier, { type: 'changerQuantite', conditionnementId: id, quantite: l.quantite })
    if (l.remise > 0)
      panier = reducteurPanier(panier, { type: 'remiserLigne', conditionnementId: id, montant: l.remise })
    if (l.prixChange) {
      alertes.push(
        `${l.designation} : ${formaterFCFA(l.prixProforma)} sur la proforma, ${formaterFCFA(l.article.prixVente)} aujourd’hui.`
      )
    }
  }
  if (reprise.remiseGlobale > 0 && panier.lignes.length > 0) {
    panier = reducteurPanier(panier, { type: 'remiserTicket', montant: reprise.remiseGlobale })
  }
  return { panier: reducteurPanier(panier, { type: 'selectionner', conditionnementId: null }), alertes }
}

/**
 * Remises reprises au-delà du plafond de la caissière (règle 6.6) : le service refusera la vente
 * sans l'accord du gérant. Plafond non fixé (D-A3) = toute remise demande le gérant.
 */
export function alerteRemisesHorsPlafond(
  panier: Panier,
  plafond: number | null,
  estCaissiere: boolean
): string | null {
  const remises = totalRemises(panier)
  if (!estCaissiere || remises === 0 || (plafond !== null && remises <= plafond)) return null
  return `Remises de ${formaterFCFA(remises)} au-delà de votre plafond : faites-les autoriser par le gérant (Remise sur le ticket) avant d’encaisser.`
}
