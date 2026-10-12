/**
 * Règles pures des mouvements de caisse, partagées par le service et les écrans. Propriétaire : Dev A.
 * REGLES_METIER § 6.10.
 */

export type SensMouvementCaisse = 'entree' | 'sortie'

/** Valeurs de la colonne `mouvements_caisse.motif`. */
export type MotifMouvementCaisse =
  | 'apport'
  | 'retrait'
  | 'depense'
  | 'encaissement_creance'
  | 'remboursement'
  | 'reglement_fournisseur'
  | 'autre'

export const LIBELLES_MOTIF_CAISSE: Record<MotifMouvementCaisse, string> = {
  apport: 'Apport',
  retrait: 'Retrait',
  depense: 'Dépense',
  encaissement_creance: 'Encaissement de créance',
  remboursement: 'Remboursement',
  reglement_fournisseur: 'Règlement fournisseur',
  autre: 'Autre'
}

/**
 * Motifs que le gérant saisit à la main depuis la caisse. Les autres naissent d'un document
 * (dépense, créance, retour, règlement) et s'annulent depuis l'écran de ce document.
 */
export const MOTIFS_SAISIS_AU_TIROIR = ['apport', 'retrait', 'autre'] as const
export type MotifSaisiAuTiroir = (typeof MOTIFS_SAISIS_AU_TIROIR)[number]

/** Sens imposé par le motif : un apport entre, un retrait sort ; « Autre » laisse le choix. */
export function sensDuMotif(motif: MotifSaisiAuTiroir): SensMouvementCaisse | null {
  if (motif === 'apport') return 'entree'
  if (motif === 'retrait') return 'sortie'
  return null
}

/**
 * Libellé d'une ligne de mouvement (rapports X et Z, liste de la caisse) :
 * « Dépense (taxi-moto) », « Annulation : Apport (erreur de saisie) ».
 */
export function libelleMouvementCaisse(m: {
  motif: string
  commentaire: string | null
  annulation: boolean
}): string {
  const motif = LIBELLES_MOTIF_CAISSE[m.motif as MotifMouvementCaisse] ?? m.motif
  const texte = m.commentaire ? `${motif} (${m.commentaire})` : motif
  return m.annulation ? `Annulation : ${texte}` : texte
}
