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

/**
 * Part de la remise sur le ticket supportée par chaque taux (règle 6.6) : au prorata du TTC de chaque
 * taux, partie entière, le reste de la division allant au taux le plus élevé qui peut l'absorber.
 * Entrées triées par taux décroissant ; la remise ne dépasse jamais le total (contrôlé avant).
 */
export function repartirRemise(ttcParTaux: number[], remise: number): number[] {
  const total = ttcParTaux.reduce((s, t) => s + t, 0)
  if (remise === 0 || total === 0) return ttcParTaux.map(() => 0)
  const parts = ttcParTaux.map((ttc) => Math.floor((remise * ttc) / total))
  let reste = remise - parts.reduce((s, p) => s + p, 0)
  for (let i = 0; reste > 0 && i < parts.length; i++) {
    const place = Math.min(reste, ttcParTaux[i] - parts[i])
    parts[i] += place
    reste -= place
  }
  return parts
}

/**
 * HT = arrondi(TTC / (1 + taux/100)), TVA = TTC − HT, pour chaque taux, dans l'ordre décroissant.
 * Le TTC de chaque taux est net des remises : celles des lignes sont déjà dans `totalTtc`, celle du
 * ticket est répartie ici.
 */
export function ventilerTva(lignes: { totalTtc: number; tauxTva: number }[], remiseGlobale = 0): TotauxVente {
  const ttcParTaux = new Map<number, number>()
  for (const l of lignes) ttcParTaux.set(l.tauxTva, (ttcParTaux.get(l.tauxTva) ?? 0) + l.totalTtc)

  const brut = [...ttcParTaux.entries()].sort(([a], [b]) => b - a)
  const remises = repartirRemise(
    brut.map(([, ttc]) => ttc),
    remiseGlobale
  )
  const parTaux = brut
    .map(([taux, ttc], i): [number, number] => [taux, ttc - remises[i]])
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
