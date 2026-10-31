/**
 * Logique pure de l'écran client (A13, UI_UX § 5.5). Propriétaire : Dev A.
 * La caisse envoie un état ; l'écran client en tire une vue, sans rien décider de métier.
 */
import type { FinVenteClient, PanierClient } from '@shared/types'
import type { RequeteVente, VenteEnregistree } from '@shared/ipc/caisse'

/** Temps pendant lequel le client voit « Merci » et sa monnaie, avant le retour à l'accueil. */
export const DUREE_FIN_VENTE_MS = 8000

export type VueEcranClient = 'accueil' | 'panier' | 'fin'

/**
 * Un article au ticket l'emporte toujours : la caissière a commencé le client suivant.
 * La fin de vente cède aussi la place à l'accueil une fois son délai écoulé.
 */
export function vueEcranClient(etat: PanierClient, finExpiree: boolean): VueEcranClient {
  if (etat.lignes.length > 0) return 'panier'
  if (etat.fin && !finExpiree) return 'fin'
  return 'accueil'
}

/** Nombre d'articles du ticket (« 7 articles »), pour rassurer le client quand la liste défile. */
export function nombreArticles(etat: PanierClient): number {
  return etat.lignes.reduce((n, l) => n + l.quantite, 0)
}

/**
 * Ce que le client voit après l'encaissement. « Reçu » n'existe qu'en espèces : le montant reçu
 * est celui de la requête, que la caissière vient de saisir.
 */
export function finDeVente(vente: VenteEnregistree, requete: RequeteVente): FinVenteClient {
  const especes = requete.paiements.some((p) => p.mode === 'especes')
  return {
    total: vente.totalTtc,
    ...(especes && requete.montantRecu !== undefined && { recu: requete.montantRecu }),
    monnaieRendue: vente.monnaieRendue,
    ...(vente.credit && { credit: { montant: vente.credit.montant, echeance: vente.credit.echeance } })
  }
}
