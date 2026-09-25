/**
 * Logique pure de la fenêtre de comptage du stock initial (B6). Propriétaire : Dev B.
 * Le total affiché en direct n'est qu'une aide : le service reconvertit tout depuis la base.
 */
import type { ConditionnementComptage, FicheStockInitial, SaisieStockInitial } from '@shared/ipc/stock'
import { lireNombre } from '../catalogue/saisieProduit'

export interface ChampsStockInitial {
  /** Nombre saisi par conditionnement (clé : id du conditionnement). Vide = 0. */
  nombres: Record<number, string>
  cout: string
  datePeremption: string
  numeroLot: string
}

export function champsDepuisFiche(f: FicheStockInitial): ChampsStockInitial {
  return {
    nombres: {},
    cout: f.coutPropose !== null ? String(f.coutPropose) : '',
    datePeremption: '',
    numeroLot: ''
  }
}

/** Nombre d'une case : vide = 0 ; illisible ou négatif = NaN. */
function nombreDe(texte: string | undefined): number {
  if (texte === undefined || texte.trim() === '') return 0
  const n = lireNombre(texte)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/** 1 carton de 24 + 5 lots de 3 + 2 unités → 41. NaN si une case est illisible. */
export function totalComptage(
  conditionnements: ConditionnementComptage[],
  nombres: Record<number, string>
): number {
  const total = conditionnements.reduce((s, c) => s + nombreDe(nombres[c.id]) * c.quantiteBase, 0)
  return Math.round(total * 1000) / 1000
}

/** Coût saisi : entier strictement positif, sinon NaN. */
export function coutSaisi(texte: string): number {
  const n = lireNombre(texte)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

/** Ce qui manque encore pour enregistrer, ou null si la saisie est complète. */
export function manque(f: FicheStockInitial, c: ChampsStockInitial): string | null {
  const total = totalComptage(f.conditionnements, c.nombres)
  if (Number.isNaN(total)) return 'Une quantité est illisible : des chiffres seulement'
  if (total <= 0) return 'Saisissez ce que vous comptez en rayon'
  if (Number.isNaN(coutSaisi(c.cout))) return 'Saisissez le coût d’achat par unité, en francs sans virgule'
  if (f.suiviPeremption && c.datePeremption.trim() === '') return 'Indiquez la date de péremption'
  return null
}

export function versSaisie(f: FicheStockInitial, c: ChampsStockInitial): SaisieStockInitial {
  return {
    produitId: f.produitId,
    comptage: f.conditionnements
      .map((cond) => ({ conditionnementId: cond.id, nombre: nombreDe(c.nombres[cond.id]) }))
      .filter((l) => l.nombre > 0),
    coutUnitaire: coutSaisi(c.cout),
    datePeremption: f.suiviPeremption ? c.datePeremption : null,
    numeroLot: f.suiviPeremption && c.numeroLot.trim() !== '' ? c.numeroLot.trim() : null
  }
}
