/** Règles pures du crédit client (A11, REGLES_METIER § 7.1), partagées par la caisse et le principal. */

/** Échéance par défaut d'une part à crédit, en jours. */
export const DELAI_CREDIT_JOURS = 30

/** 'AAAA-MM-JJ' + `jours` jours (calcul en UTC : aucun décalage d'heure d'été ne déplace la date). */
export function ajouterJours(jour: string, jours: number): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}
