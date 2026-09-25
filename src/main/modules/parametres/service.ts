/**
 * Paramètres de la boutique. Propriétaire : Dev B.
 * La table est un simple clé/valeur texte : ce service est le seul à connaître les clés, leurs
 * défauts et leur conversion, pour que personne d'autre n'ait à le faire.
 * `lireParametres` peut être appelée directement dans le processus principal (ticket imprimé
 * après la vente) sans passer par l'IPC.
 */
import type { ParametresBoutique } from '@shared/ipc/parametres'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'

function texte(v: string | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/** Entier positif ou nul ; toute valeur illisible vaut « non renseigné ». */
function entier(v: string | undefined): number | null {
  const t = v?.trim()
  return t && /^\d+$/.test(t) ? Number(t) : null
}

function jours(v: string | undefined, defaut: number): number {
  const n = entier(v)
  return n !== null && n > 0 ? n : defaut
}

export function lireParametres(db: Db): ParametresBoutique {
  const v = new Map(
    toutes<{ cle: string; valeur: string | null }>(db, 'SELECT cle, valeur FROM parametres').map((l) => [
      l.cle,
      l.valeur ?? undefined
    ])
  )
  const tva = entier(v.get('tva_defaut'))
  return {
    boutiqueNom: texte(v.get('boutique_nom')),
    boutiqueAdresse: texte(v.get('boutique_adresse')),
    boutiqueNif: texte(v.get('boutique_nif')),
    ticketPied: texte(v.get('ticket_pied')) ?? 'Merci de votre visite !',
    // Seuls 18 % et 0 % existent (comme pour la fiche produit) : toute autre valeur revient à 18.
    tvaDefaut: tva === 0 || tva === 18 ? tva : 18,
    plafondRemiseCaissier: entier(v.get('plafond_remise_caissier')),
    peremptionSeuilJours: jours(v.get('peremption_seuil_jours'), 15),
    dormantJours: jours(v.get('dormant_jours'), 60),
    imprimanteMethode: v.get('imprimante_methode')?.trim() === 'share' ? 'share' : 'spooler',
    imprimanteCible: texte(v.get('imprimante_cible')),
    imprimantePageCodes: texte(v.get('imprimante_page_codes'))
  }
}
