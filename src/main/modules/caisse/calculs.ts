/**
 * Propriétaire : Dev A.
 *
 * Calculs de la caisse (règle 6.4). Les prix sont TTC ; la TVA se calcule PAR TAUX puis on somme.
 * C'est le SEUL endroit où un montant est arrondi.
 */

export interface VentilationTaux {
  taux: number
  ttc: number
  ht: number
  tva: number
}

export interface TotauxVente {
  parTaux: VentilationTaux[]
  totalTtc: number
  totalHt: number
  totalTva: number
}

/** HT = arrondi(TTC / (1 + taux/100)), TVA = TTC − HT, pour chaque taux, dans l'ordre décroissant. */
export function ventilerTva(lignes: { totalTtc: number; tauxTva: number }[]): TotauxVente {
  const ttcParTaux = new Map<number, number>()
  for (const l of lignes) ttcParTaux.set(l.tauxTva, (ttcParTaux.get(l.tauxTva) ?? 0) + l.totalTtc)

  const parTaux = [...ttcParTaux.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taux, ttc]) => {
      const ht = Math.round(ttc / (1 + taux / 100))
      return { taux, ttc, ht, tva: ttc - ht }
    })

  return {
    parTaux,
    totalTtc: parTaux.reduce((s, t) => s + t.ttc, 0),
    totalHt: parTaux.reduce((s, t) => s + t.ht, 0),
    totalTva: parTaux.reduce((s, t) => s + t.tva, 0)
  }
}
