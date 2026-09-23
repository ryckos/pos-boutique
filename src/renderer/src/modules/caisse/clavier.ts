/**
 * Propriétaire : Dev A.
 *
 * Raccourcis clavier de la caisse (docs/UI_UX.md § 3). La douchette n'envoie que des chiffres et
 * Entrée : aucune de ces touches ne peut donc être produite par un scan.
 */
export type ActionClavier =
  'rechercher' | 'encaisser' | 'mettreEnAttente' | 'supprimerLigne' | 'fermer' | 'plus' | 'moins'

const RACCOURCIS: Record<string, ActionClavier> = {
  F2: 'rechercher',
  F4: 'encaisser',
  F8: 'mettreEnAttente',
  Delete: 'supprimerLigne',
  Escape: 'fermer',
  '+': 'plus',
  '-': 'moins'
}

/** `touche` est la valeur de KeyboardEvent.key. */
export function actionClavier(touche: string): ActionClavier | null {
  return RACCOURCIS[touche] ?? null
}
