/**
 * Propriétaire : Dev A.
 *
 * Logique pure des fenêtres « Faire une facture », « Proforma » et « Reprendre une proforma » (tâche
 * A10, règles 6.12 et 6.13). Le service revérifie tout : ticket facturable, prix, remises, plafond.
 */
import type { ClientDocument } from '@shared/ipc/caisse'

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
