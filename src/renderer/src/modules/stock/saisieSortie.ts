/**
 * Logique pure de l'écran « Sortie de stock » (B11, REGLES_METIER § 8, UI_UX § 5.9).
 * Propriétaire : Dev B. Sans React ni IPC : testée seule. Le principal revérifie tout.
 */
import type { FicheSortie, SaisieSortie, StatutAvoir } from '@shared/ipc/stock'
import { MOTIFS_SORTIE, avoirAttendu, coutRetour, type MotifSortie } from '@shared/stock'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import { formaterQuantite } from '@shared/format'
import { lireNombre } from '../achats/saisieReception'

/** Pastille de l'avoir d'un retour, sur l'écran des sorties et dans les dettes du fournisseur. */
export const STATUTS_AVOIR: Record<StatutAvoir, { texte: string; classe: string }> = {
  attendu: { texte: 'Avoir attendu', classe: 'pastille-alerte' },
  recu: { texte: 'Avoir reçu', classe: 'pastille-ok' },
  refuse: { texte: 'Avoir refusé', classe: 'pastille-erreur' },
  annule: { texte: 'Annulé', classe: 'pastille-inactif' }
}

/** Valeur du choix « sans lot » dans la liste des lots. */
export const SANS_LOT = ''

export interface ChampsSortie {
  /** Id du lot en texte, ou SANS_LOT. */
  lot: string
  quantite: string
  motif: MotifSortie
  commentaire: string
  retour: boolean
  /** Id du fournisseur en texte, '' si aucun choisi. */
  fournisseur: string
  /** Avoir attendu saisi à la main ; '' = calculé. */
  avoir: string
}

/** Le lot le plus proche de sa date est proposé ; le fournisseur proposé vient de la fiche. */
export function champsInitiaux(fiche: FicheSortie): ChampsSortie {
  return {
    lot: fiche.lots[0] ? String(fiche.lots[0].lotId) : SANS_LOT,
    quantite: '',
    motif: 'casse',
    commentaire: '',
    retour: false,
    fournisseur: fiche.fournisseurPropose !== null ? String(fiche.fournisseurPropose) : '',
    avoir: ''
  }
}

function lotChoisi(fiche: FicheSortie, c: ChampsSortie) {
  return c.lot === SANS_LOT ? null : (fiche.lots.find((l) => String(l.lotId) === c.lot) ?? null)
}

/** Ce qu'on peut sortir au plus : le restant du lot choisi, sinon le stock du produit. */
export function disponible(fiche: FicheSortie, c: ChampsSortie): number {
  const lot = lotChoisi(fiche, c)
  return lot ? lot.restant : Math.max(0, fiche.stock)
}

/** Changer de lot propose le fournisseur qui l'a livré (s'il est actif) ; l'avoir est recalculé. */
export function changerLot(fiche: FicheSortie, c: ChampsSortie, lot: string): ChampsSortie {
  const l = lot === SANS_LOT ? null : fiche.lots.find((x) => String(x.lotId) === lot)
  const fournisseurLot =
    l?.fournisseurId != null && fiche.prixFournisseurs.some((p) => p.fournisseurId === l.fournisseurId)
      ? String(l.fournisseurId)
      : null
  return { ...c, lot, fournisseur: fournisseurLot ?? c.fournisseur, avoir: '' }
}

/** Avoir attendu calculé : quantité × coût de retour (prix du lot, dernier prix payé, CUMP). */
export function avoirCalcule(fiche: FicheSortie, c: ChampsSortie): number | null {
  const q = lireNombre(c.quantite)
  if (q === null || !Number.isFinite(q) || q <= 0 || c.fournisseur === '') return null
  const cout = coutRetour(Number(c.fournisseur), {
    lot: lotChoisi(fiche, c),
    prixFournisseurs: fiche.prixFournisseurs,
    cump: fiche.cump
  })
  return avoirAttendu(q, cout)
}

/** Ce qui manque pour valider, en clair ; null si la saisie est complète. */
export function manqueSortie(fiche: FicheSortie, c: ChampsSortie): string | null {
  const q = lireNombre(c.quantite)
  if (q === null) return 'Indiquez la quantité qui sort du stock.'
  if (!Number.isFinite(q) || q <= 0) return 'La quantité est un nombre supérieur à zéro.'
  if (!UNITES_FRACTIONNAIRES.includes(fiche.unite) && !Number.isInteger(q)) {
    return 'La quantité est un nombre entier.'
  }
  const max = disponible(fiche, c)
  if (max <= 0) return c.lot === SANS_LOT ? 'Ce produit n’a pas de stock à sortir.' : 'Ce lot est vide.'
  if (q > max) {
    return `Il ne reste que ${formaterQuantite(max)}${c.lot === SANS_LOT ? ' en stock' : ' dans ce lot'}.`
  }
  // La case reste cochée si l'on passe à « Vol » ou « Don », mais elle est cachée et ignorée.
  if (c.retour && MOTIFS_SORTIE[c.motif].retourPossible) {
    if (c.fournisseur === '') return 'Choisissez le fournisseur du retour.'
    if (c.avoir.trim() !== '') {
      const a = lireNombre(c.avoir)
      if (a === null || !Number.isInteger(a) || a <= 0) {
        return 'L’avoir attendu est un nombre de francs, sans virgule, supérieur à zéro.'
      }
    } else if (!avoirCalcule(fiche, c)) {
      return 'Indiquez l’avoir attendu.'
    }
  }
  return null
}

/** À n'appeler que si manqueSortie() renvoie null. */
export function versSaisieSortie(fiche: FicheSortie, c: ChampsSortie): SaisieSortie {
  const retourValable = c.retour && MOTIFS_SORTIE[c.motif].retourPossible
  return {
    produitId: fiche.produitId,
    lotId: c.lot === SANS_LOT ? null : Number(c.lot),
    quantite: lireNombre(c.quantite)!,
    motif: c.motif,
    commentaire: c.commentaire.trim() || null,
    retour: retourValable
      ? {
          fournisseurId: Number(c.fournisseur),
          montantAttendu: c.avoir.trim() !== '' ? lireNombre(c.avoir) : avoirCalcule(fiche, c)
        }
      : null
  }
}
