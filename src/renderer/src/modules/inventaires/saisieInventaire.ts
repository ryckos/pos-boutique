/**
 * Logique pure de l'écran Inventaires (B12). Propriétaire : Dev B.
 * Le total et l'écart affichés en direct ne sont qu'une aide : le service reconvertit tout depuis la
 * base et photographie le théorique au moment de l'enregistrement.
 */
import type { ProduitInventaire, SaisieComptage } from '@shared/ipc/inventaires'
import { EPSILON_ECART, arrondirQuantite, valeurEcart, type MotifEcart } from '@shared/inventaires'
import { normaliserRecherche } from '@shared/texte'
import { totalComptage } from '../stock/saisieStockInitial'
import { lireNombre } from '../catalogue/saisieProduit'

export interface ChampsComptage {
  /** Nombre saisi par conditionnement (clé : id du conditionnement). Vide = 0. */
  nombres: Record<number, string>
  motif: MotifEcart | ''
  commentaire: string
}

/** Un recomptage repart du comptage enregistré ; un premier comptage part de cases vides. */
export function champsDepuisProduit(p: ProduitInventaire): ChampsComptage {
  if (!p.ligne) return { nombres: {}, motif: '', commentaire: '' }
  return {
    nombres: Object.fromEntries(p.ligne.detail.map((d) => [d.conditionnementId, String(d.nombre)])),
    motif: p.ligne.motif ?? '',
    commentaire: p.ligne.commentaire ?? ''
  }
}

/** Écart prévu si l'on enregistre maintenant : compté − stock actuel. NaN si illisible. */
export function ecartPrevu(p: ProduitInventaire, c: ChampsComptage): number {
  const total = totalComptage(p.conditionnements, c.nombres)
  return Number.isNaN(total) ? NaN : arrondirQuantite(total - p.stock)
}

export const ecartNul = (ecart: number): boolean => Math.abs(ecart) <= EPSILON_ECART

/** Ce qui manque encore pour enregistrer, ou null si la saisie est complète. */
export function manque(p: ProduitInventaire, c: ChampsComptage): string | null {
  // Toutes les cases vides = rien de saisi, pas « zéro compté » : on exige au moins un 0 tapé.
  if (!Object.values(c.nombres).some((t) => t.trim() !== '')) {
    return 'Saisissez ce que vous comptez (tapez 0 s’il n’y en a pas)'
  }
  const ecart = ecartPrevu(p, c)
  if (Number.isNaN(ecart)) return 'Une quantité est illisible : des chiffres seulement'
  if (!ecartNul(ecart) && c.motif === '') return 'Il y a un écart : choisissez-en le motif'
  return null
}

export function versSaisie(inventaireId: number, p: ProduitInventaire, c: ChampsComptage): SaisieComptage {
  const ecart = ecartPrevu(p, c)
  const avecMotif = !ecartNul(ecart) && c.motif !== ''
  return {
    inventaireId,
    produitId: p.produitId,
    comptage: p.conditionnements.map((cond) => {
      const texte = c.nombres[cond.id]
      return { conditionnementId: cond.id, nombre: texte?.trim() ? lireNombre(texte) : 0 }
    }),
    motif: avecMotif ? (c.motif as MotifEcart) : null,
    commentaire: avecMotif && c.commentaire.trim() !== '' ? c.commentaire.trim() : null
  }
}

/** Estimation de la démarque tant que l'inventaire est en cours (au CUMP actuel). */
export function estimation(produits: ProduitInventaire[]): {
  nbComptes: number
  nbEcarts: number
  manquants: number
  surplus: number
} {
  let nbComptes = 0
  let nbEcarts = 0
  let manquants = 0
  let surplus = 0
  for (const p of produits) {
    if (!p.ligne) continue
    nbComptes++
    if (ecartNul(p.ligne.ecart)) continue
    nbEcarts++
    const v = valeurEcart(p.ligne.ecart, p.cump)
    if (v < 0) manquants -= v
    else surplus += v
  }
  return { nbComptes, nbEcarts, manquants, surplus }
}

export type FiltreInventaire = 'a_compter' | 'comptes' | 'ecarts' | 'tous'

export function filtrer(
  produits: ProduitInventaire[],
  filtre: FiltreInventaire,
  recherche: string
): ProduitInventaire[] {
  const cle = normaliserRecherche(recherche.trim())
  return produits.filter(
    (p) =>
      (filtre === 'tous' ||
        (filtre === 'a_compter' && !p.ligne) ||
        (filtre === 'comptes' && p.ligne !== null) ||
        (filtre === 'ecarts' && p.ligne !== null && !ecartNul(p.ligne.ecart))) &&
      (cle === '' || normaliserRecherche(p.nom).includes(cle))
  )
}
