/** Textes communs aux écrans de stock (B4). Propriétaire : Dev B. */
import type { PartRepartition } from '@shared/stock'
import { formaterQuantite } from '@shared/format'

/** « = 1 × Carton de 24 + 7 × Lot de 3 + 1 × Unité » (à titre indicatif). */
export const texteRepartition = (parts: PartRepartition[]): string =>
  `= ${parts.map((p) => `${formaterQuantite(p.nombre)} × ${p.nom}`).join(' + ')}`
